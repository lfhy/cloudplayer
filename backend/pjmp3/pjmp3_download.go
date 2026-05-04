package pjmp3

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"cloudplayer/backend/config"
)

// Download helpers focus on resilient media and lyric fetch attempts with provider headers.
func previewCacheName(songID string) string {
	safe := onlyDigits(strings.TrimSpace(songID))
	if safe == "" {
		return "unknown"
	}
	return safe
}

func normalizeMediaURL(raw string) string {
	value := strings.TrimSpace(strings.TrimSuffix(strings.ReplaceAll(raw, `\/`, `/`), `\`))
	if strings.HasPrefix(value, "//") {
		return "https:" + value
	}
	return value
}

func isExcludedStreamURL(value string) bool {
	lower := strings.ToLower(value)
	if strings.Contains(lower, "albumcover") || strings.Contains(lower, "/star/albumcover") {
		return true
	}
	pathOnly := strings.Split(value, "?")[0]
	lower = strings.ToLower(pathOnly)
	return strings.HasSuffix(lower, ".jpg") ||
		strings.HasSuffix(lower, ".jpeg") ||
		strings.HasSuffix(lower, ".png") ||
		strings.HasSuffix(lower, ".webp") ||
		strings.HasSuffix(lower, ".gif") ||
		strings.HasSuffix(lower, ".css") ||
		strings.HasSuffix(lower, ".js")
}

func pushStreamCandidate(result *[]string, seen map[string]struct{}, raw string) {
	value := normalizeMediaURL(raw)
	if value == "" || !strings.HasPrefix(strings.ToLower(value), "http") || isExcludedStreamURL(value) {
		return
	}
	if _, ok := seen[value]; ok {
		return
	}
	seen[value] = struct{}{}
	*result = append(*result, value)
}

func previewFileExtensionForURL(value string) string {
	pathOnly := strings.ToLower(strings.Split(value, "?")[0])
	switch {
	case strings.HasSuffix(pathOnly, ".m4a"):
		return ".m4a"
	case strings.HasSuffix(pathOnly, ".aac"):
		return ".aac"
	case strings.HasSuffix(pathOnly, ".flac"):
		return ".flac"
	case strings.HasSuffix(pathOnly, ".ogg"):
		return ".ogg"
	case strings.HasSuffix(pathOnly, ".wav"):
		return ".wav"
	case strings.HasSuffix(pathOnly, ".mp3"):
		return ".mp3"
	default:
		return ".mp3"
	}
}

func expandMP3URLCandidates(value string) []string {
	result := []string{value}
	if strings.Contains(strings.ToLower(value), "er-sycdn.kuwo.cn") {
		result = append(result, strings.Replace(value, "er-sycdn.kuwo.cn", "sycdn.kuwo.cn", 1))
	}
	return dedupeStrings(result)
}

func downloadMP3Bytes(client *http.Client, mediaURL, songPage string) ([]byte, error) {
	base := strings.TrimRight(config.BaseURL, "/")
	refHome := base + "/"
	attempts := []struct {
		referer string
		origin  string
	}{
		{referer: songPage, origin: base},
		{referer: songPage},
		{referer: "https://www.kuwo.cn/", origin: "https://www.kuwo.cn"},
		{referer: refHome, origin: base},
		{referer: songPage, origin: "https://www.kuwo.cn"},
	}

	lastErr := "未知错误"
	for _, attempt := range attempts {
		request, err := http.NewRequest(http.MethodGet, mediaURL, nil)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		request.Header.Set("User-Agent", browserUA)
		request.Header.Set("Accept", "*/*")
		request.Header.Set("Referer", attempt.referer)
		if attempt.origin != "" {
			request.Header.Set("Origin", attempt.origin)
		}
		response, err := client.Do(request)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		body, readErr := io.ReadAll(response.Body)
		response.Body.Close()
		if readErr != nil {
			lastErr = readErr.Error()
			continue
		}
		switch response.StatusCode {
		case http.StatusGone, http.StatusForbidden, http.StatusNotFound:
			lastErr = fmt.Sprintf("HTTP %d", response.StatusCode)
			continue
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			lastErr = "HTTP " + response.Status
			continue
		}
		return body, nil
	}
	return nil, fmt.Errorf("%s", lastErr)
}

func validateAudioBytes(bytes []byte) error {
	if len(bytes) < 64 {
		return fmt.Errorf("音频数据过短或无效")
	}
	for _, value := range bytes {
		switch value {
		case ' ', '\n', '\r', '\t':
			continue
		case '<':
			return fmt.Errorf("试听链接返回了网页而非音频")
		default:
			return nil
		}
	}
	return nil
}

func looksLikeLRC(text string) bool {
	trimmed := strings.TrimLeft(text, " \t\r\n")
	return strings.HasPrefix(trimmed, "[") || strings.Contains(text, "[00:") || strings.Contains(text, "[01:") || strings.Contains(text, "[02:")
}

func downloadTextWithSongReferer(client *http.Client, rawURL, songPage string) (string, error) {
	base := strings.TrimRight(config.BaseURL, "/")
	attempts := []struct {
		referer string
		origin  string
	}{
		{referer: songPage, origin: base},
		{referer: songPage},
		{referer: base + "/", origin: base},
	}
	lastErr := "未知错误"
	for _, attempt := range attempts {
		request, err := http.NewRequest(http.MethodGet, rawURL, nil)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		request.Header.Set("User-Agent", browserUA)
		request.Header.Set("Accept", "text/plain,*/*;q=0.8")
		request.Header.Set("Referer", attempt.referer)
		if attempt.origin != "" {
			request.Header.Set("Origin", attempt.origin)
		}
		response, err := client.Do(request)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		body, readErr := io.ReadAll(response.Body)
		response.Body.Close()
		if readErr != nil {
			lastErr = readErr.Error()
			continue
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			lastErr = "HTTP " + response.Status
			continue
		}
		return string(body), nil
	}
	return "", fmt.Errorf("%s", lastErr)
}
