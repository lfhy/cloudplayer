package cloudplayer

import (
	"fmt"
	"strings"

	"cloudplayer/backend/importenrich"
	"cloudplayer/backend/importplaylist"
)

// Playlist methods own import rows and background enrichment orchestration.
func (s *CloudPlayerService) ListPlaylists() ([]PlaylistRow, error) {
	return withSQLiteBusyRetryValue(func() ([]PlaylistRow, error) {
		if collectionModeIsOnline() {
			rows, err := s.loadKugouPlaylistRows(false)
			if err != nil {
				return nil, err
			}
			return toPlaylistRows(rows), nil
		}
		if collectionModeIsHybrid() {
			if err := s.ensureHybridKugouPlaylistForks(false); err != nil {
				return nil, err
			}
		}
		return s.listLocalPlaylists()
	})
}

func (s *CloudPlayerService) ListPlaylistImportItems(playlistID int64) ([]PlaylistImportItemRow, error) {
	return withSQLiteBusyRetryValue(func() ([]PlaylistImportItemRow, error) {
		if collectionModeIsOnline() {
			return s.loadKugouPlaylistItems(playlistID, false)
		}
		if collectionModeIsHybrid() {
			return s.ensureHybridPlaylistItems(playlistID, false)
		}
		return s.listLocalPlaylistImportItems(playlistID)
	})
}

func (s *CloudPlayerService) CreatePlaylist(name string) (int64, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return 0, fmt.Errorf("歌单名称不能为空")
	}
	if collectionModeIsOnline() {
		return s.createKugouPlaylist(name)
	}
	if collectionModeIsHybrid() {
		return s.createHybridPlaylist(name)
	}
	return s.createLocalPlaylist(name, "", 0, false)
}

func (s *CloudPlayerService) RenamePlaylist(playlistID int64, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("歌单名称不能为空")
	}
	if collectionModeIsOnline() {
		return s.renameKugouPlaylist(playlistID, name)
	}
	playlist, lookupErr := s.localPlaylistByID(playlistID)
	if lookupErr != nil {
		return lookupErr
	}
	if builtin, err := s.isBuiltinPlaylist(playlistID); err != nil {
		return err
	} else if builtin {
		return fmt.Errorf("系统歌单不支持重命名")
	}
	if collectionModeIsHybrid() {
		return s.renameHybridPlaylist(playlist, name)
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
	if collectionModeIsOnline() {
		return s.deleteKugouPlaylist(playlistID)
	}
	playlist, lookupErr := s.localPlaylistByID(playlistID)
	if lookupErr != nil {
		return lookupErr
	}
	if builtin, err := s.isBuiltinPlaylist(playlistID); err != nil {
		return err
	} else if builtin {
		return fmt.Errorf("系统歌单不支持删除")
	}
	if collectionModeIsHybrid() {
		return s.deleteHybridPlaylist(playlist)
	}
	return s.deleteLocalPlaylistFully(playlistID)
}

func (s *CloudPlayerService) DeletePlaylistImportItem(playlistID, itemID int64) error {
	if collectionModeIsOnline() {
		return s.deleteKugouPlaylistImportItem(playlistID, itemID)
	}
	if collectionModeIsHybrid() {
		playlist, lookupErr := s.localPlaylistByID(playlistID)
		if lookupErr != nil {
			return lookupErr
		}
		return s.deleteHybridPlaylistImportItem(playlist, itemID)
	}
	return s.deleteLocalPlaylistImportItem(playlistID, itemID)
}

func (s *CloudPlayerService) ReplacePlaylistImportItems(playlistID int64, items []importplaylist.ImportedTrackDTO) error {
	if collectionModeIsOnline() {
		return s.replaceKugouPlaylistItems(playlistID, items)
	}
	if collectionModeIsHybrid() {
		playlist, lookupErr := s.localPlaylistByID(playlistID)
		if lookupErr != nil {
			return lookupErr
		}
		return s.replaceHybridPlaylistItems(playlist, items)
	}
	return s.replaceLocalPlaylistItems(playlistID, items, "")
}

func (s *CloudPlayerService) AppendPlaylistImportItems(playlistID int64, items []importplaylist.ImportedTrackDTO) error {
	if collectionModeIsOnline() {
		return s.appendKugouPlaylistItems(playlistID, items)
	}
	if collectionModeIsHybrid() {
		playlist, lookupErr := s.localPlaylistByID(playlistID)
		if lookupErr != nil {
			return lookupErr
		}
		return s.appendHybridPlaylistItems(playlist, items)
	}
	return s.appendLocalPlaylistItems(playlistID, items, "")
}

func (s *CloudPlayerService) StartImportEnrich(playlistID int64) error {
	if playlistID <= 0 {
		return fmt.Errorf("无效的歌单 id")
	}
	importenrich.SpawnPlaylistEnrich(s.state.DB, s.state.HTTP(), s.state.RateLimiter, playlistID)
	return nil
}

func (s *CloudPlayerService) isBuiltinPlaylist(playlistID int64) (bool, error) {
	var builtin bool
	err := s.state.DB.QueryRow(`SELECT is_builtin FROM playlists WHERE id = ?`, playlistID).Scan(&builtin)
	if err != nil {
		return false, err
	}
	return builtin, nil
}
