package cloudplayer

import (
	"net/http"
	"testing"

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
	expected := []string{musicsource.ProviderPJMP3, musicsource.ProviderNetease, musicsource.ProviderKugou}
	if len(order) != len(expected) {
		t.Fatalf("searchProviderFailoverOrder() len = %d want %d", len(order), len(expected))
	}
	for index, key := range expected {
		if order[index] != key {
			t.Fatalf("searchProviderFailoverOrder()[%d] = %q want %q", index, order[index], key)
		}
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
