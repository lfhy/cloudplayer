package cloudplayer

import (
	"database/sql"
	"fmt"
	"strings"
)

const builtinFavoritesName = "我喜欢"

// Favorites methods keep the built-in liked playlist logic isolated from generic playlist CRUD.
func (s *CloudPlayerService) EnsureFavoritesPlaylist() (PlaylistRow, error) {
	if collectionModeIsOnline() {
		return s.ensureKugouFavoritesPlaylist()
	}
	if collectionModeIsHybrid() {
		if err := s.ensureHybridKugouPlaylistForks(false); err != nil {
			return PlaylistRow{}, err
		}
	}
	if err := s.CleanupDuplicateFavoritesPlaylists(); err != nil {
		return PlaylistRow{}, err
	}
	return s.ensureFavoritesPlaylist()
}

func (s *CloudPlayerService) ListFavoriteSourceIDs() ([]string, error) {
	if collectionModeIsOnline() {
		return s.listKugouFavoriteSourceIDs()
	}
	playlist, err := s.ensureFavoritesPlaylist()
	if err != nil {
		return nil, err
	}
	rows, err := s.state.DB.Query(`
		SELECT pjmp3_source_id
		FROM playlist_import_items
		WHERE playlist_id = ? AND TRIM(pjmp3_source_id) <> ''
		ORDER BY sort_order ASC, id ASC
	`, playlist.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []string
	for rows.Next() {
		var sourceID string
		if err := rows.Scan(&sourceID); err != nil {
			return nil, err
		}
		result = append(result, strings.TrimSpace(sourceID))
	}
	return result, rows.Err()
}

func (s *CloudPlayerService) AddFavoriteTrack(track FavoriteTrackIn) error {
	if collectionModeIsOnline() {
		return s.addKugouFavoriteTrack(track)
	}
	if collectionModeIsHybrid() {
		return s.addHybridFavoriteTrack(track)
	}
	return s.addLocalFavoriteTrack(track)
}

func (s *CloudPlayerService) addLocalFavoriteTrack(track FavoriteTrackIn) error {
	playlist, err := s.ensureFavoritesPlaylist()
	if err != nil {
		return err
	}
	sourceID := strings.TrimSpace(track.Pjmp3SourceID)
	if sourceID == "" {
		return fmt.Errorf("喜欢歌曲需要曲库 source id")
	}
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)
	if _, err := tx.Exec(`DELETE FROM playlist_import_items WHERE playlist_id = ? AND pjmp3_source_id = ?`, playlist.ID, sourceID); err != nil {
		return err
	}
	var position int64
	if err := tx.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM playlist_import_items WHERE playlist_id = ?`, playlist.ID).Scan(&position); err != nil {
		return err
	}
	durationMS := track.DurationMS
	if durationMS < 0 {
		durationMS = 0
	}
	_, err = tx.Exec(`
		INSERT INTO playlist_import_items (
			playlist_id, sort_order, title, artist, album, play_url, pjmp3_source_id,
			cover_url, cover_cache_path, duration_ms, audio_cache_path
		) VALUES (?, ?, ?, ?, ?, '', ?, ?, '', ?, '')
	`, playlist.ID, position, strings.TrimSpace(track.Title), strings.TrimSpace(track.Artist), strings.TrimSpace(track.Album), sourceID, strings.TrimSpace(track.CoverURL), durationMS)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *CloudPlayerService) RemoveFavoriteTrack(sourceID string) error {
	if collectionModeIsOnline() {
		return s.removeKugouFavoriteTrack(sourceID)
	}
	if collectionModeIsHybrid() {
		return s.removeHybridFavoriteTrack(sourceID)
	}
	return s.removeLocalFavoriteTrack(sourceID)
}

func (s *CloudPlayerService) removeLocalFavoriteTrack(sourceID string) error {
	playlist, err := s.ensureFavoritesPlaylist()
	if err != nil {
		return err
	}
	trimmed := strings.TrimSpace(sourceID)
	if trimmed == "" {
		return fmt.Errorf("source id 不能为空")
	}
	_, err = s.state.DB.Exec(`DELETE FROM playlist_import_items WHERE playlist_id = ? AND pjmp3_source_id = ?`, playlist.ID, trimmed)
	return err
}

func (s *CloudPlayerService) ensureFavoritesPlaylist() (PlaylistRow, error) {
	if err := s.migrateLegacyLikedTracks(); err != nil {
		return PlaylistRow{}, err
	}
	var row PlaylistRow
	var cloudListID sql.NullInt64
	err := s.state.DB.QueryRow(`
		SELECT id, name, is_builtin, cloud_source, cloud_list_id, cloud_writable
		FROM playlists
		WHERE is_builtin = 1 OR name = ?
		ORDER BY is_builtin DESC, id ASC
		LIMIT 1
	`, builtinFavoritesName).Scan(&row.ID, &row.Name, &row.IsBuiltin, &row.CloudSource, &cloudListID, &row.CloudWritable)
	if err == nil {
		if !row.IsBuiltin || strings.TrimSpace(row.Name) != builtinFavoritesName {
			if _, updateErr := s.state.DB.Exec(`UPDATE playlists SET name = ?, is_builtin = 1 WHERE id = ?`, builtinFavoritesName, row.ID); updateErr != nil {
				return PlaylistRow{}, updateErr
			}
			row.Name = builtinFavoritesName
			row.IsBuiltin = true
		}
		if cloudListID.Valid && cloudListID.Int64 > 0 {
			value := cloudListID.Int64
			row.CloudListID = &value
			row.IsCloud = true
		}
		row.IsFavorites = true
		return row, nil
	}
	result, err := s.state.DB.Exec(`INSERT INTO playlists (name, is_builtin) VALUES (?, 1)`, builtinFavoritesName)
	if err != nil {
		return PlaylistRow{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return PlaylistRow{}, err
	}
	return PlaylistRow{ID: id, Name: builtinFavoritesName, IsBuiltin: true}, nil
}

func (s *CloudPlayerService) migrateLegacyLikedTracks() error {
	playlist, err := s.lookupFavoritesPlaylist()
	if err != nil {
		return err
	}
	if playlist.ID == 0 {
		result, err := s.state.DB.Exec(`INSERT INTO playlists (name, is_builtin) VALUES (?, 1)`, builtinFavoritesName)
		if err != nil {
			return err
		}
		playlist.ID, err = result.LastInsertId()
		if err != nil {
			return err
		}
	}
	rows, err := s.state.DB.Query(`
		SELECT title, artist, album, pjmp3_source_id
		FROM liked_tracks
		WHERE TRIM(pjmp3_source_id) <> ''
		ORDER BY key ASC
	`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)
	var position int64
	if err := tx.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM playlist_import_items WHERE playlist_id = ?`, playlist.ID).Scan(&position); err != nil {
		return err
	}
	for rows.Next() {
		var title, artist, album, sourceID string
		if err := rows.Scan(&title, &artist, &album, &sourceID); err != nil {
			return err
		}
		if _, err := tx.Exec(`
			INSERT INTO playlist_import_items (
				playlist_id, sort_order, title, artist, album, play_url, pjmp3_source_id,
				cover_url, cover_cache_path, duration_ms, audio_cache_path
			)
			SELECT ?, ?, ?, ?, ?, '', ?, '', '', 0, ''
			WHERE NOT EXISTS (
				SELECT 1 FROM playlist_import_items WHERE playlist_id = ? AND pjmp3_source_id = ?
			)
		`, playlist.ID, position, strings.TrimSpace(title), strings.TrimSpace(artist), strings.TrimSpace(album), strings.TrimSpace(sourceID), playlist.ID, strings.TrimSpace(sourceID)); err != nil {
			return err
		}
		position++
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM liked_tracks`); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *CloudPlayerService) lookupFavoritesPlaylist() (PlaylistRow, error) {
	var row PlaylistRow
	var cloudListID sql.NullInt64
	err := s.state.DB.QueryRow(`
		SELECT id, name, is_builtin, cloud_source, cloud_list_id, cloud_writable
		FROM playlists
		WHERE is_builtin = 1 OR name = ?
		ORDER BY is_builtin DESC, id ASC
		LIMIT 1
	`, builtinFavoritesName).Scan(&row.ID, &row.Name, &row.IsBuiltin, &row.CloudSource, &cloudListID, &row.CloudWritable)
	if err != nil {
		return PlaylistRow{}, nil
	}
	if cloudListID.Valid && cloudListID.Int64 > 0 {
		value := cloudListID.Int64
		row.CloudListID = &value
		row.IsCloud = true
	}
	row.IsFavorites = true
	return row, nil
}
