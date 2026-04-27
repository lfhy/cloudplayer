package sharelink

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"cloudplayer/internal/cloudplayer/importplaylist"
)

const (
	neteaseReferer = "https://music.163.com/"
	qqReferer      = "https://y.qq.com/"
)

var (
	reFirstURL          = regexp.MustCompile(`https?://[^\s<>"']+`)
	reNeteaseQueryID    = regexp.MustCompile(`[?&]id=(\d+)`)
	reNeteasePathID     = regexp.MustCompile(`/playlist[/?](\d+)`)
	reQQIDFallback      = regexp.MustCompile(`[?&]id=(\d+)`)
	reQQPlaylistPath    = regexp.MustCompile(`/playlist/(\d+)`)
	reQQPlaylistPathAlt = regexp.MustCompile(`(?i)playlist[/_](\d+)`)
)

// FetchOptions carries the optional cookies needed by some share-link providers.
type FetchOptions struct {
	NeteaseCookieEnabled bool
	NeteaseCookie        string
}

// FetchPlaylistFromShareURL routes the imported share link to the matching platform parser.
func FetchPlaylistFromShareURL(client *http.Client, rawURL string, options FetchOptions) (string, []importplaylist.ImportedTrackDTO, error) {
	value := strings.TrimSpace(rawURL)
	if value == "" {
		return "", nil, fmt.Errorf("链接为空")
	}
	normalized := value
	if !strings.HasPrefix(normalized, "http://") && !strings.HasPrefix(normalized, "https://") {
		if match := reFirstURL.FindString(normalized); match != "" {
			normalized = match
		}
	}

	switch DetectPlatform(normalized) {
	case "netease":
		return fetchNeteasePlaylist(client, normalized, options)
	case "qq":
		return fetchQQPlaylist(client, normalized)
	default:
		return "", nil, fmt.Errorf("暂只支持网易云音乐、QQ 音乐的分享链接（music.163.com / y.qq.com）。")
	}
}

// DetectPlatform infers the music provider from a share-link string.
func DetectPlatform(value string) string {
	lower := strings.ToLower(value)
	switch {
	case strings.Contains(lower, "163.com"), strings.Contains(lower, "163cn"), strings.Contains(lower, "music.163"):
		return "netease"
	case strings.Contains(lower, "qq.com"):
		return "qq"
	default:
		return ""
	}
}
