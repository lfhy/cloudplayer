package cloudplayer

import (
	"fmt"
	"net/http"
	"slices"
	"testing"
	"time"

	"cloudplayer/backend/cache"
	"cloudplayer/backend/config"
	"cloudplayer/backend/musicsource"
	"cloudplayer/backend/state"
)

// Search failover tests lock the provider chain so source outages can switch cleanly without touching playback flows.
func TestSearchSongsFallsBackAndPersistsProvider(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicSourceProvider = musicsource.ProviderKugou
	settings.PlaybackFallbackChain = "kugou,pjmp3,netease"
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}

	previousCurrent := currentSearchProvider
	previousLookup := searchProviderByKey
	t.Cleanup(func() {
		currentSearchProvider = previousCurrent
		searchProviderByKey = previousLookup
	})

	kugou := stubSearchProvider{
		key: musicsource.ProviderKugou,
		search: func(_ *http.Client, _ string, _ uint32) ([]musicsource.SearchResult, bool, error) {
			return nil, false, assertiveError("primary down")
		},
	}
	pjmp3 := stubSearchProvider{
		key: musicsource.ProviderPJMP3,
		search: func(_ *http.Client, _ string, _ uint32) ([]musicsource.SearchResult, bool, error) {
			return []musicsource.SearchResult{{
				SourceID: musicsource.EncodeSourceID(musicsource.ProviderPJMP3, "42"),
				Title:    "Fallback Song",
				Artist:   "Fallback Artist",
			}}, false, nil
		},
	}

	currentSearchProvider = func() musicsource.Provider {
		return kugou
	}
	searchProviderByKey = func(key string) (musicsource.Provider, bool) {
		switch key {
		case musicsource.ProviderKugou:
			return kugou, true
		case musicsource.ProviderPJMP3:
			return pjmp3, true
		default:
			return nil, false
		}
	}

	service := &CloudPlayerService{state: state.NewAppState(nil)}
	response, err := service.SearchSongs("fallback", 1)
	if err != nil {
		t.Fatalf("SearchSongs() error = %v", err)
	}
	if !response.FallbackApplied {
		t.Fatalf("SearchSongs() fallbackApplied = false")
	}
	if !response.ProviderPersisted {
		t.Fatalf("SearchSongs() providerPersisted = false")
	}
	if response.ProviderKey != musicsource.ProviderPJMP3 {
		t.Fatalf("SearchSongs() providerKey = %q", response.ProviderKey)
	}
	if response.FailedProviderKey != musicsource.ProviderKugou {
		t.Fatalf("SearchSongs() failedProviderKey = %q", response.FailedProviderKey)
	}
	if len(response.Results) != 1 || response.Results[0].SourceID != "pjmp3:42" {
		t.Fatalf("SearchSongs() results = %#v", response.Results)
	}

	latestSettings := config.LoadSettings()
	if latestSettings.MusicSourceProvider != musicsource.ProviderPJMP3 {
		t.Fatalf("LoadSettings().MusicSourceProvider = %q", latestSettings.MusicSourceProvider)
	}
}

func TestSearchProviderFailoverOrderRotatesFromPrimary(t *testing.T) {
	order := searchProviderFailoverOrder(musicsource.ProviderPJMP3, "kugou,pjmp3,netease")
	expected := []string{
		musicsource.ProviderPJMP3,
		musicsource.ProviderNetease,
		musicsource.ProviderKugou,
		musicsource.ProviderGequhai,
	}
	if len(order) != len(expected) {
		t.Fatalf("searchProviderFailoverOrder() len = %d want %d", len(order), len(expected))
	}
	for index, key := range expected {
		if order[index] != key {
			t.Fatalf("searchProviderFailoverOrder()[%d] = %q want %q", index, order[index], key)
		}
	}
}

