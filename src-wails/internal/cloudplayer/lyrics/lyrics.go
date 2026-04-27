package lyrics

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"cloudplayer/internal/cloudplayer/config"
	"cloudplayer/internal/cloudplayer/musicsource"
)

type FetchRequest struct {
	PJMP3SourceID   *string  `json:"pjmp3SourceId,omitempty"`
	Title           string   `json:"title"`
	Artist          string   `json:"artist"`
	LocalPath       *string  `json:"localPath,omitempty"`
	DurationSeconds *float64 `json:"durationSeconds,omitempty"`
}

type provider int

const (
	providerPJMP3 provider = iota
	providerNetease
	providerLRCLib
)

func FetchSongLRCEnriched(client *http.Client, settings config.Settings, req FetchRequest) (*string, error) {
	for _, current := range parseOrder(settings.LyricsProviderOrder) {
		switch current {
		case providerPJMP3:
			if req.PJMP3SourceID == nil {
				continue
			}
			ref, err := musicsource.ParseSourceID(*req.PJMP3SourceID)
			if err != nil {
				return nil, err
			}
			text, err := ref.Provider.FetchSongLRCText(client, ref.RawID)
			if err != nil {
				return nil, err
			}
			if text != nil && looksLikeLRC(*text) {
				return text, nil
			}
		case providerNetease:
			var text *string
			base := strings.TrimSpace(settings.LyricsNeteaseAPIBase)
			if base != "" {
				var err error
				text, err = lyricNetease(client, base, req.Title, req.Artist)
				if err != nil {
					return nil, err
				}
			}
			if text == nil {
				var err error
				text, err = lyricNeteaseMusic163Portal(client, req.Title, req.Artist)
				if err != nil {
					return nil, err
				}
			}
			if text != nil {
				return text, nil
			}
		case providerLRCLib:
			if !settings.LyricsLRCLibEnabled {
				continue
			}
			text, err := lyricLRCLib(client, req.Title, req.Artist, req.DurationSeconds)
			if err != nil {
				return nil, err
			}
			if text != nil {
				return text, nil
			}
		}
	}
	return nil, nil
}

