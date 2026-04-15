package main

import (
	"database/sql"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloudplayer/internal/cloudplayer/config"
	"cloudplayer/internal/cloudplayer/download"
	"cloudplayer/internal/cloudplayer/importenrich"
	"cloudplayer/internal/cloudplayer/importplaylist"
	"cloudplayer/internal/cloudplayer/lyrics"
	"cloudplayer/internal/cloudplayer/pjmp3"
	"cloudplayer/internal/cloudplayer/sharelink"
)

const recentPlaysMax = 100

type CloudPlayerService struct {
	state *AppState
}

func NewCloudPlayerService(state *AppState) *CloudPlayerService {
	return &CloudPlayerService{state: state}
}

type SettingsPatch struct {
	Volume                    *float64 `json:"volume,omitempty"`
	LastLibraryFolder         *string  `json:"last_library_folder,omitempty"`
	DailyDownloadLimit        *int64   `json:"daily_download_limit,omitempty"`
	DesktopLyricsVisible      *bool    `json:"desktop_lyrics_visible,omitempty"`
	DesktopLyricsLocked       *bool    `json:"desktop_lyrics_locked,omitempty"`
	DesktopLyricsX            *int     `json:"desktop_lyrics_x,omitempty"`
	DesktopLyricsY            *int     `json:"desktop_lyrics_y,omitempty"`
	DesktopLyricsWidth        *int     `json:"desktop_lyrics_width,omitempty"`
	DesktopLyricsHeight       *int     `json:"desktop_lyrics_height,omitempty"`
	DesktopLyricsScale        *float64 `json:"desktop_lyrics_scale,omitempty"`
	DownloadFolder            *string  `json:"download_folder,omitempty"`
	LyricsNeteaseAPIBase      *string  `json:"lyrics_netease_api_base,omitempty"`
	LyricsLRCLibEnabled       *bool    `json:"lyrics_lrclib_enabled,omitempty"`
	LyricsProviderOrder       *string  `json:"lyrics_provider_order,omitempty"`
	ShareNeteaseCookieEnabled *bool    `json:"share_netease_cookie_enabled,omitempty"`
	ShareNeteaseCookie        *string  `json:"share_netease_cookie,omitempty"`
}

type SearchResponse struct {
	Results []pjmp3.SearchResult `json:"results"`
	HasNext bool                 `json:"has_next"`
}

type ResolveOnlinePlayOut struct {
	Kind string `json:"kind"`
	Path string `json:"path,omitempty"`
	URL  string `json:"url,omitempty"`
	Via  string `json:"via"`
}

type PlaylistRow struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type PlaylistImportItemRow struct {
	ID            int64  `json:"id"`
	SortOrder     int64  `json:"sort_order"`
	Title         string `json:"title"`
	Artist        string `json:"artist"`
	Album         string `json:"album"`
	Pjmp3SourceID string `json:"pjmp3_source_id"`
	CoverURL      string `json:"cover_url"`
	DurationMS    int64  `json:"duration_ms"`
}

type SharePlaylistResponse struct {
	PlaylistName string                            `json:"playlist_name"`
	Tracks       []importplaylist.ImportedTrackDTO `json:"tracks"`
}

type LocalSongRow struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	FilePath string `json:"file_path"`
}

type ScanMusicFolderResult struct {
	AudioFilesSeen int `json:"audio_files_seen"`
	RowsWritten    int `json:"rows_written"`
}

type RecentPlayIn struct {
	Kind          string  `json:"kind"`
	Title         string  `json:"title"`
	Artist        string  `json:"artist"`
	CoverURL      *string `json:"cover_url"`
	Pjmp3SourceID *string `json:"pjmp3_source_id"`
	FilePath      *string `json:"file_path"`
}

type RecentPlayRow struct {
	Kind          string  `json:"kind"`
	Title         string  `json:"title"`
	Artist        string  `json:"artist"`
	CoverURL      *string `json:"cover_url"`
	Pjmp3SourceID *string `json:"pjmp3_source_id"`
	FilePath      *string `json:"file_path"`
	PlayedAt      int64   `json:"played_at"`
}

func (s *CloudPlayerService) GetSettings() config.Settings {
	return config.LoadSettings()
}

