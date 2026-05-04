package cloudplayer

import (
	"path/filepath"
	"strconv"
	"strings"
	"time"

	gcache "github.com/lfhy/cache"

	"cloudplayer/backend/core/cloudplayer/config"
	"cloudplayer/backend/core/cloudplayer/musicsource"
)

const (
	searchCacheEntryLimit = 96
	searchCachePrefix     = "search:"
	searchPageCachePrefix = searchCachePrefix + "page:v1:"
	searchMetaCachePrefix = searchCachePrefix + "meta:v1:"
)

func searchCacheDir() string {
	return filepath.Join(config.ConfigDir(), "search_cache")
}

func InitSearchCacheStore() {
	gcache.InitLRUCache(
		gcache.WithDir(searchCacheDir()),
		gcache.WithCapacity(searchCacheEntryLimit),
		gcache.WithCleanupInterval(time.Minute),
	)
}

func SearchCacheKey(providerKey, keyword string, page uint32) string {
	return searchPageCachePrefix + strings.ToLower(strings.TrimSpace(providerKey)) + "|" + strings.TrimSpace(keyword) + "|" + uint32String(page)
}

func SearchSongMetadataCacheKey(sourceID string) string {
	return searchMetaCachePrefix + musicsource.CanonicalSourceID(sourceID)
}

func uint32String(value uint32) string {
	return strconv.FormatUint(uint64(value), 10)
}

// SearchCache wraps lfhy/cache so the rest of the service keeps a narrow API.
type SearchCache struct{}

func NewSearchCache() *SearchCache {
	InitSearchCacheStore()
	return &SearchCache{}
}

func (c *SearchCache) Get(key string) (SearchResponse, bool) {
	response, ok := gcache.Get[SearchResponse](key)
	if !ok {
		return SearchResponse{}, false
	}
	return cloneSearchResponse(response), true
}

func (c *SearchCache) Set(key string, response SearchResponse, ttl time.Duration) {
	seconds := int(ttl / time.Second)
	if seconds <= 0 {
		seconds = int((24 * time.Hour) / time.Second)
	}
	gcache.Set(key, cloneSearchResponse(response), seconds)
}

func (c *SearchCache) GetSongMetadata(key string) (SearchSongMetadataRow, bool) {
	return gcache.Get[SearchSongMetadataRow](key)
}

func (c *SearchCache) SetSongMetadata(key string, row SearchSongMetadataRow, ttl time.Duration) {
	seconds := int(ttl / time.Second)
	if seconds <= 0 {
		seconds = int((24 * time.Hour) / time.Second)
	}
	gcache.Set(key, row, seconds)
}

func (c *SearchCache) ClearSearchEntries() int {
	cleared := 0
	for _, key := range gcache.Keys() {
		if !strings.HasPrefix(key, searchCachePrefix) {
			continue
		}
		gcache.Delete(key)
		cleared += 1
	}
	return cleared
}

func cloneSearchResponse(response SearchResponse) SearchResponse {
	results := make([]musicsource.SearchResult, len(response.Results))
	copy(results, response.Results)
	return SearchResponse{
		Results: results,
		HasNext: response.HasNext,
	}
}
