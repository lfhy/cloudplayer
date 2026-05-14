package musicsource

import (
	"fmt"
	"net/http"
	"strings"
)

// Netease metadata methods use WEAPI detail/lyric endpoints and do not need HTML parsing.
func (neteaseProvider) CachePreviewAudioFile(_ *http.Client, _ string) (string, error) {
	return "", nil
}

func (neteaseProvider) PreviewCachePathIfExists(_ string) string {
	return ""
}

func (neteaseProvider) FetchSongLRCText(client *http.Client, rawID string) (*string, error) {
	online := neteaseDefaultClient(client)
	songID, ok := parseNeteaseRawID(rawID)
	if !ok {
		return nil, fmt.Errorf("invalid netease song id")
	}

	var response neteaseLyricResponse
	if err := neteaseWEAPIPost(online, "https://music.163.com/weapi/song/lyric", map[string]any{
		"id":      songID,
		"lv":      -1,
		"tv":      -1,
		"kv":      -1,
		"rv":      -1,
		"_nmclfl": 1,
	}, &response); err != nil {
		return nil, err
	}
	if response.Code != 200 {
		return nil, fmt.Errorf("netease lyric failed: code=%d", response.Code)
	}
	lyric := strings.TrimSpace(response.Lrc.Lyric)
	if lyric == "" {
		return nil, nil
	}
	return &lyric, nil
}

func (neteaseProvider) FetchSongPageHTML(client *http.Client, rawID string) (string, error) {
	_ = client
	_ = rawID
	return "", nil
}

func (neteaseProvider) ExtractAlbumFromSongHTML(_ string) string {
	return ""
}

func (neteaseProvider) ExtractDurationMSFromSongHTML(_ string) int64 {
	return 0
}
