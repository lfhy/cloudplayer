package cloudplayer

import (
	"database/sql"
	"fmt"
	"strings"

	"cloudplayer/backend/importenrich"
	"cloudplayer/backend/importplaylist"
)

// Offline list projection keeps hybrid cloud forks out of pure-local mode without deleting their cached data.
func visibleLocalPlaylistRow(row PlaylistRow) (PlaylistRow, bool) {
	if collectionModeIsOffline() && row.IsCloud && !row.IsFavorites {
		return PlaylistRow{}, false
	}
	if collectionModeIsOffline() {
		row.CloudSource = ""
		row.CloudListID = nil
		row.CloudWritable = false
		row.IsCloud = false
	}
	return row, true
}

// Local playlist helpers keep the DB-backed playlist path reusable for offline and hybrid modes.
func (s *CloudPlayerService) listLocalPlaylists() ([]PlaylistRow, error) {
	if _, err := s.ensureFavoritesPlaylist(); err != nil {
		return nil, err
	}
	rows, err := s.state.DB.Query(`
		SELECT id, name, is_builtin, cloud_source, cloud_list_id, cloud_writable
		FROM playlists
		ORDER BY is_builtin DESC, id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []PlaylistRow
	for rows.Next() {
		var row PlaylistRow
		var cloudSource string
		var cloudListID int64
		var cloudWritable bool
		if err := rows.Scan(&row.ID, &row.Name, &row.IsBuiltin, &cloudSource, &cloudListID, &cloudWritable); err != nil {
			return nil, err
		}
		row.CloudSource = strings.TrimSpace(cloudSource)
		row.CloudWritable = cloudWritable
		row.IsCloud = row.CloudSource != "" && cloudListID > 0
		row.IsFavorites = row.IsBuiltin || strings.TrimSpace(row.Name) == builtinFavoritesName
		if row.IsCloud {
			value := cloudListID
			row.CloudListID = &value
		}
		visibleRow, ok := visibleLocalPlaylistRow(row)
		if !ok {
			continue
		}
		result = append(result, visibleRow)
	}
	return result, rows.Err()
}

func (s *CloudPlayerService) listLocalPlaylistImportItems(playlistID int64) ([]PlaylistImportItemRow, error) {
	rows, err := s.state.DB.Query(`
		SELECT id, sort_order, title, artist, album, pjmp3_source_id, kugou_file_id, sync_origin, cover_url, duration_ms
		FROM playlist_import_items
		WHERE playlist_id = ?
		ORDER BY sort_order DESC, id DESC
	`, playlistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []PlaylistImportItemRow
	for rows.Next() {
		var row PlaylistImportItemRow
		if err := rows.Scan(&row.ID, &row.SortOrder, &row.Title, &row.Artist, &row.Album, &row.Pjmp3SourceID, &row.KugouFileID, &row.SyncOrigin, &row.CoverURL, &row.DurationMS); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func (s *CloudPlayerService) createLocalPlaylist(name string, cloudSource string, cloudListID int64, cloudWritable bool) (int64, error) {
	result, err := s.state.DB.Exec(`
		INSERT INTO playlists (name, is_builtin, cloud_source, cloud_list_id, cloud_writable)
		VALUES (?, 0, ?, ?, ?)
	`, strings.TrimSpace(name), strings.TrimSpace(cloudSource), maxInt64(cloudListID, 0), cloudWritable)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *CloudPlayerService) localPlaylistByID(playlistID int64) (PlaylistRow, error) {
	var row PlaylistRow
	var cloudSource string
	var cloudListID int64
	if err := s.state.DB.QueryRow(`
		SELECT id, name, is_builtin, cloud_source, cloud_list_id, cloud_writable
		FROM playlists
		WHERE id = ?
	`, playlistID).Scan(&row.ID, &row.Name, &row.IsBuiltin, &cloudSource, &cloudListID, &row.CloudWritable); err != nil {
		return PlaylistRow{}, err
	}
	row.CloudSource = strings.TrimSpace(cloudSource)
	row.IsCloud = row.CloudSource != "" && cloudListID > 0
	row.IsFavorites = row.IsBuiltin || strings.TrimSpace(row.Name) == builtinFavoritesName
	if row.IsCloud {
		value := cloudListID
		row.CloudListID = &value
	}
	visibleRow, ok := visibleLocalPlaylistRow(row)
	if !ok {
		return PlaylistRow{}, sql.ErrNoRows
	}
	return visibleRow, nil
}

func maxInt64(value, minimum int64) int64 {
	if value < minimum {
		return minimum
	}
	return value
}

func importedTrackRows(items []importplaylist.ImportedTrackDTO, syncOrigin string) []PlaylistImportItemRow {
	rows := make([]PlaylistImportItemRow, 0, len(items))
	for _, item := range items {
		durationMS := item.DurationMS
		if durationMS < 0 {
			durationMS = 0
		}
		rows = append(rows, PlaylistImportItemRow{
			Title:         strings.TrimSpace(item.Title),
			Artist:        strings.TrimSpace(item.Artist),
			Album:         strings.TrimSpace(item.Album),
			Pjmp3SourceID: strings.TrimSpace(item.Pjmp3SourceID),
			SyncOrigin:    strings.TrimSpace(syncOrigin),
			CoverURL:      strings.TrimSpace(item.CoverURL),
			DurationMS:    durationMS,
		})
	}
	return rows
}

func (s *CloudPlayerService) upsertLocalPlaylistItems(playlistID int64, items []PlaylistImportItemRow, replace bool) error {
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)
	if replace {
		if _, err := tx.Exec(`DELETE FROM playlist_import_items WHERE playlist_id = ?`, playlistID); err != nil {
			return err
		}
	}
	var position int64
	if err := tx.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM playlist_import_items WHERE playlist_id = ?`, playlistID).Scan(&position); err != nil {
		return err
	}
	for index, item := range items {
		sortOrder := position + int64(index)
		if replace {
			sortOrder = int64(index)
		}
		if _, err := tx.Exec(`
			INSERT INTO playlist_import_items (
				playlist_id, sort_order, title, artist, album, play_url, pjmp3_source_id,
				kugou_file_id, sync_origin, cover_url, cover_cache_path, duration_ms, audio_cache_path
			) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, '', ?, '')
		`, playlistID, sortOrder, strings.TrimSpace(item.Title), strings.TrimSpace(item.Artist), strings.TrimSpace(item.Album), strings.TrimSpace(item.Pjmp3SourceID), maxInt64(item.KugouFileID, 0), strings.TrimSpace(item.SyncOrigin), strings.TrimSpace(item.CoverURL), item.DurationMS); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *CloudPlayerService) appendLocalPlaylistItems(playlistID int64, items []importplaylist.ImportedTrackDTO, syncOrigin string) error {
	if err := s.upsertLocalPlaylistItems(playlistID, importedTrackRows(items, syncOrigin), false); err != nil {
		return err
	}
	importenrich.SpawnPlaylistEnrich(s.state.DB, s.state.HTTP(), s.state.RateLimiter, playlistID)
	return nil
}

func (s *CloudPlayerService) replaceLocalPlaylistItems(playlistID int64, items []importplaylist.ImportedTrackDTO, syncOrigin string) error {
	if err := s.upsertLocalPlaylistItems(playlistID, importedTrackRows(items, syncOrigin), true); err != nil {
		return err
	}
	importenrich.SpawnPlaylistEnrich(s.state.DB, s.state.HTTP(), s.state.RateLimiter, playlistID)
	return nil
}

func (s *CloudPlayerService) deleteLocalPlaylistFully(playlistID int64) error {
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)
	if _, err := tx.Exec(`DELETE FROM playlist_import_items WHERE playlist_id = ?`, playlistID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM playlist_songs WHERE playlist_id = ?`, playlistID); err != nil {
		return err
	}
	result, err := tx.Exec(`DELETE FROM playlists WHERE id = ?`, playlistID)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		return fmt.Errorf("歌单不存在")
	}
	return tx.Commit()
}

func (s *CloudPlayerService) deleteLocalPlaylistImportItem(playlistID, itemID int64) error {
	result, err := s.state.DB.Exec(`DELETE FROM playlist_import_items WHERE id = ? AND playlist_id = ?`, itemID, playlistID)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		return fmt.Errorf("未找到该导入条目")
	}
	return nil
}

func (s *CloudPlayerService) localPlaylistImportItemByID(playlistID, itemID int64) (PlaylistImportItemRow, error) {
	var row PlaylistImportItemRow
	err := s.state.DB.QueryRow(`
		SELECT id, sort_order, title, artist, album, pjmp3_source_id, kugou_file_id, sync_origin, cover_url, duration_ms
		FROM playlist_import_items
		WHERE playlist_id = ? AND id = ?
		LIMIT 1
	`, playlistID, itemID).Scan(&row.ID, &row.SortOrder, &row.Title, &row.Artist, &row.Album, &row.Pjmp3SourceID, &row.KugouFileID, &row.SyncOrigin, &row.CoverURL, &row.DurationMS)
	if err != nil {
		if err == sql.ErrNoRows {
			return PlaylistImportItemRow{}, fmt.Errorf("未找到该导入条目")
		}
		return PlaylistImportItemRow{}, err
	}
	return row, nil
}

func syncOriginForPlaylistRow(row PlaylistRow) string {
	if row.CloudSource == "kugou" && row.CloudListID != nil && *row.CloudListID > 0 {
		return "kugou"
	}
	return ""
}

func requireLocalPlaylistCloudTarget(playlist PlaylistRow, source string) (int64, error) {
	if !playlist.IsCloud || playlist.CloudListID == nil || *playlist.CloudListID <= 0 {
		return 0, fmt.Errorf("当前歌单没有绑定云端来源")
	}
	if !playlist.CloudWritable {
		return 0, fmt.Errorf("当前歌单已保留为本地副本，暂时无法回写云端")
	}
	if strings.TrimSpace(playlist.CloudSource) != strings.TrimSpace(source) {
		return 0, fmt.Errorf("当前歌单未绑定指定云端来源")
	}
	return *playlist.CloudListID, nil
}
