package cloudplayer

import (
	"fmt"
	"strings"
	"time"

	"cloudplayer/backend/core/cloudplayer/importplaylist"
)

// Batch import keeps the frontend flow simple when users pick multiple Kugou playlists at once.
func (s *CloudPlayerService) SyncKugouPlaylists(listIDs []int64) (SharePlaylistResponse, error) {
	ids := normalizeKugouPlaylistIDs(listIDs)
	if len(ids) == 0 {
		return SharePlaylistResponse{}, fmt.Errorf("请至少选择一个酷狗歌单")
	}
	if len(ids) == 1 {
		return s.SyncKugouPlaylist(ids[0])
	}
	tracks := make([]importplaylist.ImportedTrackDTO, 0, 256)
	names := make([]string, 0, len(ids))
	for _, listID := range ids {
		result, err := s.SyncKugouPlaylist(listID)
		if err != nil {
			return SharePlaylistResponse{}, err
		}
		if name := strings.TrimSpace(result.PlaylistName); name != "" {
			names = append(names, name)
		}
		tracks = append(tracks, result.Tracks...)
	}
	return SharePlaylistResponse{
		PlaylistName: kugouBatchPlaylistName(names),
		Tracks:       tracks,
	}, nil
}

func normalizeKugouPlaylistIDs(listIDs []int64) []int64 {
	seen := map[int64]struct{}{}
	out := make([]int64, 0, len(listIDs))
	for _, listID := range listIDs {
		if listID <= 0 {
			continue
		}
		if _, ok := seen[listID]; ok {
			continue
		}
		seen[listID] = struct{}{}
		out = append(out, listID)
	}
	return out
}

func kugouBatchPlaylistName(names []string) string {
	if len(names) == 0 {
		return time.Now().Format("2006-01-02") + " 酷狗导入"
	}
	if len(names) == 1 {
		return names[0]
	}
	return fmt.Sprintf("%s 等 %d 个酷狗歌单", names[0], len(names))
}
