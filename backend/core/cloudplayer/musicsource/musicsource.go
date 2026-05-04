package musicsource

import (
	"fmt"
	"net/http"
	"strings"

	"cloudplayer/backend/core/cloudplayer/config"
	"cloudplayer/backend/core/cloudplayer/pjmp3"
)

// Source adapters translate the configured provider name into a concrete search implementation.
const (
	ProviderPJMP3      = "pjmp3"
	ProviderKugou      = "kugou"
	DefaultProviderKey = ProviderPJMP3
)

type SearchResult struct {
	SourceID   string  `json:"source_id"`
	Title      string  `json:"title"`
	Artist     string  `json:"artist"`
	Album      string  `json:"album"`
	DurationMS int64   `json:"duration_ms"`
	CoverURL   *string `json:"cover_url"`
}

type Provider interface {
	Key() string
	Search(client *http.Client, keyword string, page uint32) ([]SearchResult, bool, error)
	FetchPreviewURL(client *http.Client, rawID string) (string, error)
	CachePreviewAudioFile(client *http.Client, rawID string) (string, error)
	PreviewCachePathIfExists(rawID string) string
	FetchSongLRCText(client *http.Client, rawID string) (*string, error)
	FetchSongPageHTML(client *http.Client, rawID string) (string, error)
	ExtractAlbumFromSongHTML(html string) string
	ExtractDurationMSFromSongHTML(html string) int64
}

type SourceRef struct {
	Provider    Provider
	ProviderKey string
	RawID       string
	EncodedID   string
}

var providers = map[string]Provider{
	ProviderPJMP3: pjmp3Provider{},
	ProviderKugou: kugouProvider{},
}

func Current() Provider {
	provider, ok := ProviderByKey(config.LoadSettings().MusicSourceProvider)
	if ok {
		return provider
	}
	return providers[DefaultProviderKey]
}

func ProviderByKey(key string) (Provider, bool) {
	provider, ok := providers[normalizeProviderKey(key)]
	return provider, ok
}

func ParseSourceID(sourceID string) (SourceRef, error) {
	trimmed := strings.TrimSpace(sourceID)
	if trimmed == "" {
		return SourceRef{}, fmt.Errorf("无效的歌曲 ID")
	}

	key, rawID, encoded := splitSourceID(trimmed)
	if key == "" {
		provider := Current()
		return SourceRef{
			Provider:    provider,
			ProviderKey: provider.Key(),
			RawID:       trimmed,
			EncodedID:   EncodeSourceID(provider.Key(), trimmed),
		}, nil
	}

	provider, ok := ProviderByKey(key)
	if !ok {
		return SourceRef{}, fmt.Errorf("不支持的音乐源: %s", key)
	}
	if rawID == "" {
		return SourceRef{}, fmt.Errorf("无效的歌曲 ID")
	}
	return SourceRef{
		Provider:    provider,
		ProviderKey: provider.Key(),
		RawID:       rawID,
		EncodedID:   encoded,
	}, nil
}

func EncodeSourceID(providerKey, rawID string) string {
	key := normalizeProviderKey(providerKey)
	raw := strings.TrimSpace(rawID)
	if key == "" || raw == "" {
		return raw
	}
	return key + ":" + raw
}

func CanonicalSourceID(sourceID string) string {
	ref, err := ParseSourceID(sourceID)
	if err != nil {
		return strings.TrimSpace(sourceID)
	}
	return ref.EncodedID
}

func SameSourceID(left, right string) bool {
	leftID := CanonicalSourceID(left)
	rightID := CanonicalSourceID(right)
	return leftID != "" && leftID == rightID
}

func SafeCacheKey(sourceID string) string {
	value := CanonicalSourceID(sourceID)
	if value == "" {
		value = strings.TrimSpace(sourceID)
	}
	if value == "" {
		return "unknown"
	}

	var builder strings.Builder
	builder.Grow(len(value))
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		default:
			builder.WriteByte('_')
		}
	}

	result := strings.Trim(builder.String(), "_")
	if result == "" {
		return "unknown"
	}
	return result
}

func splitSourceID(sourceID string) (providerKey, rawID, encoded string) {
	index := strings.Index(sourceID, ":")
	if index <= 0 {
		return "", "", ""
	}

	key := normalizeProviderKey(sourceID[:index])
	raw := strings.TrimSpace(sourceID[index+1:])
	if key == "" || raw == "" {
		return key, raw, ""
	}
	return key, raw, key + ":" + raw
}

func normalizeProviderKey(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

type pjmp3Provider struct{}

func (pjmp3Provider) Key() string {
	return ProviderPJMP3
}

func (pjmp3Provider) Search(client *http.Client, keyword string, page uint32) ([]SearchResult, bool, error) {
	results, hasNext, err := pjmp3.SearchPjmp3(client, keyword, page)
	if err != nil {
		return nil, false, err
	}

	mapped := make([]SearchResult, 0, len(results))
	for _, item := range results {
		mapped = append(mapped, SearchResult{
			SourceID: EncodeSourceID(ProviderPJMP3, item.SourceID),
			Title:    item.Title,
			Artist:   item.Artist,
			Album:    item.Album,
			CoverURL: item.CoverURL,
		})
	}
	return mapped, hasNext, nil
}

func (pjmp3Provider) FetchPreviewURL(client *http.Client, rawID string) (string, error) {
	return pjmp3.FetchPreviewURL(client, rawID)
}

func (pjmp3Provider) CachePreviewAudioFile(client *http.Client, rawID string) (string, error) {
	return pjmp3.CachePreviewAudioFile(client, rawID)
}

func (pjmp3Provider) PreviewCachePathIfExists(rawID string) string {
	return pjmp3.PreviewCachePathIfExists(rawID)
}

func (pjmp3Provider) FetchSongLRCText(client *http.Client, rawID string) (*string, error) {
	return pjmp3.FetchSongLRCText(client, rawID)
}

func (pjmp3Provider) FetchSongPageHTML(client *http.Client, rawID string) (string, error) {
	return pjmp3.FetchSongPageHTML(client, rawID)
}

func (pjmp3Provider) ExtractAlbumFromSongHTML(html string) string {
	return pjmp3.ExtractAlbumFromSongHTML(html)
}

func (pjmp3Provider) ExtractDurationMSFromSongHTML(html string) int64 {
	return pjmp3.ExtractDurationMSFromSongHTML(html)
}
