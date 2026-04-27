package download

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloudplayer/internal/cloudplayer/captcha"
	"cloudplayer/internal/cloudplayer/config"
	"cloudplayer/internal/cloudplayer/musicsource"
	"github.com/wailsapp/wails/v3/pkg/application"
)

const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

type DownloadJob struct {
	SourceID string `json:"source_id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Quality  string `json:"quality"`
}

type DownloadTaskEvent struct {
	SourceID string  `json:"source_id"`
	Title    string  `json:"title"`
	Artist   string  `json:"artist"`
	Quality  string  `json:"quality"`
	Status   string  `json:"status"`
	Progress float64 `json:"progress"`
	Message  *string `json:"message,omitempty"`
}

func CandidateDownloadedAudioPaths(title, artist string) []string {
	root := destinationRoot()
	mp3Name := sanitizeFilename(fmt.Sprintf("%s - %s.mp3", strings.TrimSpace(title), strings.TrimSpace(artist)))
	flacName := sanitizeFilename(fmt.Sprintf("%s - %s.flac", strings.TrimSpace(title), strings.TrimSpace(artist)))
	return []string{
		filepath.Join(root, mp3Name),
		filepath.Join(root, flacName),
	}
}

func EmitQueued(job DownloadJob) {
	message := "已加入下载队列"
	emitTask(DownloadTaskEvent{
		SourceID: job.SourceID,
		Title:    job.Title,
		Artist:   job.Artist,
		Quality:  job.Quality,
		Status:   "queued",
		Progress: 0,
		Message:  &message,
	})
}

func RunOneJob(client *http.Client, job DownloadJob) {
	task := DownloadTaskEvent{
		SourceID: job.SourceID,
		Title:    job.Title,
		Artist:   job.Artist,
		Quality:  job.Quality,
		Status:   "queued",
		Progress: 0,
	}

	fail := func(format string, args ...any) {
		message := fmt.Sprintf(format, args...)
		task.Status = "failed"
		task.Message = &message
		emitTask(task)
	}

	ref, err := musicsource.ParseSourceID(job.SourceID)
	if err != nil {
		fail("%s", err)
		return
	}

	if err := checkAndReserveDownloadSlot(); err != nil {
		fail("%s", err)
		return
	}

	task.Status = "downloading"
	task.Message = nil
	emitTask(task)

	switch ref.ProviderKey {
	case musicsource.ProviderPJMP3:
		runPJMP3Job(client, ref.RawID, job, &task, fail)
	default:
		fail("不支持的音乐源: %s", ref.ProviderKey)
	}
}

func runPJMP3Job(client *http.Client, rawID string, job DownloadJob, task *DownloadTaskEvent, fail func(string, ...any)) {
	base := strings.TrimRight(config.BaseURL, "/")
	songPage := fmt.Sprintf("%s/song.php?id=%s", base, url.QueryEscape(rawID))

	generated, err := getJSON(client, http.MethodGet, base+"/captcha/gen", nil, map[string]string{
		"User-Agent":      browserUA,
		"Referer":         base + "/",
		"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
	}, 45*time.Second)
	if err != nil {
		fail("captcha/gen: %v", err)
		return
	}

	images := make([]string, 0, 2)
	findLongBase64Strings(generated, 500, &images)
	if len(images) == 0 {
		fail("无法解析验证码图片")
		return
	}
	if len(images) == 1 {
		images = append(images, images[0])
	}
	captchaID := extractCaptchaID(generated)
	if captchaID == "" {
		fail("无法解析 captchaId")
		return
	}
	offset, ok := captcha.GuessSliderOffset(images[0], images[1])
	if !ok {
		fail("自动滑块匹配失败")
		return
	}

	_, err = getJSON(client, http.MethodGet, fmt.Sprintf("%s/captcha/check?id=%s&x=%d", base, url.QueryEscape(captchaID), offset), nil, map[string]string{
		"User-Agent": browserUA,
		"Referer":    songPage,
	}, 45*time.Second)
	if err != nil {
		fail("captcha/check: %v", err)
		return
	}

	time.Sleep(time.Duration((2 + rand.Float64()*1.5) * float64(time.Second)))

	values := url.Values{}
	values.Set("captchaId", captchaID)
	values.Set("id", rawID)
	values.Set("br", normalizeQuality(job.Quality))
	getMusicURL := base + "/captcha/check/getMusicUrl?" + values.Encode()
	urlPayload, err := getJSON(client, http.MethodGet, getMusicURL, nil, map[string]string{
		"User-Agent": browserUA,
		"Referer":    songPage,
	}, 45*time.Second)
	if err != nil {
		fail("getMusicUrl: %v", err)
		return
	}
	if intValue(urlPayload["code"]) != 200 {
		fail("获取下载链接失败: %v", urlPayload)
		return
	}
	musicURL := strings.TrimSpace(stringValue(urlPayload["result"]))
	if musicURL == "" {
		fail("响应无 result URL")
		return
	}

	root := destinationRoot()
	if err := os.MkdirAll(root, 0o755); err != nil {
		fail("创建目录: %v", err)
		return
	}
	ext := ".mp3"
	if normalizeQuality(job.Quality) == "flac" {
		ext = ".flac"
	}
	filename := sanitizeFilename(fmt.Sprintf("%s - %s%s", job.Title, job.Artist, ext))
	outputPath := filepath.Join(root, filename)

	request, err := http.NewRequest(http.MethodGet, musicURL, nil)
	if err != nil {
		fail("下载音频: %v", err)
		return
	}
	request.Header.Set("User-Agent", browserUA)
	request.Header.Set("Referer", songPage)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	response, err := client.Do(request.WithContext(ctx))
	if err != nil {
		fail("下载音频: %v", err)
		return
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		fail("音频 HTTP %s", response.Status)
		return
	}

	file, err := os.Create(outputPath)
	if err != nil {
		fail("创建文件: %v", err)
		return
	}
	defer file.Close()

	total := response.ContentLength
	var written int64
	buffer := make([]byte, 128*1024)
	for {
		n, readErr := response.Body.Read(buffer)
		if n > 0 {
			if _, err := file.Write(buffer[:n]); err != nil {
				fail("写入: %v", err)
				return
			}
			written += int64(n)
			if total > 0 {
				task.Progress = float64(written) / float64(total)
			} else {
				task.Progress = 0.99
			}
			emitTask(*task)
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			fail("读取音频: %v", readErr)
			return
		}
	}

	if err := file.Sync(); err != nil {
		fail("写入: %v", err)
		return
	}

	var message string
	if err := recordDownloadSuccess(); err != nil {
		message = "已保存但计数失败: " + err.Error()
	} else {
		message = "已保存: " + outputPath
	}
	task.Status = "completed"
	task.Progress = 1
	task.Message = &message
	emitTask(*task)
}

func normalizeQuality(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "flac":
		return "flac"
	case "320", "hq":
		return "320"
	default:
		return "128"
	}
}

func destinationRoot() string {
	settings := config.LoadSettings()
	if strings.TrimSpace(settings.DownloadFolder) == "" {
		return config.DefaultDownloadDir()
	}
	return settings.DownloadFolder
}

func sanitizeFilename(value string) string {
	var builder strings.Builder
	for _, r := range value {
		switch {
		case strings.ContainsRune(`<>:"/\|?*`, r):
			builder.WriteRune('_')
		case r < 32:
			builder.WriteRune('_')
		default:
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func checkAndReserveDownloadSlot() error {
	settings := config.LoadSettings()
	today := time.Now().Format("2006-01-02")
	if settings.DownloadsTodayDate != today {
		settings.DownloadsTodayDate = today
		settings.DownloadsTodayCount = 0
	}
	if settings.DailyDownloadLimit > 0 && settings.DownloadsTodayCount >= settings.DailyDownloadLimit {
		return fmt.Errorf("已达到当日下载上限（%d 次）", settings.DailyDownloadLimit)
	}
	return nil
}

func recordDownloadSuccess() error {
	settings := config.LoadSettings()
	today := time.Now().Format("2006-01-02")
	if settings.DownloadsTodayDate != today {
		settings.DownloadsTodayDate = today
		settings.DownloadsTodayCount = 0
	}
	settings.DownloadsTodayCount++
	return config.SaveSettings(settings)
}

func emitTask(task DownloadTaskEvent) {
	_ = application.Get().Event.Emit("download-task-changed", task)
}

func getJSON(client *http.Client, method, requestURL string, body io.Reader, headers map[string]string, timeout time.Duration) (map[string]any, error) {
	request, err := http.NewRequest(method, requestURL, body)
	if err != nil {
		return nil, err
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	response, err := client.Do(request.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		payload, _ := io.ReadAll(response.Body)
		if len(payload) > 0 {
			return nil, fmt.Errorf("%s", strings.TrimSpace(string(payload)))
		}
		return nil, fmt.Errorf("http %s", response.Status)
	}
	payload := map[string]any{}
	decoder := json.NewDecoder(response.Body)
	if err := decoder.Decode(&payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func findLongBase64Strings(value any, minLen int, out *[]string) {
	switch typed := value.(type) {
	case map[string]any:
		for _, item := range typed {
			findLongBase64Strings(item, minLen, out)
		}
	case []any:
		for _, item := range typed {
			findLongBase64Strings(item, minLen, out)
		}
	case string:
		text := strings.TrimSpace(typed)
		if len(text) < minLen {
			return
		}
		for _, r := range text {
			if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || strings.ContainsRune("+/=\n\r ", r)) {
				return
			}
		}
		*out = append(*out, typed)
	}
}

func extractCaptchaID(value any) string {
	switch typed := value.(type) {
	case map[string]any:
		for _, key := range []string{"captchaId", "captcha_id", "token", "id", "uuid", "cid"} {
			text := stringValue(typed[key])
			if len(text) > 8 {
				return text
			}
		}
		for _, item := range typed {
			if found := extractCaptchaID(item); found != "" {
				return found
			}
		}
	case []any:
		for _, item := range typed {
			if found := extractCaptchaID(item); found != "" {
				return found
			}
		}
	}
	return ""
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return fmt.Sprintf("%.0f", typed)
	default:
		return ""
	}
}

func intValue(value any) int64 {
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case int64:
		return typed
	default:
		return 0
	}
}
