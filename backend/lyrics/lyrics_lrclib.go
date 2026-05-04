package lyrics

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// LRCLib helpers stay separate because they are optional and easy to disable from settings.
func lrclibSearchHits(client *http.Client, keyword string, durationMS *int64) ([]lrclibHit, error) {
	request, err := http.NewRequest(http.MethodGet, "https://lrclib.net/api/search", nil)
	if err != nil {
		return nil, err
	}
	values := request.URL.Query()
	values.Set("q", keyword)
	request.URL.RawQuery = values.Encode()

	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("lrclib search http %d", response.StatusCode)
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	items, ok := payload.([]any)
	if !ok {
		items = arrayAt(payload, "/results")
	}

	out := make([]lrclibHit, 0, len(items))
	for _, item := range items {
		id, ok := numberValue(pointerValue(item, "/id"))
		if !ok || id <= 0 {
			continue
		}
		dms := int64(floatValue(pointerValue(item, "/duration")) * 1000)
		if durationMS != nil && *durationMS > 0 && dms > 0 && absInt64(*durationMS-dms) > 12_000 {
			continue
		}
		out = append(out, lrclibHit{
			ID:         id,
			Title:      stringValue(pointerValue(item, "/trackName")),
			Artist:     stringValue(pointerValue(item, "/artistName")),
			Album:      stringValue(pointerValue(item, "/albumName")),
			DurationMS: dms,
		})
		if len(out) >= 20 {
			break
		}
	}
	return out, nil
}

func fetchLRCLibByID(client *http.Client, lrclibID int64) (*LyricsPayload, error) {
	request, err := http.NewRequest(http.MethodGet, fmt.Sprintf("https://lrclib.net/api/get/%d", lrclibID), nil)
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
	if value := strings.TrimSpace(stringValue(pointerValue(payload, "/syncedLyrics"))); looksLikeLRC(value) {
		result := lineOnlyPayload(value)
		return &result, nil
	}
	if value := strings.TrimSpace(stringValue(pointerValue(payload, "/plainLyrics"))); looksLikeLRC(value) {
		result := lineOnlyPayload(value)
		return &result, nil
	}
	return nil, nil
}