func TestSearchSongsFallsBackWhenPrimaryReturnsEmptyPage(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicSourceProvider = musicsource.ProviderKugou
	settings.PlaybackFallbackChain = "kugou,netease,pjmp3"
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}

	previousCurrent := currentSearchProvider
	previousLookup := searchProviderByKey
	t.Cleanup(func() {
		currentSearchProvider = previousCurrent
		searchProviderByKey = previousLookup
	})

	kugou := stubSearchProvider{
		key: musicsource.ProviderKugou,
		search: func(_ *http.Client, _ string, _ uint32) ([]musicsource.SearchResult, bool, error) {
			return []musicsource.SearchResult{}, false, nil
		},
	}
	netease := stubSearchProvider{
		key: musicsource.ProviderNetease,
		search: func(_ *http.Client, _ string, _ uint32) ([]musicsource.SearchResult, bool, error) {
			return []musicsource.SearchResult{{
				SourceID: musicsource.EncodeSourceID(musicsource.ProviderNetease, "99"),
				Title:    "Fallback From Empty",
				Artist:   "Netease Artist",
			}}, false, nil
		},
	}

	currentSearchProvider = func() musicsource.Provider {
		return kugou
	}
	searchProviderByKey = func(key string) (musicsource.Provider, bool) {
		switch key {
		case musicsource.ProviderKugou:
			return kugou, true
		case musicsource.ProviderNetease:
			return netease, true
		default:
			return nil, false
		}
	}

	service := &CloudPlayerService{state: state.NewAppState(nil)}
	response, err := service.SearchSongs("empty-primary", 1)
	if err != nil {
		t.Fatalf("SearchSongs() error = %v", err)
	}
	if !response.FallbackApplied {
		t.Fatalf("SearchSongs() fallbackApplied = false")
	}
	if !response.ProviderPersisted {
		t.Fatalf("SearchSongs() providerPersisted = false")
	}
	if response.ProviderKey != musicsource.ProviderNetease {
		t.Fatalf("SearchSongs() providerKey = %q", response.ProviderKey)
	}
	if len(response.Results) != 1 || response.Results[0].SourceID != "netease:99" {
		t.Fatalf("SearchSongs() results = %#v", response.Results)
	}
}

func TestSearchSongsDoesNotCacheEmptyPrimaryPage(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicSourceProvider = musicsource.ProviderKugou
	settings.PlaybackFallbackChain = "kugou,netease,pjmp3"
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}

	previousCurrent := currentSearchProvider
	previousLookup := searchProviderByKey
	t.Cleanup(func() {
		currentSearchProvider = previousCurrent
		searchProviderByKey = previousLookup
	})

	kugou := stubSearchProvider{
		key: musicsource.ProviderKugou,
		search: func(_ *http.Client, _ string, _ uint32) ([]musicsource.SearchResult, bool, error) {
			return nil, false, nil
		},
	}
	netease := stubSearchProvider{
		key: musicsource.ProviderNetease,
		search: func(_ *http.Client, _ string, _ uint32) ([]musicsource.SearchResult, bool, error) {
			return []musicsource.SearchResult{{
				SourceID: musicsource.EncodeSourceID(musicsource.ProviderNetease, "1"),
				Title:    "Fallback Track",
				Artist:   "Netease Artist",
			}}, false, nil
		},
	}

	currentSearchProvider = func() musicsource.Provider {
		return kugou
	}
	searchProviderByKey = func(key string) (musicsource.Provider, bool) {
		if key == musicsource.ProviderKugou {
			return kugou, true
		}
		if key == musicsource.ProviderNetease {
			return netease, true
		}
		return nil, false
	}

	service := &CloudPlayerService{state: state.NewAppState(nil)}
	response, err := service.SearchSongs("empty-no-cache", 1)
	if err != nil {
		t.Fatalf("SearchSongs() error = %v", err)
	}
	if _, ok := service.state.SearchCache.Get(cache.SearchCacheKey(musicsource.ProviderKugou, "empty-no-cache", 1)); ok {
		t.Fatalf("SearchSongs() cached empty response")
	}
	if len(response.Results) != 1 || response.Results[0].SourceID != "netease:1" {
		t.Fatalf("SearchSongs() fallback results = %#v", response.Results)
	}
}

