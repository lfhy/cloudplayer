package cloudplayer

import (
	"fmt"
	"strings"
	"time"

	"cloudplayer/backend/config"
	"cloudplayer/backend/importplaylist"
)

// Online-mode cache helpers keep cloud playlist reads fast while still allowing a manual refresh.
const kugouOnlineCacheTTL = 12 * time.Hour

func (s *CloudPlayerService) RefreshPlaylists() ([]PlaylistRow, error) {
	return withSQLiteBusyRetryValue(func() ([]PlaylistRow, error) {
		if collectionModeIsOffline() {
			return s.ListPlaylists()
		}
		if collectionModeIsHybrid() {
			return s.refreshHybridPlaylists()
		}
		rows, err := s.refreshKugouPlaylistList()
		if err != nil {
			return nil, err
		}
		return toPlaylistRows(rows), nil
	})
}

func (s *CloudPlayerService) RefreshPlaylistImportItems(playlistID int64) ([]PlaylistImportItemRow, error) {
	return withSQLiteBusyRetryValue(func() ([]PlaylistImportItemRow, error) {
		if collectionModeIsOffline() {
			return s.ListPlaylistImportItems(playlistID)
		}
		if collectionModeIsHybrid() {
			if err := s.ensureHybridKugouPlaylistForks(false); err != nil {
				return nil, err
			}
			playlist, err := s.localPlaylistByID(playlistID)
			if err != nil {
				return nil, err
			}
			if err := s.refreshHybridPlaylistItems(playlist); err != nil {
				return nil, err
			}
			return s.listLocalPlaylistImportItems(playlistID)
		}
		return s.refreshKugouPlaylistItems(playlistID)
	})
}

func (s *CloudPlayerService) loadKugouPlaylistRows(force bool) ([]KugouPlaylistRow, error) {
	if !collectionModeUsesCloudPlaylists() {
		return nil, fmt.Errorf("当前未启用在线模式")
	}
	userID, err := kugouOnlineCacheUserID()
	if err != nil {
		return nil, err
	}
	rows, fetchedAt, err := s.readKugouPlaylistCache(userID)
	if err != nil {
		return nil, err
	}
	if force || cacheExpired(fetchedAt, kugouOnlineCacheTTL) || len(rows) == 0 {
		refreshed, refreshErr := s.refreshKugouPlaylistList()
		if refreshErr == nil {
			return refreshed, nil
		}
		if len(rows) > 0 {
			return rows, nil
		}
		return nil, refreshErr
	}
	return rows, nil
}

func (s *CloudPlayerService) loadKugouPlaylistItems(playlistID int64, force bool) ([]PlaylistImportItemRow, error) {
	if !collectionModeUsesCloudPlaylists() {
		return nil, fmt.Errorf("当前未启用在线模式")
	}
	userID, err := kugouOnlineCacheUserID()
	if err != nil {
		return nil, err
	}
	rows, fetchedAt, err := s.readKugouPlaylistItemsCache(userID, playlistID)
	if err != nil {
		return nil, err
	}
	if force || cacheExpired(fetchedAt, kugouOnlineCacheTTL) || len(rows) == 0 {
		refreshed, refreshErr := s.refreshKugouPlaylistItems(playlistID)
		if refreshErr == nil {
			return refreshed, nil
		}
		if len(rows) > 0 {
			return rows, nil
		}
		return nil, refreshErr
	}
	return rows, nil
}

func (s *CloudPlayerService) refreshKugouPlaylistList() ([]KugouPlaylistRow, error) {
	userID, err := kugouOnlineCacheUserID()
	if err != nil {
		return nil, err
	}
	rows, err := s.ListKugouPlaylists()
	if err != nil {
		return nil, err
	}
	if err := s.saveKugouPlaylistCache(userID, rows); err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *CloudPlayerService) refreshKugouPlaylistItems(playlistID int64) ([]PlaylistImportItemRow, error) {
	userID, err := kugouOnlineCacheUserID()
	if err != nil {
		return nil, err
	}
	response, err := s.SyncKugouPlaylist(playlistID)
	if err != nil {
		return nil, err
	}
	rows := kugouImportRowsFromResponse(response.Tracks, response.KugouFileIDs)
	if err := s.saveKugouPlaylistItemsCache(userID, playlistID, response.PlaylistName, response.Tracks, response.KugouFileIDs); err != nil {
		return nil, err
	}
	return reversePlaylistImportItems(rows), nil
}

func (s *CloudPlayerService) readKugouPlaylistCache(userID string) ([]KugouPlaylistRow, int64, error) {
	rows, err := s.state.DB.Query(`
		SELECT playlist_id, sort_order, name, cover_url, track_count, fetched_at
		FROM kugou_playlist_cache
		WHERE user_id = ?
		ORDER BY sort_order ASC, playlist_id ASC
	`, strings.TrimSpace(userID))
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []KugouPlaylistRow
	var fetchedAt int64
	for rows.Next() {
		var row KugouPlaylistRow
		var sortOrder int
		var coverURL string
		if err := rows.Scan(&row.ID, &sortOrder, &row.Name, &coverURL, &row.TrackCount, &fetchedAt); err != nil {
			return nil, 0, err
		}
		row.IsFavorites = strings.TrimSpace(row.Name) == builtinFavoritesName
		if strings.TrimSpace(coverURL) != "" {
			row.CoverURL = &coverURL
		}
		result = append(result, row)
	}
	return result, fetchedAt, rows.Err()
}