func lyricNeteaseMusic163Portal(client *http.Client, title, artist string) (*string, error) {
	values := url.Values{}
	values.Set("s", strings.TrimSpace(artist+" "+title))
	values.Set("type", "1")
	values.Set("limit", "8")
	searchReq, err := http.NewRequest(http.MethodGet, "https://music.163.com/api/search/get/web?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	applyNeteasePortalHeaders(searchReq)
	searchResp, err := client.Do(searchReq)
	if err != nil {
		return nil, err
	}
	defer searchResp.Body.Close()
	if searchResp.StatusCode < 200 || searchResp.StatusCode >= 300 {
		return nil, nil
	}
	var searchJSON map[string]any
	if err := json.NewDecoder(searchResp.Body).Decode(&searchJSON); err != nil {
		return nil, err
	}
	if code, ok := searchJSON["code"].(float64); ok && int(code) != 200 {
		return nil, nil
	}
	id := firstID(searchJSON["result"], "/songs/0/id")
	if id == "" {
		id = firstID(searchJSON["result"], "/songs/0/song/id")
	}
	if id == "" {
		return nil, nil
	}

	lyricValues := url.Values{}
	lyricValues.Set("id", id)
	lyricValues.Set("lv", "-1")
	lyricValues.Set("kv", "-1")
	lyricValues.Set("tv", "-1")
	lyricReq, err := http.NewRequest(http.MethodGet, "https://music.163.com/api/song/lyric?"+lyricValues.Encode(), nil)
	if err != nil {
		return nil, err
	}
	applyNeteasePortalHeaders(lyricReq)
	lyricResp, err := client.Do(lyricReq)
	if err != nil {
		return nil, err
	}
	defer lyricResp.Body.Close()
	if lyricResp.StatusCode < 200 || lyricResp.StatusCode >= 300 {
		return nil, nil
	}
	var lyricJSON map[string]any
	if err := json.NewDecoder(lyricResp.Body).Decode(&lyricJSON); err != nil {
		return nil, err
	}
	if value := nestedString(lyricJSON, "lrc", "lyric"); looksLikeLRC(value) {
		return &value, nil
	}
	if value := stringValue(lyricJSON["lrc"]); looksLikeLRC(value) {
		return &value, nil
	}
	return nil, nil
}

func applyNeteasePortalHeaders(request *http.Request) {
	request.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	request.Header.Set("Referer", "https://music.163.com/")
	request.Header.Set("Accept", "application/json, text/plain, */*")
}

func parseOrder(value string) []provider {
	var result []provider
	for _, item := range strings.Split(value, ",") {
		switch strings.ToLower(strings.TrimSpace(item)) {
		case "pjmp3":
			result = append(result, providerPJMP3)
		case "netease":
			result = append(result, providerNetease)
		case "lrclib":
			result = append(result, providerLRCLib)
		}
	}
	if len(result) == 0 {
		return []provider{providerPJMP3, providerLRCLib}
	}
	return result
}

func looksLikeLRC(text string) bool {
	trimmed := strings.TrimLeft(text, " \t\r\n")
	return strings.HasPrefix(trimmed, "[") ||
		strings.Contains(text, "[00:") ||
		strings.Contains(text, "[01:") ||
		strings.Contains(text, "[02:")
}

func lyricLRCLib(client *http.Client, title, artist string, durationSeconds *float64) (*string, error) {
	values := url.Values{}
	values.Set("track_name", title)
	values.Set("artist_name", artist)
	if durationSeconds != nil && *durationSeconds > 0 {
		values.Set("duration", fmt.Sprintf("%.0f", *durationSeconds))
	}
	request, err := http.NewRequest(http.MethodGet, "https://lrclib.net/api/get?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, nil
	}
	var payload struct {
		SyncedLyrics string `json:"syncedLyrics"`
		PlainLyrics  string `json:"plainLyrics"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if looksLikeLRC(payload.SyncedLyrics) {
		return &payload.SyncedLyrics, nil
	}
	if looksLikeLRC(payload.PlainLyrics) {
		return &payload.PlainLyrics, nil
	}
	return nil, nil
}

func lyricNetease(client *http.Client, apiBase, title, artist string) (*string, error) {
	base := strings.TrimRight(strings.TrimSpace(apiBase), "/")
	if base == "" {
		return nil, nil
	}

	searchValues := url.Values{}
	searchValues.Set("keywords", strings.TrimSpace(artist+" "+title))
	searchValues.Set("type", "1")
	searchValues.Set("limit", "5")
	searchReq, err := http.NewRequest(http.MethodGet, base+"/cloudsearch?"+searchValues.Encode(), nil)
	if err != nil {
		return nil, err
	}
	searchResp, err := client.Do(searchReq)
	if err != nil {
		return nil, err
	}
	defer searchResp.Body.Close()
	if searchResp.StatusCode < 200 || searchResp.StatusCode >= 300 {
		return nil, nil
	}
	var searchJSON map[string]any
	if err := json.NewDecoder(searchResp.Body).Decode(&searchJSON); err != nil {
		return nil, err
	}

	id := firstID(searchJSON["result"], "/songs/0/id")
	if id == "" {
		id = firstID(searchJSON, "/songs/0/id")
	}
	if id == "" {
		return nil, nil
	}

	lyricValues := url.Values{}
	lyricValues.Set("id", id)
	lyricReq, err := http.NewRequest(http.MethodGet, base+"/lyric?"+lyricValues.Encode(), nil)
	if err != nil {
		return nil, err
	}
	lyricResp, err := client.Do(lyricReq)
	if err != nil {
		return nil, err
	}
	defer lyricResp.Body.Close()
	if lyricResp.StatusCode < 200 || lyricResp.StatusCode >= 300 {
		return nil, nil
	}
	var lyricJSON map[string]any
	if err := json.NewDecoder(lyricResp.Body).Decode(&lyricJSON); err != nil {
		return nil, err
	}
	if value := nestedString(lyricJSON, "lrc", "lyric"); looksLikeLRC(value) {
		return &value, nil
	}
	if value := stringValue(lyricJSON["lrc"]); looksLikeLRC(value) {
		return &value, nil
	}
	return nil, nil
}

func firstID(root any, path string) string {
	if path == "" {
		return ""
	}
	current := root
	for _, part := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		if part == "" {
			continue
		}
		switch typed := current.(type) {
		case map[string]any:
			current = typed[part]
		case []any:
			index := parseIndex(part)
			if index < 0 || index >= len(typed) {
				return ""
			}
			current = typed[index]
		default:
			return ""
		}
	}
	return stringValue(current)
}

func nestedString(root map[string]any, keys ...string) string {
	var current any = root
	for _, key := range keys {
		typed, ok := current.(map[string]any)
		if !ok {
			return ""
		}
		current = typed[key]
	}
	return stringValue(current)
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return fmt.Sprintf("%.0f", typed)
	case json.Number:
		return typed.String()
	case int64:
		return fmt.Sprintf("%d", typed)
	case int:
		return fmt.Sprintf("%d", typed)
	default:
		return ""
	}
}

func parseIndex(value string) int {
	result := 0
	for _, r := range value {
		if r < '0' || r > '9' {
			return -1
		}
		result = result*10 + int(r-'0')
	}
	return result
}
