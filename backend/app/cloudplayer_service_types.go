package cloudplayer

import (
	"cloudplayer/backend/hotkeys"
	"cloudplayer/backend/model"
)

// DTO types keep the Wails bindings stable while the service methods are split by domain.
type HotkeyApplyReport = hotkeys.HotkeyApplyReport
type SearchResponse = model.SearchResponse
type SearchSongMetadataRow = model.SearchSongMetadataRow
type ResolveOnlinePlayOut = model.ResolveOnlinePlayOut
type PlaylistRow = model.PlaylistRow
type PlaylistImportItemRow = model.PlaylistImportItemRow
type FavoriteTrackIn = model.FavoriteTrackIn
type SharePlaylistResponse = model.SharePlaylistResponse
type LocalSongRow = model.LocalSongRow
type ScanMusicFolderResult = model.ScanMusicFolderResult
type RecentPlayIn = model.RecentPlayIn
type RecentPlayRow = model.RecentPlayRow

type PlaybackQueueItem struct {
	SourceID  string `json:"source_id,omitempty"`
	Title     string `json:"title"`
	Artist    string `json:"artist,omitempty"`
	CoverURL  string `json:"cover_url,omitempty"`
	LocalPath string `json:"local_path,omitempty"`
}

type SettingsPatch struct {
	Volume                      *float64             `json:"volume,omitempty"`
	PlayMode                    *string              `json:"play_mode,omitempty"`
	PlayQueue                   *[]PlaybackQueueItem `json:"play_queue,omitempty"`
	PlayQueueIndex              *int                 `json:"play_queue_index,omitempty"`
	LastLibraryFolder           *string              `json:"last_library_folder,omitempty"`
	DailyDownloadLimit          *int64               `json:"daily_download_limit,omitempty"`
	DesktopLyricsVisible        *bool                `json:"desktop_lyrics_visible,omitempty"`
	DesktopLyricsLocked         *bool                `json:"desktop_lyrics_locked,omitempty"`
	DesktopLyricsX              *int                 `json:"desktop_lyrics_x,omitempty"`
	DesktopLyricsY              *int                 `json:"desktop_lyrics_y,omitempty"`
	DesktopLyricsWidth          *int                 `json:"desktop_lyrics_width,omitempty"`
	DesktopLyricsHeight         *int                 `json:"desktop_lyrics_height,omitempty"`
	DesktopLyricsScale          *float64             `json:"desktop_lyrics_scale,omitempty"`
	DownloadFolder              *string              `json:"download_folder,omitempty"`
	LyricsNeteaseAPIBase        *string              `json:"lyrics_netease_api_base,omitempty"`
	NetworkProxyMode            *string              `json:"network_proxy_mode,omitempty"`
	NetworkProxyURL             *string              `json:"network_proxy_url,omitempty"`
	LyricsLRCLibEnabled         *bool                `json:"lyrics_lrclib_enabled,omitempty"`
	LyricsProviderOrder         *string              `json:"lyrics_provider_order,omitempty"`
	MainWindowCloseAction       *string              `json:"main_window_close_action,omitempty"`
	AppTheme                    *string              `json:"app_theme,omitempty"`
	AppThemeMode                *string              `json:"app_theme_mode,omitempty"`
	AppThemeCustomAccent        *string              `json:"app_theme_custom_accent,omitempty"`
	DesktopLyricsColorBase      *string              `json:"desktop_lyrics_color_base,omitempty"`
	DesktopLyricsColorHighlight *string              `json:"desktop_lyrics_color_highlight,omitempty"`
	DesktopLyricsIdleLine1      *string              `json:"desktop_lyrics_idle_line1,omitempty"`
	DesktopLyricsIdleLine2      *string              `json:"desktop_lyrics_idle_line2,omitempty"`
	ShareNeteaseCookieEnabled   *bool                `json:"share_netease_cookie_enabled,omitempty"`
	ShareNeteaseCookie          *string              `json:"share_netease_cookie,omitempty"`
	MusicSourceProvider         *string              `json:"music_source_provider,omitempty"`
	SearchCacheTTLHours         *int                 `json:"search_cache_ttl_hours,omitempty"`
}