func TestSearchSongsFallsBackWhenPrimaryCachedPageIsEmpty(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicSourceProvider = musicsource.ProviderKugou
	settings.PlaybackFallbackChain = "kugou,netease,pjmp3"
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}

	previousCurrent := currentSearchProvider
	previousLookup := searchProviderByKey
	t.Cleanup(func() {
		currentSearchProvider = previousCurrent
		searchProviderByKey = previousLookup
	})

	kugouCalls := 0
	kugou := stubSearchProvider{
		key: musicsource.ProviderKugou,
		search: func(_ *http.Client, _ string, _ uint32) ([]musicsource.SearchResult, bool, error) {
			kugouCalls += 1
			return []musicsource.SearchResult{{SourceID: musicsource.EncodeSourceID(musicsource.ProviderKugou, "unexpected")}}, false, nil
		},
	}
	netease := stubSearchProvider{
		key: musicsource.ProviderNetease,
		search: func(_ *http.Client, _ string, _ uint32) ([]musicsource.SearchResult, bool, error) {
			return []musicsource.SearchResult{{
				SourceID: musicsource.EncodeSourceID(musicsource.ProviderNetease, "cached-fallback"),
				Title:    "Fallback From Cached Empty",
				Artist:   "Netease Artist",
			}}, false, nil
		},
	}

	currentSearchProvider = func() musicsource.Provider {
		return kugou
	}
	searchProviderByKey = func(key string) (musicsource.Provider, bool) {
		switch key {
		case musicsource.ProviderKugou:
			return kugou, true
		case musicsource.ProviderNetease:
			return netease, true
		default:
			return nil, false
		}
	}

	service := &CloudPlayerService{state: state.NewAppState(nil)}
	service.state.SearchCache.Set("search:page:v1:kugou|cached-empty|1", SearchResponse{
		Results: nil,
		HasNext: false,
	}, service.state.SearchCacheTTL)

	response, err := service.SearchSongs("cached-empty", 1)
	if err != nil {
		t.Fatalf("SearchSongs() error = %v", err)
	}
	if kugouCalls != 0 {
		t.Fatalf("SearchSongs() primary search calls = %d", kugouCalls)
	}
	if _, ok := service.state.SearchCache.Get(cache.SearchCacheKey(musicsource.ProviderKugou, "cached-empty", 1)); ok {
		t.Fatalf("SearchSongs() left cached empty response behind")
	}
	if !response.FallbackApplied {
		t.Fatalf("SearchSongs() fallbackApplied = false")
	}
	if response.ProviderKey != musicsource.ProviderNetease {
		t.Fatalf("SearchSongs() providerKey = %q", response.ProviderKey)
	}
	if len(response.Results) != 1 || response.Results[0].SourceID != "netease:cached-fallback" {
		t.Fatalf("SearchSongs() results = %#v", response.Results)
	}
}

