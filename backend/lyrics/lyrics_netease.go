package lyrics

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// Netease helpers keep source-specific search and lyric fetch behavior in one place.
func neteaseSearchHits(client *http.Client, keyword string, limit int) ([]neteaseHit, error) {
	values := url.Values{}
	values.Set("s", strings.TrimSpace(keyword))
	values.Set("type", "1")
	values.Set("limit", strconv.Itoa(limit))
	request, err := http.NewRequest(http.MethodGet, "https://music.163.com/api/search/get/web?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	applyNeteasePortalHeaders(request)
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("netease search http %d", response.StatusCode)
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if code, ok := numberValue(pointerValue(payload, "/code")); ok && code != 200 {
		return []neteaseHit{}, nil
	}

	items := arrayAt(payload, "/result/songs")
	out := make([]neteaseHit, 0, len(items))
	for _, item := range items {
		id, ok := numberValue(pointerValue(item, "/id"))
		if !ok || id <= 0 {
			continue
		}
		artists := arrayAt(item, "/ar")
		artistNames := make([]string, 0, len(artists))
		for _, artist := range artists {
			name := strings.TrimSpace(stringValue(pointerValue(artist, "/name")))
			if name != "" {
				artistNames = append(artistNames, name)
			}
		}
		out = append(out, neteaseHit{
			ID:         id,
			Title:      stringValue(pointerValue(item, "/name")),
			Artist:     strings.Join(artistNames, " / "),
			Album:      stringValue(pointerValue(item, "/al/name")),
			DurationMS: int64Value(pointerValue(item, "/dt")),
		})
	}
	return out, nil
}

func fetchNeteaseLyricsBySongID(client *http.Client, apiBase string, songID int64) (*LyricsPayload, error) {
	base := strings.TrimSpace(strings.TrimRight(apiBase, "/"))
	if base != "" {
		if payload, err := lyricNeteaseAPILyricNew(client, base, songID); err == nil && payload != nil {
			return payload, nil
		}
		if payload, err := fetchNeteaseLyricsFromCompatAPI(client, base, songID); err == nil && payload != nil {
			return payload, nil
		}
	}
	return fetchNeteasePortalLyrics(client, songID)
}

func lyricNeteaseAPILyricNew(client *http.Client, apiBase string, songID int64) (*LyricsPayload, error) {
	values := url.Values{}
	values.Set("id", strconv.FormatInt(songID, 10))
	request, err := http.NewRequest(http.MethodGet, apiBase+"/lyric/new?"+values.Encode(), nil)
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

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if raw := yrcRawFromLyricNewJSON(payload); raw != "" {
		if result := parseYRCBody(raw); result != nil {
			return result, nil
		}
	}
	if lyric := lrcLineFromNeteaseLyricValue(payload); looksLikeLRC(lyric) {
		result := lineOnlyPayload(lyric)
		return &result, nil
	}
	return nil, nil
}

func fetchNeteaseLyricsFromCompatAPI(client *http.Client, apiBase string, songID int64) (*LyricsPayload, error) {
	values := url.Values{}
	values.Set("id", strconv.FormatInt(songID, 10))
	request, err := http.NewRequest(http.MethodGet, apiBase+"/lyric?"+values.Encode(), nil)
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

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if lyric := lrcLineFromNeteaseLyricValue(payload); looksLikeLRC(lyric) {
		result := lineOnlyPayload(lyric)
		return &result, nil
	}
	return nil, nil
}

func fetchNeteasePortalLyrics(client *http.Client, songID int64) (*LyricsPayload, error) {
	values := url.Values{}
	values.Set("id", strconv.FormatInt(songID, 10))
	values.Set("lv", "-1")
	values.Set("kv", "-1")
	values.Set("tv", "-1")
	request, err := http.NewRequest(http.MethodGet, "https://music.163.com/api/song/lyric?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	applyNeteasePortalHeaders(request)
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, nil
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if lyric := lrcLineFromNeteaseLyricValue(payload); looksLikeLRC(lyric) {
		result := lineOnlyPayload(lyric)
		return &result, nil
	}
	return nil, nil
}

func applyNeteasePortalHeaders(request *http.Request) {
	request.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	request.Header.Set("Referer", "https://music.163.com/")
	request.Header.Set("Accept", "application/json, text/plain, */*")
}
