package pjmp3

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"cloudplayer/internal/cloudplayer/config"
)

var previewCacheExts = []string{".mp3", ".m4a", ".aac", ".flac", ".ogg", ".wav"}

// Preview helpers handle the PJMP3试听缓存 lifecycle used by the player.
func PreviewAudioCacheDir() string {
	return filepath.Join(os.TempDir(), "cloudplayer_tauri_audio")
}

func PreviewCachePathIfExists(songID string) string {
	name := previewCacheName(songID)
	if name == "" {
		return ""
	}
	dir := PreviewAudioCacheDir()
	for _, ext := range previewCacheExts {
		path := filepath.Join(dir, "preview_"+name+ext)
		info, err := os.Stat(path)
		if err == nil && !info.IsDir() && info.Size() > 0 {
			return path
		}
	}
	return ""
}

func FetchSongPageHTML(client *http.Client, songID string) (string, error) {
	sid := strings.TrimSpace(songID)
	if sid == "" {
		return "", fmt.Errorf("invalid song id")
	}
	requestURL := fmt.Sprintf("%s/song.php?id=%s", strings.TrimRight(config.BaseURL, "/"), url.QueryEscape(sid))
	request, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return "", err
	}
	applyPJMP3PageHeaders(request, strings.TrimRight(config.BaseURL, "/")+"/")
	body, err := fetchPJMP3PageBytes(client, request)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func FetchPreviewURL(client *http.Client, songID string) (string, error) {
	html, err := FetchSongPageHTML(client, songID)
	if err != nil {
		return "", err
	}
	urls := ExtractStreamURLsFromSongHTML(html)
	if len(urls) == 0 {
		return "", nil
	}
	return urls[0], nil
}

func CachePreviewAudioFile(client *http.Client, songID string) (string, error) {
	sid := strings.TrimSpace(songID)
	if sid == "" {
		return "", fmt.Errorf("无效的歌曲 ID")
	}
	if err := os.MkdirAll(PreviewAudioCacheDir(), 0o755); err != nil {
		return "", err
	}
	name := previewCacheName(sid)
	songPage := fmt.Sprintf("%s/song.php?id=%s", strings.TrimRight(config.BaseURL, "/"), sid)

	const rounds = 6
	for round := 0; round < rounds; round++ {
		html, err := FetchSongPageHTML(client, sid)
		if err != nil {
			return "", err
		}
		urls := ExtractStreamURLsFromSongHTML(html)
		sort.Slice(urls, func(i, j int) bool {
			left := strings.Contains(strings.ToLower(urls[i]), "er-sycdn")
			right := strings.Contains(strings.ToLower(urls[j]), "er-sycdn")
			return !left && right
		})
		if len(urls) == 0 {
			if round+1 < rounds {
				time.Sleep(220 * time.Millisecond)
			}
			continue
		}
		for _, mediaURL := range urls {
			ext := previewFileExtensionForURL(mediaURL)
			path := filepath.Join(PreviewAudioCacheDir(), "preview_"+name+ext)
			for _, candidate := range expandMP3URLCandidates(mediaURL) {
				bytes, err := downloadMP3Bytes(client, candidate, songPage)
				if err != nil {
					continue
				}
				if err := validateAudioBytes(bytes); err != nil {
					continue
				}
				if err := os.WriteFile(path, bytes, 0o644); err != nil {
					return "", err
				}
				return path, nil
			}
		}
		if round+1 < rounds {
			time.Sleep(200 * time.Millisecond)
		}
	}
	return "", fmt.Errorf("无法下载试听：站点返回的试听链暂时不可用（多为酷我 CDN 410）。请再点一次播放或重新搜索后重试。")
}
