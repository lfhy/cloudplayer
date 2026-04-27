package main

import (
	"fmt"
	"strings"

	"cloudplayer/internal/cloudplayer/config"
	"cloudplayer/internal/cloudplayer/lyrics"
	"cloudplayer/internal/cloudplayer/sharelink"
)

// Lyrics and share-link methods both depend on remote metadata sources and settings.
func (s *CloudPlayerService) FetchSongLRCEnriched(req lyrics.FetchRequest) (*lyrics.LyricsPayload, error) {
	settings := config.LoadSettings()
	s.state.RateLimiter.AcquireSlot()
	return lyrics.FetchSongLRCEnriched(s.state.HTTP(), settings, req)
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
