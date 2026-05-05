package config

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

const BaseURL = "https://pjmp3.com"

const (
	NetworkProxyModeDirect = "direct"
	NetworkProxyModeSystem = "system"
	NetworkProxyModeCustom = "custom"
)

type Settings struct {
	WindowGeometryB64           *string             `json:"window_geometry_b64,omitempty"`
	WindowStateB64              *string             `json:"window_state_b64,omitempty"`
	Volume                      float64             `json:"volume"`
	PlayMode                    string              `json:"play_mode"`
	PlayQueue                   []PlaybackQueueItem `json:"play_queue,omitempty"`
	PlayQueueIndex              int                 `json:"play_queue_index"`
	LastLibraryFolder           string              `json:"last_library_folder"`
	DailyDownloadLimit          int64               `json:"daily_download_limit"`
	DesktopLyricsVisible        bool                `json:"desktop_lyrics_visible"`
	DesktopLyricsLocked         bool                `json:"desktop_lyrics_locked"`
	DesktopLyricsX              *int                `json:"desktop_lyrics_x,omitempty"`
	DesktopLyricsY              *int                `json:"desktop_lyrics_y,omitempty"`
	DesktopLyricsWidth          *int                `json:"desktop_lyrics_width,omitempty"`
	DesktopLyricsHeight         *int                `json:"desktop_lyrics_height,omitempty"`
	DesktopLyricsScale          float64             `json:"desktop_lyrics_scale"`
	DownloadFolder              string              `json:"download_folder"`
	DownloadsTodayDate          string              `json:"downloads_today_date"`
	DownloadsTodayCount         int64               `json:"downloads_today_count"`
	LyricsNeteaseAPIBase        string              `json:"lyrics_netease_api_base"`
	NetworkProxyMode            string              `json:"network_proxy_mode"`
	NetworkProxyURL             string              `json:"network_proxy_url"`
	LyricsLRCLibEnabled         bool                `json:"lyrics_lrclib_enabled"`
	LyricsProviderOrder         string              `json:"lyrics_provider_order"`
	MainWindowCloseAction       string              `json:"main_window_close_action"`
	AppTheme                    string              `json:"app_theme"`
	AppThemeMode                string              `json:"app_theme_mode"`
	AppThemeCustomAccent        string              `json:"app_theme_custom_accent"`
	GlobalHotkeys               GlobalHotkeys       `json:"global_hotkeys"`
	DesktopLyricsColorBase      string              `json:"desktop_lyrics_color_base"`
	DesktopLyricsColorHighlight string              `json:"desktop_lyrics_color_highlight"`
	DesktopLyricsIdleLine1      string              `json:"desktop_lyrics_idle_line1"`
	DesktopLyricsIdleLine2      string              `json:"desktop_lyrics_idle_line2"`
	ShareNeteaseCookieEnabled   bool                `json:"share_netease_cookie_enabled"`
	ShareNeteaseCookie          string              `json:"share_netease_cookie"`
	MusicSourceProvider         string              `json:"music_source_provider"`
	SearchCacheTTLHours         int                 `json:"search_cache_ttl_hours"`
}

type GlobalHotkeys struct {
	PlayPause  string `json:"play_pause"`
	Prev       string `json:"prev"`
	Next       string `json:"next"`
	VolumeUp   string `json:"volume_up"`
	VolumeDown string `json:"volume_down"`
	Enabled    bool   `json:"enabled"`
}

func DefaultSettings() Settings {
	return Settings{
		Volume:                      0.7,
		PlayMode:                    PlayModeLoopList,
		DailyDownloadLimit:          50,
		DesktopLyricsLocked:         true,
		DesktopLyricsScale:          1.0,
		LyricsLRCLibEnabled:         true,
		NetworkProxyMode:            NetworkProxyModeDirect,
		LyricsProviderOrder:         "qq,kugou,netease,lrclib",
		MainWindowCloseAction:       "ask",
		AppTheme:                    "coral",
		AppThemeMode:                "system",
		AppThemeCustomAccent:        "#c62f2f",
		GlobalHotkeys:               DefaultGlobalHotkeys(),
		DesktopLyricsColorBase:      "#ffffff",
		DesktopLyricsColorHighlight: "#ffb7d4",
		DesktopLyricsIdleLine1:      "CloudPlayer",
		DesktopLyricsIdleLine2:      "让音乐陪你此刻",
		MusicSourceProvider:         "pjmp3",
		SearchCacheTTLHours:         24,
	}
}

func NormalizeMusicSourceProvider(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "pjmp3", "kugou":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "pjmp3"
	}
}

