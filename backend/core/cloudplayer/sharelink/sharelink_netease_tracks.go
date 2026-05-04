package sharelink

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"cloudplayer/backend/core/cloudplayer/importplaylist"
)

// Track parsing helpers keep provider payload coercion out of the network path.
func neteasePlaylistTracks(client *http.Client, playlist map[string]any) ([]importplaylist.ImportedTrackDTO, error) {
	tracks := make([]importplaylist.ImportedTrackDTO, 0, len(arrayValue(playlist["tracks"])))
	for _, item := range arrayValue(playlist["tracks"]) {
		if track, ok := trackFromNeteaseItem(item); ok {
			tracks = append(tracks, track)
		}
	}
	if len(tracks) > 0 {
		return tracks, nil
	}
	ids := collectTrackIDs(playlist["trackIds"])
	if len(ids) == 0 {
		return nil, nil
	}
	return neteaseSongDetailBatch(client, ids)
}

func neteaseSongDetailBatch(client *http.Client, ids []int64) ([]importplaylist.ImportedTrackDTO, error) {
	result, err := neteaseSongDetailBatchGet(client, ids)
	if err != nil || len(result) > 0 {
		return result, err
	}
	return neteaseSongDetailBatchPost(client, ids)
}

func neteaseSongDetailBatchGet(client *http.Client, ids []int64) ([]importplaylist.ImportedTrackDTO, error) {
	var result []importplaylist.ImportedTrackDTO
	for start := 0; start < len(ids); start += 500 {
		end := start + 500
		if end > len(ids) {
			end = len(ids)
		}
		chunk := ids[start:end]
		idStrings := make([]string, 0, len(chunk))
		for _, id := range chunk {
			idStrings = append(idStrings, fmt.Sprintf("%d", id))
		}
		request, err := http.NewRequest(http.MethodGet, "https://music.163.com/api/song/detail?ids=["+strings.Join(idStrings, ",")+"]", nil)
		if err != nil {
			return nil, err
		}
		applyHeaders(request, neteaseHeaders(""))
		body, _, err := doRequest(client, request, 60*time.Second)
		if err != nil {
			return nil, err
		}
		chunkTracks, err := neteaseSongDetailTracks(body)
		if err != nil {
			return nil, err
		}
		result = append(result, chunkTracks...)
	}
	return result, nil
}

func neteaseSongDetailBatchPost(client *http.Client, ids []int64) ([]importplaylist.ImportedTrackDTO, error) {
	var result []importplaylist.ImportedTrackDTO
	for start := 0; start < len(ids); start += 500 {
		end := start + 500
		if end > len(ids) {
			end = len(ids)
		}
		chunk := ids[start:end]
		entries := make([]string, 0, len(chunk))
		for _, id := range chunk {
			entries = append(entries, fmt.Sprintf(`{"id":%d}`, id))
		}
		form := url.Values{}
		form.Set("c", "["+strings.Join(entries, ",")+"]")
		request, err := http.NewRequest(http.MethodPost, "https://music.163.com/api/v3/song/detail", strings.NewReader(form.Encode()))
		if err != nil {
			return nil, err
		}
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		applyHeaders(request, neteaseHeaders(""))
		body, _, err := doRequest(client, request, 60*time.Second)
		if err != nil {
			return nil, err
		}
		chunkTracks, err := neteaseSongDetailTracks(body)
		if err != nil {
			return nil, err
		}
		result = append(result, chunkTracks...)
	}
	return result, nil
}

func neteaseSongDetailTracks(body []byte) ([]importplaylist.ImportedTrackDTO, error) {
	payload := map[string]any{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	songs := arrayValue(payload["songs"])
	if len(songs) == 0 {
		songs = arrayValue(payload["data"])
	}
	tracks := make([]importplaylist.ImportedTrackDTO, 0, len(songs))
	for _, song := range songs {
		if track, ok := trackFromNeteaseItem(song); ok {
			tracks = append(tracks, track)
		}
	}
	return tracks, nil
}

func trackFromNeteaseItem(item any) (importplaylist.ImportedTrackDTO, bool) {
	track := importplaylist.ImportedTrackDTO{}
	data := mapValue(item)
	name := strings.TrimSpace(stringValue(data["name"]))
	if name == "" {
		return track, false
	}
	track.Title = name
	artists := make([]string, 0, len(arrayValue(data["ar"])))
	for _, artist := range arrayValue(data["ar"]) {
		name := strings.TrimSpace(stringValue(mapValue(artist)["name"]))
		if name != "" {
			artists = append(artists, name)
		}
	}
	track.Artist = strings.Join(artists, "/")
	album := mapValue(data["al"])
	track.Album = strings.TrimSpace(stringValue(album["name"]))
	if track.Album == "" {
		track.Album = strings.TrimSpace(stringValue(data["album"]))
	}
	return track, true
}

func collectTrackIDs(value any) []int64 {
	result := make([]int64, 0, len(arrayValue(value)))
	for _, item := range arrayValue(value) {
		object := mapValue(item)
		for _, key := range []string{"id", "songId", "song_id"} {
			if id := intValue(object[key]); id > 0 {
				result = append(result, id)
				break
			}
		}
	}
	return result
}

func extractNeteasePlaylistID(raw string) string {
	value := ensureURL(raw)
	if parsed, err := url.Parse(value); err == nil {
		for key, values := range parsed.Query() {
			if key == "id" && len(values) > 0 && values[0] != "" {
				return values[0]
			}
		}
		if match := reNeteasePathID.FindStringSubmatch(parsed.Path); len(match) > 1 {
			return match[1]
		}
		if fragment := parsed.Fragment; fragment != "" {
			queryPart := fragment
			if index := strings.LastIndex(fragment, "?"); index >= 0 {
				queryPart = fragment[index+1:]
			}
			for _, pair := range strings.Split(queryPart, "&") {
				key, value, ok := strings.Cut(pair, "=")
				if ok && key == "id" && value != "" {
					return value
				}
			}
		}
	}
	match := reNeteaseQueryID.FindStringSubmatch(raw)
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

func neteaseHeaders(cookie string) map[string]string {
	headers := map[string]string{
		"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Referer":         neteaseReferer,
		"Accept":          "application/json, text/plain, */*",
		"Accept-Language": "zh-CN,zh;q=0.9",
	}
	if strings.TrimSpace(cookie) != "" {
		headers["Cookie"] = strings.TrimSpace(cookie)
	}
	return headers
}