func (s *CloudPlayerService) SaveSettings(patch SettingsPatch) error {
	settings := config.LoadSettings()
	if patch.Volume != nil {
		settings.Volume = clampFloat(*patch.Volume, 0, 1)
	}
	if patch.LastLibraryFolder != nil {
		settings.LastLibraryFolder = *patch.LastLibraryFolder
	}
	if patch.DailyDownloadLimit != nil {
		if *patch.DailyDownloadLimit < 0 {
			settings.DailyDownloadLimit = 0
		} else {
			settings.DailyDownloadLimit = *patch.DailyDownloadLimit
		}
	}
	if patch.DesktopLyricsVisible != nil {
		settings.DesktopLyricsVisible = *patch.DesktopLyricsVisible
	}
	if patch.DesktopLyricsLocked != nil {
		settings.DesktopLyricsLocked = *patch.DesktopLyricsLocked
	}
	if patch.DesktopLyricsX != nil {
		settings.DesktopLyricsX = patch.DesktopLyricsX
	}
	if patch.DesktopLyricsY != nil {
		settings.DesktopLyricsY = patch.DesktopLyricsY
	}
	if patch.DesktopLyricsWidth != nil {
		value := maxInt(*patch.DesktopLyricsWidth, 200)
		settings.DesktopLyricsWidth = &value
	}
	if patch.DesktopLyricsHeight != nil {
		value := maxInt(*patch.DesktopLyricsHeight, 72)
		settings.DesktopLyricsHeight = &value
	}
	if patch.DesktopLyricsScale != nil {
		settings.DesktopLyricsScale = clampFloat(*patch.DesktopLyricsScale, 0.5, 2.5)
	}
	if patch.DownloadFolder != nil {
		settings.DownloadFolder = *patch.DownloadFolder
	}
	if patch.LyricsNeteaseAPIBase != nil {
		settings.LyricsNeteaseAPIBase = *patch.LyricsNeteaseAPIBase
	}
	if patch.LyricsLRCLibEnabled != nil {
		settings.LyricsLRCLibEnabled = *patch.LyricsLRCLibEnabled
	}
	if patch.LyricsProviderOrder != nil {
		settings.LyricsProviderOrder = *patch.LyricsProviderOrder
	}
	if patch.ShareNeteaseCookieEnabled != nil {
		settings.ShareNeteaseCookieEnabled = *patch.ShareNeteaseCookieEnabled
	}
	if patch.ShareNeteaseCookie != nil {
		settings.ShareNeteaseCookie = *patch.ShareNeteaseCookie
	}
	return config.SaveSettings(settings)
}

func (s *CloudPlayerService) DBStatus() (string, error) {
	var playlists int64
	if err := s.state.DB.QueryRow(`SELECT COUNT(*) FROM playlists`).Scan(&playlists); err != nil {
		return "", err
	}
	var songs int64
	if err := s.state.DB.QueryRow(`SELECT COUNT(*) FROM songs`).Scan(&songs); err != nil {
		return "", err
	}
	return fmt.Sprintf("library.db OK — playlists: %d, local songs: %d", playlists, songs), nil
}

func (s *CloudPlayerService) SearchSongs(keyword string, page uint32) (SearchResponse, error) {
	trimmed := strings.TrimSpace(keyword)
	if trimmed == "" {
		return SearchResponse{}, fmt.Errorf("请输入搜索关键词")
	}
	s.state.RateLimiter.AcquireSlot()
	results, hasNext, err := pjmp3.SearchPjmp3(s.state.HTTPClient, trimmed, maxUint32(page, 1))
	if err != nil {
		return SearchResponse{}, err
	}
	return SearchResponse{Results: results, HasNext: hasNext}, nil
}

func (s *CloudPlayerService) ResolveOnlinePlay(songID, title, artist string) (ResolveOnlinePlayOut, error) {
	trimmedID := strings.TrimSpace(songID)
	if trimmedID == "" {
		return ResolveOnlinePlayOut{}, fmt.Errorf("无效的歌曲 ID")
	}
	trimmedTitle := strings.TrimSpace(title)
	trimmedArtist := strings.TrimSpace(artist)

	for _, path := range download.CandidateDownloadedAudioPaths(trimmedTitle, trimmedArtist) {
		info, err := os.Stat(path)
		if err == nil && !info.IsDir() && info.Size() > 0 {
			return ResolveOnlinePlayOut{
				Kind: "file",
				Path: path,
				Via:  "download",
			}, nil
		}
	}

	if path := pjmp3.PreviewCachePathIfExists(trimmedID); path != "" {
		return ResolveOnlinePlayOut{
			Kind: "file",
			Path: path,
			Via:  "preview_cache",
		}, nil
	}

	s.state.RateLimiter.AcquireSlot()
	previewPath, previewErr := pjmp3.CachePreviewAudioFile(s.state.HTTPClient, trimmedID)
	if previewErr == nil && previewPath != "" {
		return ResolveOnlinePlayOut{
			Kind: "file",
			Path: previewPath,
			Via:  "fetched_preview",
		}, nil
	}

	s.state.RateLimiter.AcquireSlot()
	previewURL, directErr := pjmp3.FetchPreviewURL(s.state.HTTPClient, trimmedID)
	if directErr == nil && strings.TrimSpace(previewURL) != "" {
		return ResolveOnlinePlayOut{
			Kind: "url",
			URL:  previewURL,
			Via:  "direct_url",
		}, nil
	}

	if previewErr != nil && directErr != nil {
		return ResolveOnlinePlayOut{}, fmt.Errorf("%v；直链降级失败：%v", previewErr, directErr)
	}
	if previewErr != nil {
		return ResolveOnlinePlayOut{}, fmt.Errorf("%v；直链降级：未解析到 MP3 地址", previewErr)
	}
	if directErr != nil {
		return ResolveOnlinePlayOut{}, directErr
	}
	return ResolveOnlinePlayOut{}, fmt.Errorf("未解析到可播放地址")
}