func (s *CloudPlayerService) readKugouPlaylistItemsCache(userID string, playlistID int64) ([]PlaylistImportItemRow, int64, error) {
	rows, err := s.state.DB.Query(`
		SELECT sort_order, title, artist, album, pjmp3_source_id, fileid, cover_url, duration_ms, fetched_at
		FROM kugou_playlist_cache_items
		WHERE user_id = ? AND playlist_id = ?
		ORDER BY sort_order DESC, fileid DESC
	`, strings.TrimSpace(userID), playlistID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []PlaylistImportItemRow
	var fetchedAt int64
	for rows.Next() {
		var row PlaylistImportItemRow
		var coverURL string
		if err := rows.Scan(&row.SortOrder, &row.Title, &row.Artist, &row.Album, &row.Pjmp3SourceID, &row.KugouFileID, &coverURL, &row.DurationMS, &fetchedAt); err != nil {
			return nil, 0, err
		}
		row.ID = row.KugouFileID
		row.CoverURL = coverURL
		result = append(result, row)
	}
	return result, fetchedAt, rows.Err()
}

func (s *CloudPlayerService) saveKugouPlaylistCache(userID string, rows []KugouPlaylistRow) error {
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)
	if _, err := tx.Exec(`DELETE FROM kugou_playlist_cache WHERE user_id = ?`, strings.TrimSpace(userID)); err != nil {
		return err
	}
	fetchedAt := time.Now().Unix()
	for index, row := range rows {
		coverURL := ""
		if row.CoverURL != nil {
			coverURL = strings.TrimSpace(*row.CoverURL)
		}
		if _, err := tx.Exec(`
			INSERT INTO kugou_playlist_cache (
				user_id, playlist_id, sort_order, name, cover_url, track_count, fetched_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`, strings.TrimSpace(userID), row.ID, index, strings.TrimSpace(row.Name), coverURL, row.TrackCount, fetchedAt); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *CloudPlayerService) saveKugouPlaylistItemsCache(userID string, playlistID int64, playlistName string, tracks []importplaylist.ImportedTrackDTO, fileIDs []int64) error {
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)
	if _, err := tx.Exec(`DELETE FROM kugou_playlist_cache_items WHERE user_id = ? AND playlist_id = ?`, strings.TrimSpace(userID), playlistID); err != nil {
		return err
	}
	fetchedAt := time.Now().Unix()
	for index, track := range tracks {
		durationMS := track.DurationMS
		if durationMS < 0 {
			durationMS = 0
		}
		fileID := int64(0)
		if index < len(fileIDs) && fileIDs[index] > 0 {
			fileID = fileIDs[index]
		}
		if _, err := tx.Exec(`
			INSERT INTO kugou_playlist_cache_items (
				user_id, playlist_id, sort_order, title, artist, album, pjmp3_source_id, fileid, cover_url, duration_ms, fetched_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, strings.TrimSpace(userID), playlistID, index, strings.TrimSpace(track.Title), strings.TrimSpace(track.Artist), strings.TrimSpace(track.Album), strings.TrimSpace(track.Pjmp3SourceID), fileID, strings.TrimSpace(track.CoverURL), durationMS, fetchedAt); err != nil {
			return err
		}
	}
	_ = playlistName
	return tx.Commit()
}

func kugouOnlineCacheUserID() (string, error) {
	session := config.LoadKugouSession()
	userID := strings.TrimSpace(session.Cookie["userid"])
	if userID == "" {
		return "", fmt.Errorf("请先登录酷狗概念版")
	}
	return userID, nil
}

func cacheExpired(fetchedAt int64, ttl time.Duration) bool {
	if fetchedAt <= 0 {
		return true
	}
	return time.Since(time.Unix(fetchedAt, 0)) > ttl
}

func kugouImportRowsFromResponse(tracks []importplaylist.ImportedTrackDTO, fileIDs []int64) []PlaylistImportItemRow {
	rows := make([]PlaylistImportItemRow, 0, len(tracks))
	for index, track := range tracks {
		fileID := int64(0)
		if index < len(fileIDs) && fileIDs[index] > 0 {
			fileID = fileIDs[index]
		}
		rows = append(rows, PlaylistImportItemRow{
			ID:            fileID,
			SortOrder:     int64(index),
			Title:         strings.TrimSpace(track.Title),
			Artist:        strings.TrimSpace(track.Artist),
			Album:         strings.TrimSpace(track.Album),
			Pjmp3SourceID: strings.TrimSpace(track.Pjmp3SourceID),
			KugouFileID:   fileID,
			CoverURL:      strings.TrimSpace(track.CoverURL),
			DurationMS:    track.DurationMS,
		})
	}
	return rows
}

func reversePlaylistImportItems(rows []PlaylistImportItemRow) []PlaylistImportItemRow {
	reversed := append([]PlaylistImportItemRow(nil), rows...)
	for left, right := 0, len(reversed)-1; left < right; left, right = left+1, right-1 {
		reversed[left], reversed[right] = reversed[right], reversed[left]
	}
	return reversed
}

func toPlaylistRows(rows []KugouPlaylistRow) []PlaylistRow {
	result := make([]PlaylistRow, 0, len(rows))
	for _, row := range rows {
		result = append(result, PlaylistRow{ID: row.ID, Name: row.Name, IsBuiltin: false, IsCloud: true, IsFavorites: row.IsFavorites})
	}
	return result
}
