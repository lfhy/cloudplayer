package musicsource

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	neteaseSearchLimit = 30
)

type neteaseProvider struct{}

func (neteaseProvider) Key() string {
	return ProviderNetease
}

func (neteaseProvider) Search(client *http.Client, keyword string, page uint32) ([]SearchResult, bool, error) {
	online := neteaseDefaultClient(client)
	pageIndex := neteasePage(page)
	offset := (pageIndex - 1) * neteaseSearchLimit
	response, err := neteasePortalSearch(online, strings.TrimSpace(keyword), offset, neteaseSearchLimit)
	if err != nil {
		request := map[string]any{
			"s":      strings.TrimSpace(keyword),
			"type":   "1",
			"offset": offset,
			"limit":  neteaseSearchLimit,
			"total":  true,
		}

		var fallback neteaseCloudSearchResponse
		if postErr := neteaseWEAPIPost(online, "https://music.163.com/weapi/cloudsearch/get/web", request, &fallback); postErr != nil {
			return nil, false, err
		}
		if fallback.Code != 200 {
			return nil, false, fmt.Errorf("netease search failed: code=%d", fallback.Code)
		}
		response.Result.SongCount = fallback.Result.SongCount
		response.Result.Songs = fallback.Result.Songs
	}

	results := make([]SearchResult, 0, len(response.Result.Songs))
	for _, song := range response.Result.Songs {
		row, ok := neteaseSongToSearchResult(song)
		if ok {
			results = append(results, row)
		}
	}
	hasNext := response.Result.SongCount > pageIndex*neteaseSearchLimit
	return results, hasNext, nil
}

func (neteaseProvider) FetchDailyRecommendations(client *http.Client, limit int) ([]SearchResult, error) {
	online := neteaseDefaultClient(client)

	rows, err := neteaseFetchPersonalizedNewsong(online)
	if err == nil && len(rows) > 0 {
		return neteaseClipRows(rows, limit), nil
	}

	rows, fallbackErr := neteaseFetchRecommendSongs(online)
	if fallbackErr != nil {
		if err != nil {
			return nil, fmt.Errorf("%v; fallback failed: %w", err, fallbackErr)
		}
		return nil, fallbackErr
	}
	return neteaseClipRows(rows, limit), nil
}

func (neteaseProvider) FetchPreviewURL(client *http.Client, rawID string) (string, error) {
	online := neteaseDefaultClient(client)
	songID, ok := parseNeteaseRawID(rawID)
	if !ok {
		return "", fmt.Errorf("invalid netease song id")
	}

	url, err := neteaseFetchPreviewURLV1(online, songID)
	if err == nil && strings.TrimSpace(url) != "" {
		return strings.TrimSpace(url), nil
	}
	fallbackURL, fallbackErr := neteaseFetchPreviewURLV0(online, songID)
	if fallbackErr == nil && strings.TrimSpace(fallbackURL) != "" {
		return strings.TrimSpace(fallbackURL), nil
	}
	if err != nil && fallbackErr != nil {
		return "", fmt.Errorf("%v; fallback failed: %v", err, fallbackErr)
	}
	return "", fmt.Errorf("netease preview url is empty")
}

func neteasePage(page uint32) int {
	if page < 1 {
		return 1
	}
	return int(page)
}

func neteaseFetchPersonalizedNewsong(client *http.Client) ([]SearchResult, error) {
	var response neteasePersonalizedSongResponse
	if err := neteaseWEAPIPost(client, "https://music.163.com/weapi/personalized/newsong", map[string]any{
		"type": "recommend",
	}, &response); err != nil {
		return nil, err
	}
	if response.Code != 200 {
		return nil, fmt.Errorf("netease personalized failed: code=%d", response.Code)
	}
	results := make([]SearchResult, 0, len(response.Result.Songs))
	for _, song := range response.Result.Songs {
		row, ok := neteaseSongToSearchResult(song)
		if ok {
			results = append(results, row)
		}
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("netease personalized returned empty")
	}
	return results, nil
}

func neteaseFetchRecommendSongs(client *http.Client) ([]SearchResult, error) {
	var response neteaseDailySongResponse
	if err := neteaseWEAPIPost(client, "https://music.163.com/weapi/v3/discovery/recommend/songs", map[string]any{}, &response); err != nil {
		return nil, err
	}
	if response.Code != 200 {
		return nil, fmt.Errorf("netease recommend songs failed: code=%d", response.Code)
	}
	results := make([]SearchResult, 0, len(response.Data.DailySongs))
	for _, song := range response.Data.DailySongs {
		row, ok := neteaseSongToSearchResult(song)
		if ok {
			results = append(results, row)
		}
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("netease recommend songs returned empty")
	}
	return results, nil
}

func neteaseFetchPreviewURLV1(client *http.Client, songID int64) (string, error) {
	var response neteasePlayerResponse
	if err := neteaseWEAPIPost(client, "https://music.163.com/weapi/song/enhance/player/url/v1", map[string]any{
		"ids":        "[" + strconv.FormatInt(songID, 10) + "]",
		"level":      "standard",
		"encodeType": "mp3",
	}, &response); err != nil {
		return "", err
	}
	return neteaseFirstPlayableURL(response)
}

func neteaseFetchPreviewURLV0(client *http.Client, songID int64) (string, error) {
	var response neteasePlayerResponse
	if err := neteaseWEAPIPost(client, "https://music.163.com/weapi/song/enhance/player/url", map[string]any{
		"ids": "[" + strconv.FormatInt(songID, 10) + "]",
		"br":  "128000",
	}, &response); err != nil {
		return "", err
	}
	return neteaseFirstPlayableURL(response)
}

func neteaseFirstPlayableURL(response neteasePlayerResponse) (string, error) {
	if response.Code != 200 {
		return "", fmt.Errorf("netease player failed: code=%d", response.Code)
	}
	for _, item := range response.Data {
		if item.Code == 200 && strings.TrimSpace(item.URL) != "" {
			return item.URL, nil
		}
	}
	return "", fmt.Errorf("netease player has no playable url")
}

func neteaseClipRows(rows []SearchResult, limit int) []SearchResult {
	if limit <= 0 || len(rows) <= limit {
		return rows
	}
	return rows[:limit]
}

func neteasePortalSearch(client *http.Client, keyword string, offset, limit int) (neteasePortalSearchResponse, error) {
	values := url.Values{}
	values.Set("s", keyword)
	values.Set("type", "1")
	values.Set("offset", strconv.Itoa(offset))
	values.Set("limit", strconv.Itoa(limit))

	request, err := http.NewRequest(http.MethodGet, "https://music.163.com/api/search/get/web?"+values.Encode(), nil)
	if err != nil {
		return neteasePortalSearchResponse{}, err
	}
	neteaseApplyPortalHeaders(request)

	response, err := client.Do(request)
	if err != nil {
		return neteasePortalSearchResponse{}, err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return neteasePortalSearchResponse{}, fmt.Errorf("netease portal search failed: http %d", response.StatusCode)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return neteasePortalSearchResponse{}, err
	}
	var payload neteasePortalSearchResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return neteasePortalSearchResponse{}, err
	}
	if payload.Code != 200 {
		return neteasePortalSearchResponse{}, fmt.Errorf("netease portal search failed: code=%d", payload.Code)
	}
	return payload, nil
}
