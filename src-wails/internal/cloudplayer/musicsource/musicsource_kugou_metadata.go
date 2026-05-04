package musicsource

import "net/http"

// Kugou search payload already includes album and duration, so extra page metadata is not used here.
func (kugouProvider) CachePreviewAudioFile(_ *http.Client, rawID string) (string, error) {
	return "", nil
}

func (kugouProvider) PreviewCachePathIfExists(rawID string) string {
	_ = rawID
	return ""
}

func (kugouProvider) FetchSongLRCText(_ *http.Client, rawID string) (*string, error) {
	_ = rawID
	return nil, nil
}

func (kugouProvider) FetchSongPageHTML(_ *http.Client, rawID string) (string, error) {
	_ = rawID
	return "", nil
}

func (kugouProvider) ExtractAlbumFromSongHTML(html string) string {
	_ = html
	return ""
}

func (kugouProvider) ExtractDurationMSFromSongHTML(html string) int64 {
	_ = html
	return 0
}
