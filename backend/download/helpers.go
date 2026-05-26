package download

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"cloudplayer/backend/config"
)

// Helper functions keep shared download formatting and HTTP utilities provider-agnostic.
var emitTaskEvent = func(DownloadTaskEvent) {}

// SetTaskEmitter lets desktop hosts forward queue changes to the Wails event bus
// while mobile bridge builds keep the hook as a no-op.
func SetTaskEmitter(fn func(DownloadTaskEvent)) {
	if fn == nil {
		emitTaskEvent = func(DownloadTaskEvent) {}
		return
	}
	emitTaskEvent = fn
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
	emitTaskEvent(task)
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
