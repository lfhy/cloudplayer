package main

import (
	"cloudplayer/internal/cloudplayer/importplaylist"
	"cloudplayer/internal/cloudplayer/musicsource"
)

// DTO types keep the Wails bindings stable while the service methods are split by domain.
type SettingsPatch struct {
	Volume                      *float64 `json:"volume,omitempty"`
	LastLibraryFolder           *string  `json:"last_library_folder,omitempty"`
	DailyDownloadLimit          *int64   `json:"daily_download_limit,omitempty"`
	DesktopLyricsVisible        *bool    `json:"desktop_lyrics_visible,omitempty"`
	DesktopLyricsLocked         *bool    `json:"desktop_lyrics_locked,omitempty"`
	DesktopLyricsX              *int     `json:"desktop_lyrics_x,omitempty"`
	DesktopLyricsY              *int     `json:"desktop_lyrics_y,omitempty"`
	DesktopLyricsWidth          *int     `json:"desktop_lyrics_width,omitempty"`
	DesktopLyricsHeight         *int     `json:"desktop_lyrics_height,omitempty"`
	DesktopLyricsScale          *float64 `json:"desktop_lyrics_scale,omitempty"`
	DownloadFolder              *string  `json:"download_folder,omitempty"`
	LyricsNeteaseAPIBase        *string  `json:"lyrics_netease_api_base,omitempty"`
	NetworkProxyMode            *string  `json:"network_proxy_mode,omitempty"`
	NetworkProxyURL             *string  `json:"network_proxy_url,omitempty"`
	LyricsLRCLibEnabled         *bool    `json:"lyrics_lrclib_enabled,omitempty"`
	LyricsProviderOrder         *string  `json:"lyrics_provider_order,omitempty"`
	MainWindowCloseAction       *string  `json:"main_window_close_action,omitempty"`
	AppTheme                    *string  `json:"app_theme,omitempty"`
	AppThemeMode                *string  `json:"app_theme_mode,omitempty"`
	AppThemeCustomAccent        *string  `json:"app_theme_custom_accent,omitempty"`
	DesktopLyricsColorBase      *string  `json:"desktop_lyrics_color_base,omitempty"`
	DesktopLyricsColorHighlight *string  `json:"desktop_lyrics_color_highlight,omitempty"`
	ShareNeteaseCookieEnabled   *bool    `json:"share_netease_cookie_enabled,omitempty"`
	ShareNeteaseCookie          *string  `json:"share_netease_cookie,omitempty"`
}

type SearchResponse struct {
	Results []musicsource.SearchResult `json:"results"`
	HasNext bool                       `json:"has_next"`
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
