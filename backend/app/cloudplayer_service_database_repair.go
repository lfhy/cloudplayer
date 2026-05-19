package cloudplayer

import "cloudplayer/backend/config"

// MusicCollectionRepairResult reports what the repair flow cleaned before the UI asks for a fresh cloud sync again.
type MusicCollectionRepairResult struct {
	Mode                          string `json:"mode"`
	RemovedCloudPlaylists         int64  `json:"removed_cloud_playlists"`
	DetachedCloudBindings         int64  `json:"detached_cloud_bindings"`
	RemovedPlaylistItems          int64  `json:"removed_playlist_items"`
	RemovedPlaylistSongs          int64  `json:"removed_playlist_songs"`
	ClearedCloudPlaylistCache     int64  `json:"cleared_cloud_playlist_cache"`
	ClearedCloudPlaylistItemCache int64  `json:"cleared_cloud_playlist_item_cache"`
}

// RepairMusicCollectionDatabase clears local cloud forks and cached Kugou playlist snapshots before forcing a clean offline reset.
func (s *CloudPlayerService) RepairMusicCollectionDatabase() (MusicCollectionRepairResult, error) {
	previousSettings := config.LoadSettings()
	repairedSettings := previousSettings
	repairedSettings.MusicCollectionMode = config.MusicCollectionModeOffline
	repairedSettings.MusicOnlineMode = false
	if err := config.SaveSettings(repairedSettings); err != nil {
		return MusicCollectionRepairResult{}, err
	}
	result, err := withSQLiteBusyRetryValue(func() (MusicCollectionRepairResult, error) {
		return s.repairMusicCollectionDatabase()
	})
	if err != nil {
		_ = config.SaveSettings(previousSettings)
		return MusicCollectionRepairResult{}, err
	}
	result.Mode = repairedSettings.MusicCollectionMode
	return result, nil
}

func (s *CloudPlayerService) repairMusicCollectionDatabase() (MusicCollectionRepairResult, error) {
	tx, err := s.state.DB.Begin()
	if err != nil {
		return MusicCollectionRepairResult{}, err
	}
	defer rollback(tx)

	var result MusicCollectionRepairResult
	if result.RemovedPlaylistItems, err = execRowsAffected(tx, `
		DELETE FROM playlist_import_items
		WHERE playlist_id IN (
			SELECT id
			FROM playlists
			WHERE TRIM(cloud_source) = ? AND cloud_list_id > 0 AND is_builtin = 0
		)
	`, kugouSyncOrigin); err != nil {
		return MusicCollectionRepairResult{}, err
	}
	removedCloudItems, err := execRowsAffected(tx, `
		DELETE FROM playlist_import_items
		WHERE sync_origin = ?
	`, kugouSyncOrigin)
	if err != nil {
		return MusicCollectionRepairResult{}, err
	}
	result.RemovedPlaylistItems += removedCloudItems
	if result.RemovedPlaylistSongs, err = execRowsAffected(tx, `
		DELETE FROM playlist_songs
		WHERE playlist_id IN (
			SELECT id
			FROM playlists
			WHERE TRIM(cloud_source) = ? AND cloud_list_id > 0 AND is_builtin = 0
		)
	`, kugouSyncOrigin); err != nil {
		return MusicCollectionRepairResult{}, err
	}
	if result.RemovedCloudPlaylists, err = execRowsAffected(tx, `
		DELETE FROM playlists
		WHERE TRIM(cloud_source) = ? AND cloud_list_id > 0 AND is_builtin = 0
	`, kugouSyncOrigin); err != nil {
		return MusicCollectionRepairResult{}, err
	}
	if result.DetachedCloudBindings, err = execRowsAffected(tx, `
		UPDATE playlists
		SET cloud_source = '', cloud_list_id = 0, cloud_writable = 0
		WHERE TRIM(cloud_source) = ?
	`, kugouSyncOrigin); err != nil {
		return MusicCollectionRepairResult{}, err
	}
	if result.ClearedCloudPlaylistItemCache, err = execRowsAffected(tx, `
		DELETE FROM kugou_playlist_cache_items
	`); err != nil {
		return MusicCollectionRepairResult{}, err
	}
	if result.ClearedCloudPlaylistCache, err = execRowsAffected(tx, `
		DELETE FROM kugou_playlist_cache
	`); err != nil {
		return MusicCollectionRepairResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return MusicCollectionRepairResult{}, err
	}
	return result, s.CleanupDuplicateFavoritesPlaylists()
}