func (s *CloudPlayerService) ParseImportText(text, format string) ([]importplaylist.ImportedTrackDTO, error) {
	return importplaylist.ParsePlaylistText(text, format)
}

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
	result, err := s.state.DB.Exec(`DELETE FROM playlists WHERE id = ?`, playlistID)
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
		if _, err := tx.Exec(`
			INSERT INTO playlist_import_items (
				playlist_id, sort_order, title, artist, album, play_url, pjmp3_source_id,
				cover_url, cover_cache_path, duration_ms, audio_cache_path
			) VALUES (?, ?, ?, ?, ?, '', '', '', '', 0, '')
		`, playlistID, index, strings.TrimSpace(item.Title), strings.TrimSpace(item.Artist), strings.TrimSpace(item.Album)); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	importenrich.SpawnPlaylistEnrich(s.state.DB, s.state.HTTPClient, s.state.RateLimiter, playlistID)
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
		if _, err := tx.Exec(`
			INSERT INTO playlist_import_items (
				playlist_id, sort_order, title, artist, album, play_url, pjmp3_source_id,
				cover_url, cover_cache_path, duration_ms, audio_cache_path
			) VALUES (?, ?, ?, ?, ?, '', '', '', '', 0, '')
		`, playlistID, position, strings.TrimSpace(item.Title), strings.TrimSpace(item.Artist), strings.TrimSpace(item.Album)); err != nil {
			return err
		}
		position++
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	importenrich.SpawnPlaylistEnrich(s.state.DB, s.state.HTTPClient, s.state.RateLimiter, playlistID)
	return nil
}

func (s *CloudPlayerService) FetchSongLRCEnriched(req lyrics.FetchRequest) (*string, error) {
	settings := config.LoadSettings()
	s.state.RateLimiter.AcquireSlot()
	return lyrics.FetchSongLRCEnriched(s.state.HTTPClient, settings, req)
}

func (s *CloudPlayerService) FetchSharePlaylist(rawURL string) (SharePlaylistResponse, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return SharePlaylistResponse{}, fmt.Errorf("请先粘贴分享链接。")
	}
	settings := config.LoadSettings()
	s.state.RateLimiter.AcquireSlot()
	name, tracks, err := sharelink.FetchPlaylistFromShareURL(s.state.HTTPClient, trimmed, sharelink.FetchOptions{
		NeteaseCookieEnabled: settings.ShareNeteaseCookieEnabled,
		NeteaseCookie:        settings.ShareNeteaseCookie,
	})
	if err != nil {
		return SharePlaylistResponse{}, err
	}
	return SharePlaylistResponse{
		PlaylistName: name,
		Tracks:       tracks,
	}, nil
}

