package musicsource

import (
	"fmt"
	"net/http"
)

// gequhaiProvider scrapes gequhai.com search, play and lyric pages directly.
type gequhaiProvider struct{}

func (gequhaiProvider) Key() string {
	return ProviderGequhai
}

func (gequhaiProvider) Search(client *http.Client, keyword string, page uint32) ([]SearchResult, bool, error) {
	return gequhaiSearch(client, keyword, page)
}

func (gequhaiProvider) FetchDailyRecommendations(_ *http.Client, _ int) ([]SearchResult, error) {
	return nil, fmt.Errorf("歌曲海源暂不支持每日推荐")
}

func (gequhaiProvider) FetchPreviewURL(client *http.Client, rawID string) (string, error) {
	return gequhaiFetchPreviewURL(client, rawID)
}

func (gequhaiProvider) CachePreviewAudioFile(_ *http.Client, _ string) (string, error) {
	return "", nil
}

func (gequhaiProvider) PreviewCachePathIfExists(_ string) string {
	return ""
}

func (gequhaiProvider) FetchSongLRCText(client *http.Client, rawID string) (*string, error) {
	return gequhaiFetchSongLRCText(client, rawID)
}

func (gequhaiProvider) FetchSongPageHTML(client *http.Client, rawID string) (string, error) {
	return gequhaiFetchSongPageHTML(client, rawID)
}

func (gequhaiProvider) ExtractAlbumFromSongHTML(_ string) string {
	return ""
}

func (gequhaiProvider) ExtractDurationMSFromSongHTML(_ string) int64 {
	return 0
}
