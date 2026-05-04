package download

import (
	"context"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloudplayer/backend/captcha"
	"cloudplayer/backend/config"
)

// runPJMP3Job handles the captcha challenge and audio download flow for the PJMP3 source.
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
