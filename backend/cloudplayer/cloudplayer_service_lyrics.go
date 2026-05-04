package cloudplayer

import (
	"fmt"
	"log"
	"strings"

	"cloudplayer/backend/core/cloudplayer/config"
	"cloudplayer/backend/core/cloudplayer/lyrics"
	"cloudplayer/backend/core/cloudplayer/sharelink"
)

// Lyrics and share-link methods both depend on remote metadata sources and settings.
func (s *CloudPlayerService) FetchSongLRCEnriched(req lyrics.FetchRequest) (*lyrics.LyricsPayload, error) {
	settings := config.LoadSettings()
	s.state.RateLimiter.AcquireSlot()
	artist := strings.TrimSpace(req.Artist)
	title := strings.TrimSpace(req.Title)
	cacheKey := LyricsCacheKey(req)
	sourceID := ""
	if req.PJMP3SourceID != nil {
		sourceID = strings.TrimSpace(*req.PJMP3SourceID)
	}
	trace := lyricTraceEnabled()
	if cached, ok := s.state.LyricsCache.Get(cacheKey); ok {
		if trace {
			log.Printf("FetchSongLRCEnriched cache hit: key=%q source=%q artist=%q title=%q", cacheKey, sourceID, artist, title)
		}
		return &cached, nil
	}
	if cached, isOverride, ok, err := loadPersistentLyrics(s.state.DB, cacheKey); err == nil && ok {
		if trace {
			kind := "cache"
			if isOverride {
				kind = "override"
			}
			log.Printf("FetchSongLRCEnriched persistent hit: key=%q kind=%s source=%q artist=%q title=%q", cacheKey, kind, sourceID, artist, title)
		}
		s.state.LyricsCache.Set(cacheKey, cached, s.state.SearchCacheTTL)
		return &cached, nil
	} else if err != nil && trace {
		log.Printf("FetchSongLRCEnriched persistent load failed: key=%q err=%v", cacheKey, err)
	}
	if trace {
		log.Printf("FetchSongLRCEnriched request: source=%q artist=%q title=%q", sourceID, artist, title)
	}
	payload, err := lyrics.FetchSongLRCEnriched(s.state.HTTP(), settings, req)
	if err != nil {
		if trace {
			log.Printf("FetchSongLRCEnriched failed: source=%q artist=%q title=%q err=%v", sourceID, artist, title, err)
		}
		return nil, err
	}
	if payload == nil {
		if trace {
			log.Printf("FetchSongLRCEnriched empty: source=%q artist=%q title=%q", sourceID, artist, title)
		}
		return nil, nil
	}
	if trace {
		log.Printf("FetchSongLRCEnriched ok: source=%q artist=%q title=%q lrcChars=%d wordLines=%d", sourceID, artist, title, len(payload.LRCText), len(payload.WordLines))
	}
	if payload.LRCText != "" || len(payload.WordLines) > 0 {
		s.state.LyricsCache.Set(cacheKey, *payload, s.state.SearchCacheTTL)
		if err := savePersistentLyrics(s.state.DB, cacheKey, *payload, false); err != nil && trace {
			log.Printf("FetchSongLRCEnriched persistent save failed: key=%q err=%v", cacheKey, err)
		}
	}
	return payload, nil
}

func (s *CloudPlayerService) SaveLyricsOverride(req lyrics.FetchRequest, payload lyrics.LyricsPayload) error {
	cacheKey := LyricsCacheKey(req)
	if strings.TrimSpace(cacheKey) == "" {
		return fmt.Errorf("歌词缓存键无效")
	}
	if strings.TrimSpace(payload.LRCText) == "" && len(payload.WordLines) == 0 {
		return fmt.Errorf("歌词内容为空")
	}
	s.state.LyricsCache.Set(cacheKey, payload, s.state.SearchCacheTTL)
	return savePersistentLyrics(s.state.DB, cacheKey, payload, true)
}

func (s *CloudPlayerService) LyricsSearchCandidates(keyword string, durationMS *int64, sources []string) ([]lyrics.LyricCandidate, error) {
	settings := config.LoadSettings()
	s.state.RateLimiter.AcquireSlot()
	return lyrics.SearchCandidates(s.state.HTTP(), settings, keyword, durationMS, sources)
}

func (s *CloudPlayerService) LyricsFetchCandidate(candidate lyrics.LyricCandidate) (lyrics.LyricsPayload, error) {
	settings := config.LoadSettings()
	s.state.RateLimiter.AcquireSlot()
	return lyrics.FetchCandidate(s.state.HTTP(), settings, candidate)
}

func (s *CloudPlayerService) FetchSharePlaylist(rawURL string) (SharePlaylistResponse, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return SharePlaylistResponse{}, fmt.Errorf("请先粘贴分享链接。")
	}
	settings := config.LoadSettings()
	s.state.RateLimiter.AcquireSlot()
	name, tracks, err := sharelink.FetchPlaylistFromShareURL(s.state.HTTP(), trimmed, sharelink.FetchOptions{
		NeteaseCookieEnabled: settings.ShareNeteaseCookieEnabled,
		NeteaseCookie:        settings.ShareNeteaseCookie,
	})
	if err != nil {
		return SharePlaylistResponse{}, err
	}
	return SharePlaylistResponse{
		PlaylistName: name,
		Tracks:       tracks,
	}, nil
}
