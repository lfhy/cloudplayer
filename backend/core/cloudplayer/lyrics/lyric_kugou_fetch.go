package lyrics

import (
	"net/http"
	"strconv"
	"strings"
)

// Kugou search/fetch helpers resolve candidate IDs before payload decoding runs.
func albumAudioIDFromItem(item any) string {
	for _, key := range []string{"Scid", "ID", "AlbumAudioID"} {
		value := pointerValue(item, "/"+key)
		if number, ok := numberValue(value); ok && number != 0 {
			return strconv.FormatInt(number, 10)
		}
		text := strings.TrimSpace(stringValue(value))
		if text != "" && text != "0" {
			return text
		}
	}
	return ""
}

func fileHashFromItem(item any) string {
	for _, key := range []string{"FileHash", "HQFileHash", "SQFileHash"} {
		value := strings.TrimSpace(stringValue(pointerValue(item, "/"+key)))
		if value != "" {
			return value
		}
	}
	return ""
}

func parseKugouSearchLists(root any) []kugouSearchHit {
	items := arrayAt(root, "/data/lists")
	out := make([]kugouSearchHit, 0, len(items))
	for _, item := range items {
		albumAudioID := albumAudioIDFromItem(item)
		if albumAudioID == "" {
			continue
		}
		artists := arrayAt(item, "/Singers")
		artistNames := make([]string, 0, len(artists))
		for _, artist := range artists {
			name := strings.TrimSpace(stringValue(pointerValue(artist, "/name")))
			if name != "" {
				artistNames = append(artistNames, name)
			}
		}
		artist := strings.Join(artistNames, "、")
		if artist == "" {
			artist = stringValue(pointerValue(item, "/SingerName"))
		}
		out = append(out, kugouSearchHit{
			AlbumAudioID: albumAudioID,
			FileHash:     fileHashFromItem(item),
			Title:        stringValue(pointerValue(item, "/SongName")),
			Artist:       artist,
			Album:        stringValue(pointerValue(item, "/AlbumName")),
			DurationMS:   int64Value(pointerValue(item, "/Duration")) * 1000,
		})
	}
	return out
}

func searchKugouSongs(client *http.Client, keyword string, page int) ([]kugouSearchHit, error) {
	trimmed := strings.TrimSpace(keyword)
	attempts := []string{trimmed}
	if lastParts := strings.Fields(trimmed); len(lastParts) > 0 {
		last := lastParts[len(lastParts)-1]
		if len([]rune(last)) >= 2 && last != trimmed {
			attempts = append(attempts, last)
		}
		if len(lastParts) >= 2 {
			reversed := append([]string(nil), lastParts...)
			for left, right := 0, len(reversed)-1; left < right; left, right = left+1, right-1 {
				reversed[left], reversed[right] = reversed[right], reversed[left]
			}
			reversedKeyword := strings.Join(reversed, " ")
			if reversedKeyword != trimmed {
				attempts = append(attempts, reversedKeyword)
			}
		}
	}

	var lastErr error
	sawOK := false
	for _, attempt := range attempts {
		payload, err := kgGet(client, kgComplexSearch, map[string]string{
			"sorttype": "0",
			"keyword":  attempt,
			"pagesize": "20",
			"page":     strconv.Itoa(page),
		}, "SearchSong", "x-router", "complexsearch.kugou.com")
		if err != nil {
			lastErr = err
			continue
		}
		sawOK = true
		out := parseKugouSearchLists(payload)
		if len(out) > 0 {
			return out, nil
		}
	}
	if !sawOK && lastErr != nil {
		return nil, lastErr
	}
	return []kugouSearchHit{}, nil
}

func kugouCandidatesArray(root any) []any {
	if items := arrayAt(root, "/candidates"); len(items) > 0 {
		return items
	}
	return arrayAt(root, "/data/candidates")
}

func jsonNumOrStrID(value any) string {
	if number, ok := numberValue(value); ok && number != 0 {
		return strconv.FormatInt(number, 10)
	}
	text := strings.TrimSpace(stringValue(value))
	if text == "" {
		return ""
	}
	return text
}

func kugouCandidateIDStr(candidate any) string {
	for _, key := range []string{"id", "Id", "ID"} {
		if value := jsonNumOrStrID(pointerValue(candidate, "/"+key)); value != "" {
			return value
		}
	}
	return ""
}

func kugouCandidateAccessKeyStr(candidate any) string {
	for _, key := range []string{"accesskey", "AccessKey", "access_key"} {
		value := strings.TrimSpace(stringValue(pointerValue(candidate, "/"+key)))
		if value != "" {
			return value
		}
	}
	return ""
}

func firstKugouLyricDownloadPair(root any) (string, string, bool) {
	for _, candidate := range kugouCandidatesArray(root) {
		id := kugouCandidateIDStr(candidate)
		accessKey := kugouCandidateAccessKeyStr(candidate)
		if id != "" && accessKey != "" {
			return id, accessKey, true
		}
	}
	return "", "", false
}

func kugouLyricSearchResponse(client *http.Client, baseURL string, params map[string]string) (any, error) {
	payload, err := kgLyricGet(client, baseURL, params)
	if err != nil {
		return nil, err
	}
	if len(kugouCandidatesArray(payload)) == 0 {
		return nil, nil
	}
	return payload, nil
}

func fetchKugouLyrics(client *http.Client, hit kugouSearchHit) (LyricsPayload, error) {
	if payload, err := fetchKugouLyricsViaSDK(hit); err == nil && strings.TrimSpace(payload.LRCText) != "" {
		return payload, nil
	}
	return fetchKugouLyricsFallback(client, hit)
}