func DefaultGlobalHotkeys() GlobalHotkeys {
	return GlobalHotkeys{
		PlayPause:  "ctrl+alt+space",
		Prev:       "ctrl+alt+left",
		Next:       "ctrl+alt+right",
		VolumeUp:   "ctrl+alt+up",
		VolumeDown: "ctrl+alt+down",
		Enabled:    true,
	}
}

func ConfigDir() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		home = "."
	}
	dir := filepath.Join(home, ".cloudplayer")
	_ = os.MkdirAll(dir, 0o755)
	return dir
}

func DefaultDownloadDir() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		home = "."
	}
	return filepath.Join(home, "Music", "CloudPlayer")
}

func settingsPath() string {
	return filepath.Join(ConfigDir(), "settings.json")
}

func LoadSettings() Settings {
	path := settingsPath()
	data, err := os.ReadFile(path)
	if err != nil {
		return DefaultSettings()
	}
	result := DefaultSettings()
	if err := json.Unmarshal(data, &result); err != nil {
		return DefaultSettings()
	}
	result.SearchCacheTTLHours = NormalizeSearchCacheTTLHours(result.SearchCacheTTLHours)
	result.PlayMode = NormalizePlayMode(result.PlayMode)
	result.PlayQueue = NormalizePlaybackQueue(result.PlayQueue)
	if result.PlayQueueIndex < 0 {
		result.PlayQueueIndex = 0
	}
	if result.PlayQueueIndex >= len(result.PlayQueue) {
		if len(result.PlayQueue) == 0 {
			result.PlayQueueIndex = 0
		} else {
			result.PlayQueueIndex = len(result.PlayQueue) - 1
		}
	}
	defaults := DefaultSettings()
	result.DesktopLyricsIdleLine1 = NormalizeDesktopLyricsIdleLine(result.DesktopLyricsIdleLine1, defaults.DesktopLyricsIdleLine1)
	result.DesktopLyricsIdleLine2 = NormalizeDesktopLyricsIdleLine(result.DesktopLyricsIdleLine2, defaults.DesktopLyricsIdleLine2)
	return result
}

func NormalizeSearchCacheTTLHours(value int) int {
	switch {
	case value <= 0:
		return 24
	case value > 24*30:
		return 24 * 30
	default:
		return value
	}
}

func NormalizeDesktopLyricsIdleLine(raw string, fallback string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return fallback
	}
	runes := []rune(value)
	if len(runes) > 36 {
		return strings.TrimSpace(string(runes[:36]))
	}
	return value
}

func NormalizeAppTheme(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "coral", "ocean", "forest", "netease", "kugou", "qqmusic", "custom":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "coral"
	}
}

func NormalizeAppThemeMode(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "system", "light", "graphite", "midnight", "forestnight":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "system"
	}
}

func NormalizeNetworkProxyMode(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case NetworkProxyModeSystem, NetworkProxyModeCustom:
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return NetworkProxyModeDirect
	}
}

func NormalizeNetworkProxyURL(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", nil
	}
	value = strings.ReplaceAll(value, "：", ":")
	lowerValue := strings.ToLower(value)
	for _, scheme := range []string{"http", "https", "socks5h", "socks5", "socks"} {
		prefix := scheme + ":"
		if strings.HasPrefix(lowerValue, prefix) && !strings.HasPrefix(lowerValue, prefix+"//") {
			value = scheme + "://" + strings.TrimSpace(value[len(prefix):])
			lowerValue = strings.ToLower(value)
			break
		}
	}
	if !strings.Contains(value, "://") {
		value = "http://" + value
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return "", fmt.Errorf("代理地址无效")
	}
	switch strings.ToLower(strings.TrimSpace(parsed.Scheme)) {
	case "", "http":
		parsed.Scheme = "http"
	case "https", "socks5", "socks5h":
	case "socks":
		parsed.Scheme = "socks5"
	default:
		return "", fmt.Errorf("仅支持 http、https、socks5、socks5h 代理")
	}
	if strings.TrimSpace(parsed.Host) == "" {
		switch {
		case strings.TrimSpace(parsed.Opaque) != "":
			parsed.Host = strings.TrimSpace(parsed.Opaque)
			parsed.Opaque = ""
		case strings.TrimSpace(parsed.Path) != "" && !strings.Contains(parsed.Path, "/"):
			parsed.Host = strings.TrimSpace(parsed.Path)
			parsed.Path = ""
		}
	}
	if strings.TrimSpace(parsed.Hostname()) == "" || strings.TrimSpace(parsed.Port()) == "" {
		return "", fmt.Errorf("代理地址缺少主机或端口")
	}
	if parsed.Path == "/" {
		parsed.Path = ""
	}
	return parsed.String(), nil
}

func SaveSettings(settings Settings) error {
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(settingsPath(), data, 0o644)
}
