package lyrics

// Legacy Kugou lyric HTTP fallback stays separate from the SDK path.

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"strconv"
)

func fetchKugouLyricsFallback(client *http.Client, hit kugouSearchHit) (LyricsPayload, error) {
	durationMS := hit.DurationMS
	if durationMS <= 0 {
		durationMS = 999_000
	}
	keywordDash := fmt.Sprintf("%s - %s", hit.Artist, hit.Title)
	keywordSpace := fmt.Sprintf("%s %s", hit.Artist, hit.Title)

	attempts := make([]map[string]string, 0, 5)
	attempts = append(attempts, map[string]string{
		"album_audio_id": hit.AlbumAudioID,
		"duration":       strconv.FormatInt(durationMS, 10),
		"keyword":        keywordDash,
		"lrctxt":         "1",
		"man":            "yes",
	})
	if hit.FileHash != "" {
		attempts[0]["hash"] = hit.FileHash
		attempts = append(attempts, map[string]string{
			"duration": strconv.FormatInt(durationMS, 10),
			"hash":     hit.FileHash,
			"keyword":  keywordDash,
			"lrctxt":   "1",
			"man":      "yes",
		})
	}
	for _, keyword := range []string{keywordDash, keywordSpace, hit.Title} {
		attempts = append(attempts, map[string]string{
			"keyword":  keyword,
			"duration": strconv.FormatInt(durationMS, 10),
			"client":   "pc",
			"ver":      "1",
			"man":      "yes",
		})
	}

	urls := []string{"https://lyrics.kugou.com/v1/search", "http://lyrics.kugou.com/search"}
	var pairID, pairAccessKey string
	var lastErr error
	found := false
	for _, attempt := range attempts {
		for _, baseURL := range urls {
			payload, err := kugouLyricSearchResponse(client, baseURL, attempt)
			if err != nil {
				lastErr = err
				continue
			}
			if payload == nil {
				continue
			}
			if id, accessKey, ok := firstKugouLyricDownloadPair(payload); ok {
				pairID, pairAccessKey, found = id, accessKey, true
				break
			}
		}
		if found {
			break
		}
	}
	if !found {
		if lastErr != nil {
			return LyricsPayload{}, lastErr
		}
		return LyricsPayload{}, fmt.Errorf("kg: no lyric candidates after all search attempts")
	}

	download, err := kgLyricGet(client, "http://lyrics.kugou.com/download", map[string]string{
		"accesskey": pairAccessKey,
		"charset":   "utf8",
		"client":    "mobi",
		"fmt":       "krc",
		"id":        pairID,
		"ver":       "1",
	})
	if err != nil {
		return LyricsPayload{}, err
	}
	content := stringValue(pointerValue(download, "/content"))
	if content == "" {
		return LyricsPayload{}, fmt.Errorf("kg: no content")
	}
	contentType := int64Value(pointerValue(download, "/contenttype"))
	if contentType == 2 {
		decoded, err := base64.StdEncoding.DecodeString(content)
		if err != nil {
			return LyricsPayload{}, err
		}
		return lineOnlyPayload(string(decoded)), nil
	}

	raw, err := base64.StdEncoding.DecodeString(content)
	if err != nil {
		return LyricsPayload{}, err
	}
	plain, err := krcDecrypt(raw)
	if err != nil {
		return LyricsPayload{}, err
	}
	return krcPlainToPayload(plain)
}
