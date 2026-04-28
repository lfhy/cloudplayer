package pjmp3

import (
	"regexp"
	"strings"

	"cloudplayer/internal/cloudplayer/config"
)

const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

var (
	reSongID       = regexp.MustCompile(`(?i)song\.php\?id=(\d+)`)
	reSearchPage   = regexp.MustCompile(`[?&]page=(\d+)`)
	reSpeedSuffix  = regexp.MustCompile(`^(.+?)\s*\([^)]*[xX×][^)]*\)\s*(.+)$`)
	reStreamURL    = regexp.MustCompile(`(?i)https?://[^\s"'<>]+\.(?:mp3|aac|m4a|wav|ogg|flac)(?:\?[^\s"'<>]*)?`)
	reMP3Fallback  = regexp.MustCompile(`(?i)https?://[^\s"'<>]+\.mp3[^\s"'<>]*`)
	reAudioTagSrc  = regexp.MustCompile(`(?i)<audio[^>]+src\s*=\s*["']([^"']+)["']`)
	reSourceTagSrc = regexp.MustCompile(`(?i)<source[^>]+src\s*=\s*["']([^"']+)["']`)
	reLRCURL       = regexp.MustCompile(`(?i)https?://[^"'\s<>]+\.lrc[^"'\s<>]*`)
	reAlbumQuoted  = []*regexp.Regexp{
		regexp.MustCompile(`所属专辑\s*《([^》]{1,200})》`),
		regexp.MustCompile(`所属专辑\s*[\[【]([^\]}】]{1,200})[\]】]`),
		regexp.MustCompile(`专辑\s*《([^》]{1,200})》`),
		regexp.MustCompile(`"album"\s*:\s*"([^"\\]+)"`),
		regexp.MustCompile(`"albumName"\s*:\s*"([^"\\]+)"`),
		regexp.MustCompile(`"zhuanji"\s*:\s*"([^"\\]+)"`),
	}
	reAlbumLine = regexp.MustCompile(`专辑\s*[：:]\s*([^\n\r<]{1,200})`)
	reDurMMSS   = regexp.MustCompile(`时长\s*[：:]\s*(\d{1,2})\s*:\s*(\d{2})`)
	reDurHHMMSS = regexp.MustCompile(`时长\s*[：:]\s*(\d+)\s*[:：]\s*(\d{1,2})\s*[:：]\s*(\d{2})`)
	reAnyTime   = regexp.MustCompile(`\b(\d{1,2}):(\d{2})\b`)
)

// SearchResult is the normalized PJMP3 search card consumed by the app shell.
type SearchResult struct {
	SourceID string  `json:"source_id"`
	Title    string  `json:"title"`
	Artist   string  `json:"artist"`
	Album    string  `json:"album"`
	DurationMS int64 `json:"duration_ms"`
	CoverURL *string `json:"cover_url"`
}

// NormalizeImageURL maps relative PJMP3 image paths into stable absolute URLs.
func NormalizeImageURL(raw *string) *string {
	if raw == nil {
		return nil
	}
	value := strings.TrimSpace(*raw)
	if value == "" {
		return nil
	}
	switch {
	case strings.HasPrefix(value, "//"):
		out := "https:" + value
		return &out
	case strings.HasPrefix(value, "/"):
		out := strings.TrimRight(config.BaseURL, "/") + value
		return &out
	case strings.HasPrefix(value, "http://"), strings.HasPrefix(value, "https://"):
		return &value
	default:
		out := strings.TrimRight(config.BaseURL, "/") + "/" + strings.TrimLeft(value, "/")
		return &out
	}
}
