package cloudplayer

import (
	"fmt"
	"os"
	"strings"

	"cloudplayer/backend/download"
	"cloudplayer/backend/importplaylist"
	"cloudplayer/backend/model"
	"cloudplayer/backend/musicsource"
)

// Playback helpers resolve online tracks and expose import parsing to the frontend.
func (s *CloudPlayerService) GetPreviewURL(songID string) (string, error) {
	ref, err := musicsource.ParseSourceID(songID)
	if err != nil {
		return "", err
	}
	s.state.RateLimiter.AcquireSlot()
	previewURL, err := ref.Provider.FetchPreviewURL(s.state.HTTP(), ref.RawID)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(previewURL) == "" {
		return "", fmt.Errorf("閺堫亣袙閺嬫劕鍩?MP3 鐠囨洖鎯夐崷鏉挎絻")
	}
	return previewURL, nil
}

func (s *CloudPlayerService) CachePreviewForPlay(songID string) (string, error) {
	ref, err := musicsource.ParseSourceID(songID)
	if err != nil {
		return "", err
	}
	s.state.RateLimiter.AcquireSlot()
	return ref.Provider.CachePreviewAudioFile(s.state.HTTP(), ref.RawID)
}

func (s *CloudPlayerService) ResolveOnlinePlay(songID, title, artist string) (model.ResolveOnlinePlayOut, error) {
	ref, err := musicsource.ParseSourceID(songID)
	if err != nil {
		return model.ResolveOnlinePlayOut{}, err
	}
	trimmedTitle := strings.TrimSpace(title)
	trimmedArtist := strings.TrimSpace(artist)

	for _, path := range download.CandidateDownloadedAudioPaths(trimmedTitle, trimmedArtist) {
		info, statErr := os.Stat(path)
		if statErr == nil && !info.IsDir() && info.Size() > 0 {
			return model.ResolveOnlinePlayOut{
				Kind: "file",
				Path: path,
				Via:  "download",
			}, nil
		}
	}

	return s.resolveOnlinePlayWithFallback(ref, trimmedTitle, trimmedArtist)
}

func (s *CloudPlayerService) ParseImportText(text, format string) ([]importplaylist.ImportedTrackDTO, error) {
	return importplaylist.ParsePlaylistText(text, format)
}
