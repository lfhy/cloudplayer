package cloudplayer

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"cloudplayer/backend/config"
	"cloudplayer/backend/importplaylist"
	"cloudplayer/backend/musicsource"
	kg "github.com/lfhy/kugou-music-api"
)

// Online-mode mutations keep cloud playlist CRUD isolated from the local library path.
func (s *CloudPlayerService) createKugouPlaylist(name string) (int64, error) {
	client, session, err := kugouClientFromSession()
	if err != nil {
		return 0, err
	}
	created, err := client.CreatePlaylist(context.Background(), strings.TrimSpace(name), false, session.Cookie)
	if err != nil {
		return 0, err
	}
	if created == nil || created.ListID <= 0 {
		return 0, fmt.Errorf("创建云歌单失败")
	}
	if _, err := s.refreshKugouPlaylistList(); err != nil {
		return 0, err
	}
	return int64(created.ListID), nil
}

func (s *CloudPlayerService) deleteKugouPlaylist(playlistID int64) error {
	client, session, err := kugouClientFromSession()
	if err != nil {
		return err
	}
	if playlistID <= 0 {
		return fmt.Errorf("歌单不存在")
	}
	if _, err := client.PlaylistDel(context.Background(), kg.PlaylistDelRequest{
		Listid: int(playlistID),
		Cookie: session.Cookie,
	}); err != nil {
		return err
	}
	userID, idErr := kugouOnlineCacheUserID()
	if idErr == nil {
		if err := s.deleteKugouPlaylistCache(userID, playlistID); err != nil {
			return err
		}
	}
	_, err = s.refreshKugouPlaylistList()
	return err
}

func (s *CloudPlayerService) renameKugouPlaylist(playlistID int64, name string) error {
	client, session, err := kugouClientFromSession()
	if err != nil {
		return err
	}
	name = strings.TrimSpace(name)
	if playlistID <= 0 {
		return fmt.Errorf("歌单不存在")
	}
	if name == "" {
		return fmt.Errorf("歌单名称不能为空")
	}
	userID := strings.TrimSpace(session.Cookie["userid"])
	if userID == "" {
		return fmt.Errorf("请先登录酷狗概念版")
	}
	if _, err := client.PlaylistAdd(context.Background(), kg.PlaylistAddRequest{
		Name:             name,
		Type:             0,
		Source:           1,
		IsPri:            0,
		ListCreateUserid: userID,
		ListCreateListid: playlistID,
		Cookie:           session.Cookie,
	}); err != nil {
		return err
	}
	_, err = s.refreshKugouPlaylistList()
	return err
}

func (s *CloudPlayerService) appendKugouPlaylistItems(playlistID int64, items []importplaylist.ImportedTrackDTO) error {
	client, session, err := kugouClientFromSession()
	if err != nil {
		return err
	}
	tracks, err := kugouTracksFromImportItems(items)
	if err != nil {
		return err
	}
	if len(tracks) == 0 {
		return fmt.Errorf("没有可添加到云歌单的酷狗曲目")
	}
	if _, err := client.AddTracksToPlaylist(context.Background(), int(playlistID), tracks, session.Cookie); err != nil {
		return err
	}
	_, err = s.refreshKugouPlaylistItems(playlistID)
	return err
}

func (s *CloudPlayerService) replaceKugouPlaylistItems(playlistID int64, items []importplaylist.ImportedTrackDTO) error {
	userID, err := kugouOnlineCacheUserID()
	if err != nil {
		return err
	}
	current, _, err := s.readKugouPlaylistItemsCache(userID, playlistID)
	if err != nil {
		return err
	}
	if len(current) > 0 {
		fileIDs := make([]int64, 0, len(current))
		for _, row := range current {
			if row.KugouFileID > 0 {
				fileIDs = append(fileIDs, row.KugouFileID)
			}
		}
		if len(fileIDs) > 0 {
			if err := s.deleteKugouPlaylistItems(playlistID, fileIDs); err != nil {
				return err
			}
		}
	}
	if len(items) == 0 {
		_, err = s.refreshKugouPlaylistItems(playlistID)
		return err
	}
	return s.appendKugouPlaylistItems(playlistID, items)
}