func (s *CloudPlayerService) ListLocalSongs() ([]LocalSongRow, error) {
	rows, err := s.state.DB.Query(`
		SELECT id, title, artist, file_path
		FROM songs
		ORDER BY title COLLATE NOCASE, id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []LocalSongRow
	for rows.Next() {
		var row LocalSongRow
		if err := rows.Scan(&row.ID, &row.Title, &row.Artist, &row.FilePath); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func (s *CloudPlayerService) ScanMusicFolder(path string) (ScanMusicFolderResult, error) {
	absolute, err := filepath.Abs(strings.TrimSpace(path))
	if err != nil {
		return ScanMusicFolderResult{}, err
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return ScanMusicFolderResult{}, err
	}
	if !info.IsDir() {
		return ScanMusicFolderResult{}, fmt.Errorf("不是有效的文件夹路径")
	}

	result := ScanMusicFolderResult{}
	err = filepath.WalkDir(absolute, func(current string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(entry.Name())), ".")
		if !isAudioExtension(ext) {
			return nil
		}
		result.AudioFilesSeen++

		title := strings.TrimSpace(strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name())))
		if title == "" {
			title = current
		}
		execResult, err := s.state.DB.Exec(`
			INSERT INTO songs (title, artist, album, file_path)
			VALUES (?, '', '', ?)
			ON CONFLICT(file_path) DO UPDATE SET title = excluded.title
		`, title, current)
		if err != nil {
			return nil
		}
		if changed, err := execResult.RowsAffected(); err == nil {
			result.RowsWritten += int(changed)
		}
		return nil
	})
	if err != nil {
		return ScanMusicFolderResult{}, err
	}
	return result, nil
}

func (s *CloudPlayerService) ListRecentPlays() ([]RecentPlayRow, error) {
	rows, err := s.state.DB.Query(`
		SELECT kind, title, artist, cover_url, pjmp3_source_id, file_path, played_at
		FROM recent_plays
		ORDER BY played_at DESC
		LIMIT ?
	`, recentPlaysMax)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []RecentPlayRow
	for rows.Next() {
		var row RecentPlayRow
		if err := rows.Scan(&row.Kind, &row.Title, &row.Artist, &row.CoverURL, &row.Pjmp3SourceID, &row.FilePath, &row.PlayedAt); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func (s *CloudPlayerService) RecordRecentPlay(row RecentPlayIn) error {
	kind := strings.TrimSpace(row.Kind)
	if kind != "online" && kind != "local" {
		return fmt.Errorf("kind 须为 online 或 local")
	}
	if kind == "online" && strings.TrimSpace(valueOrEmpty(row.Pjmp3SourceID)) == "" {
		return fmt.Errorf("online 须含 pjmp3_source_id")
	}
	if kind == "local" && strings.TrimSpace(valueOrEmpty(row.FilePath)) == "" {
		return fmt.Errorf("local 须含 file_path")
	}

	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)

	if kind == "online" {
		if _, err := tx.Exec(`DELETE FROM recent_plays WHERE kind = 'online' AND pjmp3_source_id = ?`, strings.TrimSpace(valueOrEmpty(row.Pjmp3SourceID))); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(`DELETE FROM recent_plays WHERE kind = 'local' AND file_path = ?`, strings.TrimSpace(valueOrEmpty(row.FilePath))); err != nil {
			return err
		}
	}

	now := time.Now().UnixMilli()
	if _, err := tx.Exec(`
		INSERT INTO recent_plays (kind, title, artist, cover_url, pjmp3_source_id, file_path, played_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, kind, row.Title, row.Artist, row.CoverURL, row.Pjmp3SourceID, row.FilePath, now); err != nil {
		return err
	}
	if _, err := tx.Exec(`
		DELETE FROM recent_plays
		WHERE id NOT IN (
			SELECT id FROM recent_plays ORDER BY played_at DESC LIMIT ?
		)
	`, recentPlaysMax); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *CloudPlayerService) EnqueueDownload(job download.DownloadJob) error {
	job.SourceID = strings.TrimSpace(job.SourceID)
	job.Title = strings.TrimSpace(job.Title)
	job.Artist = strings.TrimSpace(job.Artist)
	job.Quality = normalizeDownloadQuality(job.Quality)
	if job.SourceID == "" {
		return fmt.Errorf("无曲库 id，无法下载")
	}

	download.EmitQueued(job)
	select {
	case s.state.DownloadCh <- job:
		return nil
	default:
		return fmt.Errorf("下载队列已满，请稍后再试")
	}
}

func isAudioExtension(ext string) bool {
	switch strings.ToLower(strings.TrimSpace(ext)) {
	case "mp3", "flac", "m4a", "wav", "ogg", "aac", "opus", "wma":
		return true
	default:
		return false
	}
}

func normalizeDownloadQuality(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "flac":
		return "flac"
	case "320", "hq":
		return "320"
	default:
		return "128"
	}
}

func clampFloat(value, minValue, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func maxInt(value, minValue int) int {
	if value < minValue {
		return minValue
	}
	return value
}

func maxUint32(value, minValue uint32) uint32 {
	if value < minValue {
		return minValue
	}
	return value
}

func rollback(tx *sql.Tx) {
	_ = tx.Rollback()
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
