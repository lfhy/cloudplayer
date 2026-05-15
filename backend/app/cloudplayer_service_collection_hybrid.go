package cloudplayer

import (
	"database/sql"
	"strings"

	"cloudplayer/backend/config"
	"cloudplayer/backend/importplaylist"
)

const kugouSyncOrigin = "kugou"

// Hybrid playlist helpers keep cloud fork / merge behavior out of the generic CRUD file.
func (s *CloudPlayerService) ensureHybridKugouPlaylistForks(force bool) error {
	if !collectionModeIsHybrid() {
		return nil
	}
	rows, err := s.loadKugouPlaylistRows(force)
	if err != nil {
		return err
	}
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)
	for _, cloud := range rows {
		if cloud.ID <= 0 {
			continue
		}
		if err := s.upsertHybridPlaylistForkTx(tx, cloud); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(`
		UPDATE playlists
		SET cloud_writable = 0
		WHERE cloud_source = ? AND cloud_list_id > 0
	`, kugouSyncOrigin); err != nil {
		return err
	}
	for _, cloud := range rows {
		if _, err := tx.Exec(`
			UPDATE playlists
			SET cloud_writable = 1
			WHERE cloud_source = ? AND cloud_list_id = ?
		`, kugouSyncOrigin, cloud.ID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *CloudPlayerService) upsertHybridPlaylistForkTx(tx *sql.Tx, cloud KugouPlaylistRow) error {
	name := strings.TrimSpace(cloud.Name)
	if name == "" || cloud.ID <= 0 {
		return nil
	}
	if cloud.IsFavorites || name == builtinFavoritesName {
		_, err := tx.Exec(`
			INSERT INTO playlists (name, is_builtin, cloud_source, cloud_list_id, cloud_writable)
			VALUES (?, 1, ?, ?, 1)
			ON CONFLICT(id) DO NOTHING
		`, builtinFavoritesName, kugouSyncOrigin, cloud.ID)
		if err != nil {
			// Ignore and continue to generic upsert path below, because playlists.id has no usable conflict target here.
		}
	}
	var playlistID int64
	var isBuiltin bool
	queryErr := tx.QueryRow(`
		SELECT id, is_builtin
		FROM playlists
		WHERE cloud_source = ? AND cloud_list_id = ?
		LIMIT 1
	`, kugouSyncOrigin, cloud.ID).Scan(&playlistID, &isBuiltin)
	switch {
	case queryErr == nil:
		targetName := name
		if cloud.IsFavorites || name == builtinFavoritesName {
			targetName = builtinFavoritesName
			isBuiltin = true
		}
		_, err := tx.Exec(`
			UPDATE playlists
			SET name = ?, is_builtin = ?, cloud_writable = 1
			WHERE id = ?
		`, targetName, boolToInt(isBuiltin || cloud.IsFavorites), playlistID)
		return err
	case queryErr != sql.ErrNoRows:
		return queryErr
	}

	targetName := name
	isBuiltin = false
	if cloud.IsFavorites || name == builtinFavoritesName {
		targetName = builtinFavoritesName
		isBuiltin = true
	}
	_, err := tx.Exec(`
		INSERT INTO playlists (name, is_builtin, cloud_source, cloud_list_id, cloud_writable)
		VALUES (?, ?, ?, ?, 1)
	`, targetName, boolToInt(isBuiltin), kugouSyncOrigin, cloud.ID)
	return err
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func (s *CloudPlayerService) ensureHybridPlaylistItems(playlistID int64, force bool) ([]PlaylistImportItemRow, error) {
	playlist, err := s.localPlaylistByID(playlistID)
	if err != nil {
		return nil, err
	}
	if playlist.CloudSource != kugouSyncOrigin || playlist.CloudListID == nil || *playlist.CloudListID <= 0 {
		return s.listLocalPlaylistImportItems(playlistID)
	}
	if force {
		if err := s.refreshHybridPlaylistItems(playlist); err != nil {
			return nil, err
		}
		return s.listLocalPlaylistImportItems(playlistID)
	}

	var count int64
	if err := s.state.DB.QueryRow(`
		SELECT COUNT(*)
		FROM playlist_import_items
		WHERE playlist_id = ? AND sync_origin = ?
	`, playlistID, kugouSyncOrigin).Scan(&count); err != nil {
		return nil, err
	}
	if count == 0 {
		if err := s.refreshHybridPlaylistItems(playlist); err != nil {
			return nil, err
		}
	}
	return s.listLocalPlaylistImportItems(playlistID)
}

func (s *CloudPlayerService) refreshHybridPlaylists() ([]PlaylistRow, error) {
	if err := s.ensureHybridKugouPlaylistForks(true); err != nil {
		return nil, err
	}
	playlists, err := s.listLocalPlaylists()
	if err != nil {
		return nil, err
	}
	for _, playlist := range playlists {
		if playlist.CloudSource != kugouSyncOrigin || playlist.CloudListID == nil || *playlist.CloudListID <= 0 || !playlist.CloudWritable {
			continue
		}
		if err := s.refreshHybridPlaylistItems(playlist); err != nil {
			return nil, err
		}
	}
	return s.listLocalPlaylists()
}

func (s *CloudPlayerService) refreshHybridPlaylistItems(playlist PlaylistRow) error {
	if !playlist.CloudWritable {
		return nil
	}
	cloudListID, err := requireLocalPlaylistCloudTarget(playlist, kugouSyncOrigin)
	if err != nil {
		return err
	}
	rows, err := s.refreshKugouPlaylistItems(cloudListID)
	if err != nil {
		return err
	}
	return s.mergeHybridCloudItems(playlist.ID, rows)
}

func (s *CloudPlayerService) mergeHybridCloudItems(playlistID int64, cloudRows []PlaylistImportItemRow) error {
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)
	if _, err := tx.Exec(`
		DELETE FROM playlist_import_items
		WHERE playlist_id = ? AND sync_origin = ?
	`, playlistID, kugouSyncOrigin); err != nil {
		return err
	}

	var localOffset int64
	if err := tx.QueryRow(`
		SELECT COALESCE(MAX(sort_order), -1) + 1
		FROM playlist_import_items
		WHERE playlist_id = ? AND sync_origin <> ?
	`, playlistID, kugouSyncOrigin).Scan(&localOffset); err != nil {
		return err
	}
	for index, row := range reversePlaylistImportItems(cloudRows) {
		if _, err := tx.Exec(`
			INSERT INTO playlist_import_items (
				playlist_id, sort_order, title, artist, album, play_url, pjmp3_source_id,
				kugou_file_id, sync_origin, cover_url, cover_cache_path, duration_ms, audio_cache_path
			) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, '', ?, '')
		`, playlistID, localOffset+int64(index), strings.TrimSpace(row.Title), strings.TrimSpace(row.Artist), strings.TrimSpace(row.Album), strings.TrimSpace(row.Pjmp3SourceID), maxInt64(row.KugouFileID, 0), kugouSyncOrigin, strings.TrimSpace(row.CoverURL), maxInt64(row.DurationMS, 0)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *CloudPlayerService) appendHybridPlaylistItems(playlist PlaylistRow, items []importplaylist.ImportedTrackDTO) error {
	cloudListID, err := requireLocalPlaylistCloudTarget(playlist, kugouSyncOrigin)
	if err == nil {
		if err := s.appendKugouPlaylistItems(cloudListID, items); err == nil {
			return s.refreshHybridPlaylistItems(playlist)
		} else if !collectionModeAllowsLocalFallback() {
			return err
		}
	}
	return s.appendLocalPlaylistItems(playlist.ID, items, syncOriginForPlaylistRow(playlist))
}

func (s *CloudPlayerService) replaceHybridPlaylistItems(playlist PlaylistRow, items []importplaylist.ImportedTrackDTO) error {
	cloudListID, err := requireLocalPlaylistCloudTarget(playlist, kugouSyncOrigin)
	if err == nil {
		if err := s.replaceKugouPlaylistItems(cloudListID, items); err == nil {
			return s.refreshHybridPlaylistItems(playlist)
		} else if !collectionModeAllowsLocalFallback() {
			return err
		}
	}
	return s.replaceLocalPlaylistItems(playlist.ID, items, syncOriginForPlaylistRow(playlist))
}

func (s *CloudPlayerService) renameHybridPlaylist(playlist PlaylistRow, name string) error {
	cloudListID, err := requireLocalPlaylistCloudTarget(playlist, kugouSyncOrigin)
	if err == nil {
		if err := s.renameKugouPlaylist(cloudListID, name); err == nil {
			_, updateErr := s.state.DB.Exec(`UPDATE playlists SET name = ? WHERE id = ?`, name, playlist.ID)
			return updateErr
		} else if !collectionModeAllowsLocalFallback() {
			return err
		}
	}
	_, updateErr := s.state.DB.Exec(`UPDATE playlists SET name = ? WHERE id = ?`, name, playlist.ID)
	return updateErr
}

func (s *CloudPlayerService) createHybridPlaylist(name string) (int64, error) {
	cloudListID, err := s.createKugouPlaylist(name)
	if err == nil {
		localID, createErr := s.createLocalPlaylist(name, kugouSyncOrigin, cloudListID, true)
		if createErr != nil {
			return 0, createErr
		}
		return localID, s.refreshHybridPlaylistItems(PlaylistRow{
			ID:            localID,
			Name:          name,
			CloudSource:   kugouSyncOrigin,
			CloudListID:   &cloudListID,
			CloudWritable: true,
		})
	}
	if !collectionModeAllowsLocalFallback() {
		return 0, err
	}
	return s.createLocalPlaylist(name, "", 0, false)
}

func (s *CloudPlayerService) deleteHybridPlaylist(playlist PlaylistRow) error {
	cloudListID, err := requireLocalPlaylistCloudTarget(playlist, kugouSyncOrigin)
	if err == nil {
		if err := s.deleteKugouPlaylist(cloudListID); err == nil {
			return s.deleteLocalPlaylistFully(playlist.ID)
		}
		return err
	}
	return s.deleteLocalPlaylistFully(playlist.ID)
}

func (s *CloudPlayerService) deleteHybridPlaylistImportItem(playlist PlaylistRow, itemID int64) error {
	item, err := s.localPlaylistImportItemByID(playlist.ID, itemID)
	if err != nil {
		return err
	}
	if item.SyncOrigin == kugouSyncOrigin && item.KugouFileID > 0 {
		cloudListID, targetErr := requireLocalPlaylistCloudTarget(playlist, kugouSyncOrigin)
		if targetErr != nil {
			return targetErr
		}
		if err := s.deleteKugouPlaylistItems(cloudListID, []int64{item.KugouFileID}); err != nil {
			return err
		}
		return s.refreshHybridPlaylistItems(playlist)
	}
	return s.deleteLocalPlaylistImportItem(playlist.ID, itemID)
}

func (s *CloudPlayerService) addHybridFavoriteTrack(track FavoriteTrackIn) error {
	if err := s.addKugouFavoriteTrack(track); err == nil {
		playlist, ensureErr := s.ensureFavoritesPlaylist()
		if ensureErr != nil {
			return ensureErr
		}
		if playlist.CloudSource == kugouSyncOrigin && playlist.CloudListID != nil && *playlist.CloudListID > 0 {
			return s.refreshHybridPlaylistItems(playlist)
		}
		return nil
	} else if !collectionModeAllowsLocalFallback() {
		return err
	}
	return s.addLocalFavoriteTrack(track)
}

func (s *CloudPlayerService) removeHybridFavoriteTrack(sourceID string) error {
	err := s.removeKugouFavoriteTrack(sourceID)
	if err == nil {
		playlist, ensureErr := s.ensureFavoritesPlaylist()
		if ensureErr != nil {
			return ensureErr
		}
		if playlist.CloudSource == kugouSyncOrigin && playlist.CloudListID != nil && *playlist.CloudListID > 0 {
			return s.refreshHybridPlaylistItems(playlist)
		}
		return nil
	}
	if !collectionModeAllowsLocalFallback() {
		return err
	}
	return err
}

func (s *CloudPlayerService) syncHybridCollectionsAfterModeChange(mode string) error {
	if config.NormalizeMusicCollectionMode(mode) != config.MusicCollectionModeHybrid {
		return nil
	}
	return s.ensureHybridKugouPlaylistForks(true)
}