func (s *CloudPlayerService) deleteKugouPlaylistImportItem(playlistID, fileID int64) error {
	return s.deleteKugouPlaylistItems(playlistID, []int64{fileID})
}

func (s *CloudPlayerService) deleteKugouPlaylistItems(playlistID int64, fileIDs []int64) error {
	client, session, err := kugouClientFromSession()
	if err != nil {
		return err
	}
	parts := make([]string, 0, len(fileIDs))
	for _, fileID := range fileIDs {
		if fileID > 0 {
			parts = append(parts, strconv.FormatInt(fileID, 10))
		}
	}
	if len(parts) == 0 {
		return fmt.Errorf("未找到该导入条目")
	}
	if _, err := client.PlaylistTracksDel(context.Background(), kg.PlaylistTracksDelRequest{
		Listid:  int(playlistID),
		Fileids: strings.Join(parts, ","),
		Cookie:  session.Cookie,
	}); err != nil {
		return err
	}
	_, err = s.refreshKugouPlaylistItems(playlistID)
	return err
}

func kugouTracksFromImportItems(items []importplaylist.ImportedTrackDTO) ([]kg.RadioTrack, error) {
	tracks := make([]kg.RadioTrack, 0, len(items))
	for _, item := range items {
		ref, err := musicsource.ParseSourceID(item.Pjmp3SourceID)
		if err != nil || ref.ProviderKey != musicsource.ProviderKugou {
			continue
		}
		hash, albumAudioID := decodeKugouImportRawID(ref.RawID)
		if hash == "" {
			continue
		}
		tracks = append(tracks, kg.RadioTrack{
			Name:         strings.TrimSpace(item.Title),
			Hash:         hash,
			AlbumAudioID: albumAudioID,
		})
	}
	if len(tracks) == 0 {
		return nil, fmt.Errorf("在线模式下仅支持写入酷狗云端曲目")
	}
	return tracks, nil
}

func decodeKugouImportRawID(rawID string) (string, int) {
	parts := strings.SplitN(strings.TrimSpace(rawID), "|", 2)
	hash := strings.ToLower(strings.TrimSpace(parts[0]))
	if hash == "" {
		return "", 0
	}
	if len(parts) == 1 {
		return hash, 0
	}
	value, _ := strconv.Atoi(strings.TrimSpace(parts[1]))
	return hash, value
}

func (s *CloudPlayerService) deleteKugouPlaylistCache(userID string, playlistID int64) error {
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)
	if _, err := tx.Exec(`DELETE FROM kugou_playlist_cache_items WHERE user_id = ? AND playlist_id = ?`, strings.TrimSpace(userID), playlistID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM kugou_playlist_cache WHERE user_id = ? AND playlist_id = ?`, strings.TrimSpace(userID), playlistID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *CloudPlayerService) touchKugouPlaylistCache(userID string, playlistID int64, name string) error {
	coverURL := ""
	trackCount := 0
	if cached, _, err := s.readKugouPlaylistCache(strings.TrimSpace(userID)); err == nil {
		for _, row := range cached {
			if row.ID != playlistID {
				continue
			}
			if row.CoverURL != nil {
				coverURL = strings.TrimSpace(*row.CoverURL)
			}
			trackCount = row.TrackCount
			break
		}
	}
	_, err := s.state.DB.Exec(`
		INSERT INTO kugou_playlist_cache (user_id, playlist_id, sort_order, name, cover_url, track_count, fetched_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, playlist_id) DO UPDATE SET
			name = excluded.name,
			cover_url = CASE WHEN excluded.cover_url <> '' THEN excluded.cover_url ELSE kugou_playlist_cache.cover_url END,
			track_count = CASE WHEN excluded.track_count > 0 THEN excluded.track_count ELSE kugou_playlist_cache.track_count END,
			fetched_at = excluded.fetched_at
	`, strings.TrimSpace(userID), playlistID, 0, strings.TrimSpace(name), coverURL, trackCount, time.Now().Unix())
	return err
}

func ensureOnlineModeEnabled() error {
	if !config.LoadSettings().MusicOnlineMode {
		return fmt.Errorf("当前未启用在线模式")
	}
	return nil
}
