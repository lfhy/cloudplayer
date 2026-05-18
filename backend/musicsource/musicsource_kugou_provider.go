package musicsource

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	kg "github.com/lfhy/kugou-music-api"
)

type kugouProvider struct{}

const kugouSearchTimeout = 10 * time.Second

func (kugouProvider) Key() string {
	return ProviderKugou
}

func (kugouProvider) Search(_ *http.Client, keyword string, page uint32) ([]SearchResult, bool, error) {
	client, err := newKugouClient()
	if err != nil {
		return nil, false, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), kugouSearchTimeout)
	defer cancel()
	resp, err := client.Search(ctx, kg.SearchRequest{
		Keywords: strings.TrimSpace(keyword),
		Page:     kugouPage(page),
		Pagesize: 30,
	})
	if err != nil {
		return nil, false, err
	}
	items := kugouFindSongItems(resp.Body)
	results := make([]SearchResult, 0, len(items))
	for _, item := range items {
		row, ok := kugouDailyTrackToSearchResult(item)
		if ok {
			results = append(results, row)
		}
	}
	hasNext := len(results) >= 30
	return results, hasNext, nil
}

func (kugouProvider) FetchDailyRecommendations(_ *http.Client, limit int) ([]SearchResult, error) {
	client, err := newKugouClient()
	if err != nil {
		return nil, err
	}
	resp, err := client.GetDailyRecommendGuest(context.Background(), map[string]string{})
	if err != nil {
		return nil, err
	}
	if resp == nil || resp.Body == nil {
		return nil, fmt.Errorf("empty daily recommend response")
	}
	items := kugouFindTrackItems(resp.Body)
	results := make([]SearchResult, 0, len(items))
	for _, item := range items {
		row, ok := kugouDailyTrackToSearchResult(item)
		if !ok {
			continue
		}
		results = append(results, row)
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("no valid tracks parsed from daily recommend")
	}
	if limit > 0 && len(results) > limit {
		results = results[:limit]
	}
	return results, nil
}

func kugouPage(page uint32) int {
	if page < 1 {
		return 1
	}
	return int(page)
}

func (kugouProvider) FetchPreviewURL(_ *http.Client, rawID string) (string, error) {
	hash, albumAudioID, err := parseKugouRawID(rawID)
	if err != nil {
		return "", err
	}
	client, err := newKugouClient()
	if err != nil {
		return "", err
	}
	return client.GetSongPlayURL(context.Background(), kg.SongPlayURLRequest{
		Hash:         hash,
		AlbumAudioID: albumAudioID,
		FreePart:     true,
	})
}
