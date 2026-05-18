package cloudplayer

// Search helpers own provider failover so source switching stays separate from playback resolution.

import (
	"fmt"
	"log"
	"strings"

	"cloudplayer/backend/cache"
	"cloudplayer/backend/config"
	"cloudplayer/backend/model"
	"cloudplayer/backend/musicsource"
)

var currentSearchProvider = musicsource.Current
var searchProviderByKey = musicsource.ProviderByKey

func (s *CloudPlayerService) SearchSongs(keyword string, page uint32) (model.SearchResponse, error) {
	trimmed := strings.TrimSpace(keyword)
	if trimmed == "" {
		return model.SearchResponse{}, fmt.Errorf("search keyword is required")
	}

	resolvedPage := maxUint32(page, 1)
	settings := config.LoadSettings()
	primaryProvider := currentSearchProvider()
	if primaryProvider == nil {
		return model.SearchResponse{}, fmt.Errorf("music source unavailable")
	}

	providerKeys := searchProviderFailoverOrder(primaryProvider.Key(), settings.PlaybackFallbackChain)
	failures := make([]string, 0, len(providerKeys))
	for index, providerKey := range providerKeys {
		provider, ok := searchProviderByKey(providerKey)
		if !ok {
			continue
		}

		cacheKey := cache.SearchCacheKey(provider.Key(), trimmed, resolvedPage)
		if cached, ok := s.state.SearchCache.Get(cacheKey); ok {
			persisted := false
			if index > 0 {
				persisted = persistSearchProviderSwitch(settings, primaryProvider.Key(), provider.Key())
			}
			return decorateSearchResponse(cached, primaryProvider.Key(), provider.Key(), index > 0, persisted), nil
		}

		s.state.RateLimiter.AcquireSlot()
		results, hasNext, err := provider.Search(s.state.HTTP(), trimmed, resolvedPage)
		if err != nil {
			log.Printf("SearchSongs failed: keyword=%q page=%d provider=%s err=%v", trimmed, resolvedPage, provider.Key(), err)
			failures = append(failures, searchProviderLabel(provider.Key())+" unavailable")
			continue
		}

		response := model.SearchResponse{
			Results: results,
			HasNext: hasNext,
		}
		s.state.SearchCache.Set(cacheKey, response, s.state.SearchCacheTTL)

		persisted := false
		if index > 0 {
			persisted = persistSearchProviderSwitch(settings, primaryProvider.Key(), provider.Key())
		}
		return decorateSearchResponse(response, primaryProvider.Key(), provider.Key(), index > 0, persisted), nil
	}

	if len(failures) > 0 {
		return model.SearchResponse{}, fmt.Errorf("search failed: %s", strings.Join(uniquePlaybackReasons(failures), "; "))
	}
	return model.SearchResponse{}, fmt.Errorf("search failed")
}

func decorateSearchResponse(response model.SearchResponse, primaryProviderKey, actualProviderKey string, fallbackApplied, providerPersisted bool) model.SearchResponse {
	response.ProviderKey = actualProviderKey
	response.FallbackApplied = fallbackApplied
	response.ProviderPersisted = providerPersisted
	if fallbackApplied {
		response.FailedProviderKey = primaryProviderKey
	}
	return response
}

func persistSearchProviderSwitch(settings config.Settings, failedProviderKey, nextProviderKey string) bool {
	if strings.TrimSpace(failedProviderKey) == "" || strings.TrimSpace(nextProviderKey) == "" {
		return false
	}
	if failedProviderKey == nextProviderKey {
		return false
	}
	if config.NormalizeMusicCollectionMode(settings.MusicCollectionMode) == config.MusicCollectionModeOnline {
		return false
	}

	normalizedNext := config.NormalizeMusicSourceProvider(nextProviderKey)
	if settings.MusicSourceProvider == normalizedNext {
		return false
	}

	settings.MusicSourceProvider = normalizedNext
	if err := config.SaveSettings(settings); err != nil {
		log.Printf("persist search provider switch failed: from=%s to=%s err=%v", failedProviderKey, normalizedNext, err)
		return false
	}
	log.Printf("search provider auto-switched: from=%s to=%s", failedProviderKey, normalizedNext)
	return true
}

func searchProviderFailoverOrder(primaryProviderKey, rawFallbackChain string) []string {
	baseOrder := strings.Split(config.NormalizePlaybackFallbackChain(rawFallbackChain), ",")
	normalizedPrimary := config.NormalizeMusicSourceProvider(primaryProviderKey)
	if normalizedPrimary == "" {
		normalizedPrimary = musicsource.DefaultProviderKey
	}

	result := make([]string, 0, len(baseOrder))
	seen := map[string]struct{}{}
	appendKey := func(key string) {
		normalized := config.NormalizeMusicSourceProvider(key)
		if normalized == "" {
			return
		}
		if _, ok := seen[normalized]; ok {
			return
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}

	appendKey(normalizedPrimary)
	startIndex := 0
	for index, key := range baseOrder {
		if config.NormalizeMusicSourceProvider(key) == normalizedPrimary {
			startIndex = index + 1
			break
		}
	}
	for offset := 0; offset < len(baseOrder); offset++ {
		appendKey(baseOrder[(startIndex+offset)%len(baseOrder)])
	}
	for _, key := range []string{musicsource.ProviderKugou, musicsource.ProviderPJMP3, musicsource.ProviderNetease} {
		appendKey(key)
	}
	return result
}

func searchProviderLabel(providerKey string) string {
	switch providerKey {
	case musicsource.ProviderKugou:
		return "Kugou"
	case musicsource.ProviderPJMP3:
		return "PJMP3"
	case musicsource.ProviderNetease:
		return "Netease"
	default:
		return providerKey
	}
}
