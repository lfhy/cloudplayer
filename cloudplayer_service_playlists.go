package main

import (
	"fmt"
	"strings"

	"cloudplayer/internal/cloudplayer/importenrich"
	"cloudplayer/internal/cloudplayer/importplaylist"
)

// Playlist methods own import rows and background enrichment orchestration.
func (s *CloudPlayerService) ListPlaylists() ([]PlaylistRow, error) {
	rows, err := s.state.DB.Query(`SELECT id, name FROM playlists ORDER BY name COLLATE NOCASE`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []PlaylistRow
	for rows.Next() {
		var row PlaylistRow
		if err := rows.Scan(&row.ID, &row.Name); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func (s *CloudPlayerService) ListPlaylistImportItems(playlistID int64) ([]PlaylistImportItemRow, error) {
	rows, err := s.state.DB.Query(`
		SELECT id, sort_order, title, artist, album, pjmp3_source_id, cover_url, duration_ms
		FROM playlist_import_items
		WHERE playlist_id = ?
		ORDER BY sort_order ASC, id ASC
	`, playlistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []PlaylistImportItemRow
	for rows.Next() {
		var row PlaylistImportItemRow
		if err := rows.Scan(&row.ID, &row.SortOrder, &row.Title, &row.Artist, &row.Album, &row.Pjmp3SourceID, &row.CoverURL, &row.DurationMS); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func (s *CloudPlayerService) CreatePlaylist(name string) (int64, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return 0, fmt.Errorf("歌单名称不能为空")
	}
	result, err := s.state.DB.Exec(`INSERT INTO playlists (name) VALUES (?)`, name)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *CloudPlayerService) RenamePlaylist(playlistID int64, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("歌单名称不能为空")
	}
	result, err := s.state.DB.Exec(`UPDATE playlists SET name = ? WHERE id = ?`, name, playlistID)
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
	return nil
}

func (s *CloudPlayerService) DeletePlaylist(playlistID int64) error {
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

func (s *CloudPlayerService) DeletePlaylistImportItem(playlistID, itemID int64) error {
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

func (s *CloudPlayerService) ReplacePlaylistImportItems(playlistID int64, items []importplaylist.ImportedTrackDTO) error {
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)

	if _, err := tx.Exec(`DELETE FROM playlist_import_items WHERE playlist_id = ?`, playlistID); err != nil {
		return err
	}
	for index, item := range items {
		durationMS := item.DurationMS
		if durationMS < 0 {
			durationMS = 0
		}
		if _, err := tx.Exec(`
			INSERT INTO playlist_import_items (
				playlist_id, sort_order, title, artist, album, play_url, pjmp3_source_id,
				cover_url, cover_cache_path, duration_ms, audio_cache_path
			) VALUES (?, ?, ?, ?, ?, '', ?, ?, '', ?, '')
		`, playlistID, index, strings.TrimSpace(item.Title), strings.TrimSpace(item.Artist), strings.TrimSpace(item.Album), strings.TrimSpace(item.Pjmp3SourceID), strings.TrimSpace(item.CoverURL), durationMS); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	importenrich.SpawnPlaylistEnrich(s.state.DB, s.state.HTTP(), s.state.RateLimiter, playlistID)
	return nil
}

func (s *CloudPlayerService) AppendPlaylistImportItems(playlistID int64, items []importplaylist.ImportedTrackDTO) error {
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)

	var position int64
	if err := tx.QueryRow(`
		SELECT COALESCE(MAX(sort_order), -1) + 1
		FROM playlist_import_items
		WHERE playlist_id = ?
	`, playlistID).Scan(&position); err != nil {
		return err
	}
	for _, item := range items {
		durationMS := item.DurationMS
		if durationMS < 0 {
			durationMS = 0
		}
		if _, err := tx.Exec(`
			INSERT INTO playlist_import_items (
				playlist_id, sort_order, title, artist, album, play_url, pjmp3_source_id,
				cover_url, cover_cache_path, duration_ms, audio_cache_path
			) VALUES (?, ?, ?, ?, ?, '', ?, ?, '', ?, '')
		`, playlistID, position, strings.TrimSpace(item.Title), strings.TrimSpace(item.Artist), strings.TrimSpace(item.Album), strings.TrimSpace(item.Pjmp3SourceID), strings.TrimSpace(item.CoverURL), durationMS); err != nil {
			return err
		}
		position++
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	importenrich.SpawnPlaylistEnrich(s.state.DB, s.state.HTTP(), s.state.RateLimiter, playlistID)
	return nil
}

func (s *CloudPlayerService) StartImportEnrich(playlistID int64) error {
	if playlistID <= 0 {
		return fmt.Errorf("无效的歌单 id")
	}
	importenrich.SpawnPlaylistEnrich(s.state.DB, s.state.HTTP(), s.state.RateLimiter, playlistID)
	return nil
}
