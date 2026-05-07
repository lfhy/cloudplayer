package cloudplayer

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"cloudplayer/backend/config"
	"cloudplayer/backend/importplaylist"
	"cloudplayer/backend/musicsource"
	kg "github.com/lfhy/kugou-music-api"
)

// Kugou playlist sync reads the logged-in cloud library and maps it into the existing import DTOs.
func (s *CloudPlayerService) ListKugouPlaylists() ([]KugouPlaylistRow, error) {
	client, session, err := kugouClientFromSession()
	if err != nil {
		return nil, err
	}
	userID, parseErr := strconv.ParseInt(strings.TrimSpace(session.Cookie["userid"]), 10, 64)
	if parseErr != nil {
		return nil, fmt.Errorf("酷狗登录态中的用户 ID 无效")
	}
	if userID <= 0 {
		return nil, fmt.Errorf("请先登录酷狗 Lite")
	}
	resp, err := client.UserPlaylist(context.Background(), kg.UserPlaylistRequest{
		Page:     1,
		Pagesize: 100,
		Userid:   int(userID),
		Token:    strings.TrimSpace(session.Cookie["token"]),
	})
	if err != nil {
		return nil, err
	}
	items := kugouFindPlaylistItems(resp.Body)
	rows := make([]KugouPlaylistRow, 0, len(items))
	for _, item := range items {
		id := int64(kugouMapInt(item, "listid", "list_id", "id"))
		name := strings.TrimSpace(kugouMapString(item, "listname", "list_name", "name", "title"))
		if id <= 0 || name == "" {
			continue
		}
		count := kugouMapInt(item, "song_count", "count", "total", "music_count")
		rows = append(rows, KugouPlaylistRow{
			ID:         id,
			Name:       name,
			CoverURL:   kugouMapCover(item),
			TrackCount: count,
		})
	}
	return rows, nil
}

func (s *CloudPlayerService) SyncKugouPlaylist(listID int64) (SharePlaylistResponse, error) {
	client, session, err := kugouClientFromSession()
	if err != nil {
		return SharePlaylistResponse{}, err
	}
	if listID <= 0 {
		return SharePlaylistResponse{}, fmt.Errorf("无效的酷狗歌单 ID")
	}
	items, err := fetchAllKugouPlaylistTracks(client, session, listID)
	if err != nil {
		return SharePlaylistResponse{}, err
	}
	detailResp, detailErr := client.PlaylistDetail(context.Background(), kg.PlaylistDetailRequest{
		Ids:    fmt.Sprintf("%d", listID),
		Token:  strings.TrimSpace(session.Cookie["token"]),
		Userid: strings.TrimSpace(session.Cookie["userid"]),
		Cookie: session.Cookie,
	})
	if detailErr != nil && !kugouUpstream404(detailErr) {
		return SharePlaylistResponse{}, detailErr
	}
	name := ""
	if detailResp != nil {
		if detailName := kugouFindPlaylistName(detailResp.Body); strings.TrimSpace(detailName) != "" {
			name = detailName
		}
	}
	if name == "酷狗同步歌单" {
		name = ""
	}
	if name == "" {
		if fallback := s.kugouPlaylistNameByID(listID); fallback != "" {
			name = fallback
		}
	}
	tracks := make([]importplaylist.ImportedTrackDTO, 0, len(items))
	fileIDs := make([]int64, 0, len(items))
	for _, item := range items {
		hash := strings.ToLower(strings.TrimSpace(kugouMapString(item, "hash", "audio_hash", "file_hash", "hash_128")))
		title := kugouTrackTitle(item)
		if hash == "" || title == "" {
			continue
		}
		albumAudioID := kugouMapInt(item, "album_audio_id", "mixsongid", "mixsong_id", "albumaudioid")
		tracks = append(tracks, importplaylist.ImportedTrackDTO{
			Title:         title,
			Artist:        kugouTrackArtist(item),
			Album:         kugouTrackAlbum(item),
			Pjmp3SourceID: musicsource.EncodeSourceID(musicsource.ProviderKugou, encodeKugouImportRawID(hash, albumAudioID)),
			CoverURL:      kugouMapCoverString(item),
			DurationMS:    kugouTrackDurationMS(item),
		})
		fileIDs = append(fileIDs, int64(kugouMapInt(item, "fileid", "file_id")))
	}
	return SharePlaylistResponse{PlaylistName: name, Tracks: tracks, KugouFileIDs: fileIDs}, nil
}

func encodeKugouImportRawID(hash string, albumAudioID int) string {
	hash = strings.ToLower(strings.TrimSpace(hash))
	if albumAudioID <= 0 {
		return hash
	}
	return fmt.Sprintf("%s|%d", hash, albumAudioID)
}

func kugouUpstream404(err error) bool {
	return err != nil && strings.Contains(err.Error(), "upstream status 404")
}

func fetchAllKugouPlaylistTracks(client *kg.Client, session config.KugouSession, listID int64) ([]map[string]any, error) {
	const pageSize = 100
	seen := map[string]struct{}{}
	out := make([]map[string]any, 0, pageSize)
	for page := 1; page <= 12; page++ {
		resp, err := client.PlaylistTrackAllNew(context.Background(), kg.PlaylistTrackAllNewRequest{
			Listid:   listID,
			Page:     page,
			Pagesize: pageSize,
			Token:    strings.TrimSpace(session.Cookie["token"]),
			Userid:   strings.TrimSpace(session.Cookie["userid"]),
			Cookie:   session.Cookie,
		})
		if err != nil && kugouUpstream404(err) {
			resp, err = client.PlaylistTrackAll(context.Background(), kg.PlaylistTrackAllRequest{
				Id:       listID,
				Page:     page,
				Pagesize: pageSize,
				Cookie:   session.Cookie,
			})
		}
		if err != nil {
			return nil, err
		}
		items := kugouFindTrackItems(resp.Body)
		if len(items) == 0 {
			break
		}
		before := len(out)
		for _, item := range items {
			key := kugouTrackKey(item)
			if key == "" {
				continue
			}
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			out = append(out, item)
		}
		if len(items) < pageSize || len(out) == before {
			break
		}
	}
	return out, nil
}

func kugouTrackKey(item map[string]any) string {
	hash := strings.ToLower(strings.TrimSpace(kugouMapString(item, "hash", "audio_hash", "file_hash", "hash_128")))
	if hash == "" {
		return ""
	}
	return fmt.Sprintf("%s|%d", hash, kugouMapInt(item, "mixsongid", "mixsong_id", "album_audio_id", "albumaudioid"))
}

func (s *CloudPlayerService) kugouPlaylistNameByID(listID int64) string {
	rows, err := s.ListKugouPlaylists()
	if err != nil {
		return ""
	}
	for _, row := range rows {
		if row.ID == listID {
			return strings.TrimSpace(row.Name)
		}
	}
	return ""
}
