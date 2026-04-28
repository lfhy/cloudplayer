package main

import (
	"strconv"
	"strings"
	"sync"
	"time"

	"cloudplayer/internal/cloudplayer/musicsource"
)

const (
	searchCacheTTL        = 45 * time.Second
	searchCacheEntryLimit = 96
)

type searchCacheEntry struct {
	response  SearchResponse
	expiresAt time.Time
}

// SearchCache keeps recent successful search pages in memory to reduce repeated upstream requests.
type SearchCache struct {
	mu      sync.RWMutex
	entries map[string]searchCacheEntry
}

func NewSearchCache() *SearchCache {
	return &SearchCache{entries: make(map[string]searchCacheEntry)}
}

func SearchCacheKey(providerKey, keyword string, page uint32) string {
	return strings.ToLower(strings.TrimSpace(providerKey)) + "|" + strings.TrimSpace(keyword) + "|" + uint32String(page)
}

func uint32String(value uint32) string {
	return strconv.FormatUint(uint64(value), 10)
}

func (c *SearchCache) Get(key string) (SearchResponse, bool) {
	now := time.Now()
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok {
		return SearchResponse{}, false
	}
	if !entry.expiresAt.After(now) {
		c.mu.Lock()
		delete(c.entries, key)
		c.mu.Unlock()
		return SearchResponse{}, false
	}
	return cloneSearchResponse(entry.response), true
}

func (c *SearchCache) Set(key string, response SearchResponse) {
	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.entries) >= searchCacheEntryLimit {
		c.evictLocked(now)
	}
	c.entries[key] = searchCacheEntry{
		response:  cloneSearchResponse(response),
		expiresAt: now.Add(searchCacheTTL),
	}
}

func (c *SearchCache) evictLocked(now time.Time) {
	for key, entry := range c.entries {
		if !entry.expiresAt.After(now) {
			delete(c.entries, key)
		}
	}
	if len(c.entries) < searchCacheEntryLimit {
		return
	}
	var oldestKey string
	var oldestTime time.Time
	for key, entry := range c.entries {
		if oldestKey == "" || entry.expiresAt.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.expiresAt
		}
	}
	if oldestKey != "" {
		delete(c.entries, oldestKey)
	}
}

func cloneSearchResponse(response SearchResponse) SearchResponse {
	results := make([]musicsource.SearchResult, len(response.Results))
	copy(results, response.Results)
	return SearchResponse{
		Results: results,
		HasNext: response.HasNext,
	}
}