func TestSearchSongsAggregatesPrimaryChunksBeforeFallback(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicSourceProvider = musicsource.ProviderKugou
	settings.PlaybackFallbackChain = "kugou,netease,pjmp3"
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}

	previousCurrent := currentSearchProvider
	previousLookup := searchProviderByKey
	t.Cleanup(func() {
		currentSearchProvider = previousCurrent
		searchProviderByKey = previousLookup
	})

	kugou := stubSearchProvider{
		key: musicsource.ProviderKugou,
		search: func(_ *http.Client, _ string, page uint32) ([]musicsource.SearchResult, bool, error) {
			start := int(page-1) * 10
			rows := make([]musicsource.SearchResult, 0, 10)
			for i := 0; i < 10; i++ {
				index := start + i + 1
				rows = append(rows, musicsource.SearchResult{
					SourceID: musicsource.EncodeSourceID(musicsource.ProviderKugou, fmt.Sprintf("%d", index)),
					Title:    fmt.Sprintf("Kugou %d", index),
					Artist:   "Kugou Artist",
				})
			}
			return rows, page < 3, nil
		},
	}
	neteaseCalls := 0
	netease := stubSearchProvider{
		key: musicsource.ProviderNetease,
		search: func(_ *http.Client, _ string, _ uint32) ([]musicsource.SearchResult, bool, error) {
			neteaseCalls += 1
			return nil, false, assertiveError("unexpected fallback")
		},
	}

	currentSearchProvider = func() musicsource.Provider {
		return kugou
	}
	searchProviderByKey = func(key string) (musicsource.Provider, bool) {
		switch key {
		case musicsource.ProviderKugou:
			return kugou, true
		case musicsource.ProviderNetease:
			return netease, true
		default:
			return nil, false
		}
	}

	service := &CloudPlayerService{state: state.NewAppState(nil)}
	response, err := service.SearchSongs("partial-primary", 1)
	if err != nil {
		t.Fatalf("SearchSongs() error = %v", err)
	}
	if response.FallbackApplied {
		t.Fatalf("SearchSongs() fallbackApplied = true")
	}
	if response.ProviderPersisted {
		t.Fatalf("SearchSongs() providerPersisted = true")
	}
	if response.ProviderKey != musicsource.ProviderKugou {
		t.Fatalf("SearchSongs() providerKey = %q", response.ProviderKey)
	}
	if len(response.Results) != 30 {
		t.Fatalf("SearchSongs() len(results) = %d", len(response.Results))
	}
	if response.Results[0].SourceID != "kugou:1" || response.Results[29].SourceID != "kugou:30" {
		t.Fatalf("SearchSongs() aggregated results = %#v", response.Results)
	}
	if neteaseCalls != 0 {
		t.Fatalf("SearchSongs() fallback calls = %d", neteaseCalls)
	}
}

func TestSearchSongsSlicesLaterLogicalPageFromAggregatedChunks(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicSourceProvider = musicsource.ProviderKugou
	settings.PlaybackFallbackChain = "kugou,netease,pjmp3"
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}

	previousCurrent := currentSearchProvider
	previousLookup := searchProviderByKey
	t.Cleanup(func() {
		currentSearchProvider = previousCurrent
		searchProviderByKey = previousLookup
	})

	pagesRequested := make([]uint32, 0, 4)
	kugou := stubSearchProvider{
		key: musicsource.ProviderKugou,
		search: func(_ *http.Client, _ string, page uint32) ([]musicsource.SearchResult, bool, error) {
			pagesRequested = append(pagesRequested, page)
			start := int(page-1) * 10
			rows := make([]musicsource.SearchResult, 0, 10)
			for i := 0; i < 10; i++ {
				index := start + i + 1
				rows = append(rows, musicsource.SearchResult{
					SourceID: musicsource.EncodeSourceID(musicsource.ProviderKugou, fmt.Sprintf("%d", index)),
					Title:    fmt.Sprintf("Kugou %d", index),
					Artist:   "Kugou Artist",
				})
			}
			return rows, page < 4, nil
		},
	}

	currentSearchProvider = func() musicsource.Provider {
		return kugou
	}
	searchProviderByKey = func(key string) (musicsource.Provider, bool) {
		if key == musicsource.ProviderKugou {
			return kugou, true
		}
		return nil, false
	}

	service := &CloudPlayerService{state: state.NewAppState(nil)}
	response, err := service.SearchSongs("logical-page-2", 2)
	if err != nil {
		t.Fatalf("SearchSongs() error = %v", err)
	}
	if response.FallbackApplied {
		t.Fatalf("SearchSongs() fallbackApplied = true")
	}
	if response.HasNext {
		t.Fatalf("SearchSongs() hasNext = true")
	}
	if len(response.Results) != 10 {
		t.Fatalf("SearchSongs() len(results) = %d", len(response.Results))
	}
	if response.Results[0].SourceID != "kugou:31" || response.Results[9].SourceID != "kugou:40" {
		t.Fatalf("SearchSongs() results = %#v", response.Results)
	}
	if !slices.Equal(pagesRequested, []uint32{1, 2, 3, 4}) {
		t.Fatalf("SearchSongs() pagesRequested = %#v", pagesRequested)
	}
}

