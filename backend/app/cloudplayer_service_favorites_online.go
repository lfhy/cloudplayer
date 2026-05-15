package cloudplayer

import (
	"fmt"
	"strings"

	"cloudplayer/backend/importplaylist"
)

// Online favorites route the heart action to Kugou's playlist mutation SDK instead of the local DB.
func onlineFavoritesEnabled() bool {
	return collectionModeUsesOnlineFavorites()
}

func (s *CloudPlayerService) ensureKugouFavoritesPlaylist() (PlaylistRow, error) {
	rows, err := s.loadKugouPlaylistRows(false)
	if err != nil {
		return PlaylistRow{}, err
	}
	for _, row := range rows {
		if row.IsFavorites || strings.TrimSpace(row.Name) == builtinFavoritesName {
			return PlaylistRow{ID: row.ID, Name: row.Name, IsBuiltin: false, IsCloud: true, IsFavorites: true}, nil
		}
	}
	return PlaylistRow{}, fmt.Errorf("未找到酷狗「我喜欢」歌单")
}

func (s *CloudPlayerService) listKugouFavoriteSourceIDs() ([]string, error) {
	playlist, err := s.ensureKugouFavoritesPlaylist()
	if err != nil {
		return nil, err
	}
	rows, err := s.loadKugouPlaylistItems(playlist.ID, false)
	if err != nil {
		return nil, err
	}
	return favoriteSourceIDsFromRows(rows), nil
}

func (s *CloudPlayerService) addKugouFavoriteTrack(track FavoriteTrackIn) error {
	playlist, err := s.ensureKugouFavoritesPlaylist()
	if err != nil {
		return err
	}
	sourceID := strings.TrimSpace(track.Pjmp3SourceID)
	if sourceID == "" {
		return fmt.Errorf("喜欢歌曲需要曲库 source id")
	}
	rows, err := s.loadKugouPlaylistItems(playlist.ID, false)
	if err != nil {
		return err
	}
	for _, row := range rows {
		if strings.TrimSpace(row.Pjmp3SourceID) == sourceID {
			return nil
		}
	}
	return s.appendKugouPlaylistItems(playlist.ID, []importplaylist.ImportedTrackDTO{{
		Title:         strings.TrimSpace(track.Title),
		Artist:        strings.TrimSpace(track.Artist),
		Album:         strings.TrimSpace(track.Album),
		Pjmp3SourceID: sourceID,
		CoverURL:      strings.TrimSpace(track.CoverURL),
		DurationMS:    track.DurationMS,
	}})
}

func (s *CloudPlayerService) removeKugouFavoriteTrack(sourceID string) error {
	playlist, err := s.ensureKugouFavoritesPlaylist()
	if err != nil {
		return err
	}
	fileIDs, err := s.kugouFavoriteFileIDsBySourceID(playlist.ID, sourceID)
	if err != nil {
		return err
	}
	if len(fileIDs) == 0 {
		return nil
	}
	return s.deleteKugouPlaylistItems(playlist.ID, fileIDs)
}

func (s *CloudPlayerService) kugouFavoriteFileIDsBySourceID(playlistID int64, sourceID string) ([]int64, error) {
	trimmed := strings.TrimSpace(sourceID)
	if trimmed == "" {
		return nil, fmt.Errorf("source id 不能为空")
	}
	rows, err := s.loadKugouPlaylistItems(playlistID, false)
	if err != nil {
		return nil, err
	}
	fileIDs := kugouFileIDsForSourceID(rows, trimmed)
	if len(fileIDs) > 0 {
		return fileIDs, nil
	}
	rows, err = s.refreshKugouPlaylistItems(playlistID)
	if err != nil {
		return nil, err
	}
	return kugouFileIDsForSourceID(rows, trimmed), nil
}

func kugouFileIDsForSourceID(rows []PlaylistImportItemRow, sourceID string) []int64 {
	fileIDs := make([]int64, 0, 1)
	for _, row := range rows {
		if strings.TrimSpace(row.Pjmp3SourceID) != sourceID || row.KugouFileID <= 0 {
			continue
		}
		fileIDs = append(fileIDs, row.KugouFileID)
	}
	return fileIDs
}

func favoriteSourceIDsFromRows(rows []PlaylistImportItemRow) []string {
	result := make([]string, 0, len(rows))
	for _, row := range rows {
		sourceID := strings.TrimSpace(row.Pjmp3SourceID)
		if sourceID == "" {
			continue
		}
		result = append(result, sourceID)
	}
	return result
}
