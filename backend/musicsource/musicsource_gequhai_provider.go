package musicsource

import (
	"fmt"
	"net/http"
)

// gequhaiProvider reserves the provider key and source-id namespace so the
// app can expose the source selector before the real scraping chain lands.
type gequhaiProvider struct{}

func (gequhaiProvider) Key() string {
	return ProviderGequhai
}

func (gequhaiProvider) Search(_ *http.Client, _ string, _ uint32) ([]SearchResult, bool, error) {
	return nil, false, fmt.Errorf("歌曲海源暂未接通搜索")
}

func (gequhaiProvider) FetchDailyRecommendations(_ *http.Client, _ int) ([]SearchResult, error) {
	return nil, fmt.Errorf("歌曲海源暂未接通每日推荐")
}

func (gequhaiProvider) FetchPreviewURL(_ *http.Client, _ string) (string, error) {
	return "", fmt.Errorf("歌曲海源暂未接通播放地址解析")
}

func (gequhaiProvider) CachePreviewAudioFile(_ *http.Client, _ string) (string, error) {
	return "", fmt.Errorf("歌曲海源暂未接通音频缓存")
}

func (gequhaiProvider) PreviewCachePathIfExists(_ string) string {
	return ""
}

func (gequhaiProvider) FetchSongLRCText(_ *http.Client, _ string) (*string, error) {
	return nil, fmt.Errorf("歌曲海源暂未接通歌词解析")
}

func (gequhaiProvider) FetchSongPageHTML(_ *http.Client, _ string) (string, error) {
	return "", fmt.Errorf("歌曲海源暂未接通歌曲详情页解析")
}

func (gequhaiProvider) ExtractAlbumFromSongHTML(_ string) string {
	return ""
}

func (gequhaiProvider) ExtractDurationMSFromSongHTML(_ string) int64 {
	return 0
}