func TestSearchSongsUsesScopedTimeoutClient(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicSourceProvider = musicsource.ProviderPJMP3
	settings.PlaybackFallbackChain = "pjmp3,kugou,netease"
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}

	previousCurrent := currentSearchProvider
	previousLookup := searchProviderByKey
	t.Cleanup(func() {
		currentSearchProvider = previousCurrent
		searchProviderByKey = previousLookup
	})

	baseClient := &http.Client{Timeout: 45 * time.Second}
	provider := stubSearchProvider{
		key: musicsource.ProviderPJMP3,
		search: func(client *http.Client, _ string, _ uint32) ([]musicsource.SearchResult, bool, error) {
			if client == nil {
				t.Fatalf("SearchSongs() passed nil client")
			}
			if client == baseClient {
				t.Fatalf("SearchSongs() reused shared HTTP client")
			}
			if client.Timeout != searchAttemptTimeout {
				t.Fatalf("SearchSongs() timeout = %v want %v", client.Timeout, searchAttemptTimeout)
			}
			return []musicsource.SearchResult{{
				SourceID: musicsource.EncodeSourceID(musicsource.ProviderPJMP3, "77"),
				Title:    "Timeout Song",
				Artist:   "Timeout Artist",
			}}, false, nil
		},
	}

	currentSearchProvider = func() musicsource.Provider {
		return provider
	}
	searchProviderByKey = func(key string) (musicsource.Provider, bool) {
		if key == musicsource.ProviderPJMP3 {
			return provider, true
		}
		return nil, false
	}

	service := &CloudPlayerService{state: state.NewAppState(nil)}
	service.state.SwapHTTPClient(baseClient)

	response, err := service.SearchSongs("timeout", 1)
	if err != nil {
		t.Fatalf("SearchSongs() error = %v", err)
	}
	if len(response.Results) != 1 || response.Results[0].SourceID != "pjmp3:77" {
		t.Fatalf("SearchSongs() results = %#v", response.Results)
	}
	if got := service.state.HTTP(); got != baseClient {
		t.Fatalf("HTTP() client pointer changed")
	}
	if service.state.HTTP().Timeout != 45*time.Second {
		t.Fatalf("HTTP() timeout = %v want %v", service.state.HTTP().Timeout, 45*time.Second)
	}
}

type stubSearchProvider struct {
	key    string
	search func(client *http.Client, keyword string, page uint32) ([]musicsource.SearchResult, bool, error)
}

func (s stubSearchProvider) Key() string {
	return s.key
}

func (s stubSearchProvider) Search(client *http.Client, keyword string, page uint32) ([]musicsource.SearchResult, bool, error) {
	return s.search(client, keyword, page)
}

func (s stubSearchProvider) FetchDailyRecommendations(_ *http.Client, _ int) ([]musicsource.SearchResult, error) {
	return nil, nil
}

func (s stubSearchProvider) FetchPreviewURL(_ *http.Client, _ string) (string, error) {
	return "", nil
}

func (s stubSearchProvider) CachePreviewAudioFile(_ *http.Client, _ string) (string, error) {
	return "", nil
}

func (s stubSearchProvider) PreviewCachePathIfExists(_ string) string {
	return ""
}

func (s stubSearchProvider) FetchSongLRCText(_ *http.Client, _ string) (*string, error) {
	return nil, nil
}

func (s stubSearchProvider) FetchSongPageHTML(_ *http.Client, _ string) (string, error) {
	return "", nil
}

func (s stubSearchProvider) ExtractAlbumFromSongHTML(_ string) string {
	return ""
}

func (s stubSearchProvider) ExtractDurationMSFromSongHTML(_ string) int64 {
	return 0
}

type assertiveError string

func (e assertiveError) Error() string {
	return string(e)
}
