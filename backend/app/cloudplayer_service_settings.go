package cloudplayer

import (
	"fmt"
	"log"
	"os"
	"strings"

	"cloudplayer/backend/config"
	"cloudplayer/backend/hotkeys"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// Settings and window-management methods stay together because they update shared app state.
func (s *CloudPlayerService) GetAppLogPath() (string, error) {
	return GetAppLogPath()
}

func (s *CloudPlayerService) LogPlayEvent(stage string, url *string, errorCode *int, message *string, extra *string) error {
	LogPlayEvent(stage, url, errorCode, message, extra)
	return nil
}

// Frontend debug messages funnel through the backend logger so UI repros land in the app log file.
func (s *CloudPlayerService) LogFrontendDebug(scope, stage, detail string) error {
	log.Printf("frontend debug scope=%s stage=%s detail=%s", strings.TrimSpace(scope), strings.TrimSpace(stage), strings.TrimSpace(detail))
	return nil
}

func (s *CloudPlayerService) GetSettings() config.Settings {
	settings := config.LoadSettings()
	s.state.SetSearchCacheTTLHours(settings.SearchCacheTTLHours)
	return settings
}

func (s *CloudPlayerService) GetGlobalHotkeys() config.GlobalHotkeys {
	settings := config.LoadSettings()
	return settings.GlobalHotkeys
}

func (s *CloudPlayerService) ValidateAccelerator(value string) error {
	return hotkeys.ValidateAcceleratorString(value)
}

func (s *CloudPlayerService) ApplyGlobalHotkeys(cfg config.GlobalHotkeys) (hotkeys.HotkeyApplyReport, error) {
	report := hotkeys.AllOKHotkeyReport()
	var err error
	if s.state.Hotkeys != nil {
		report, err = s.state.Hotkeys.Apply(cfg)
		if err != nil {
			return hotkeys.HotkeyApplyReport{}, err
		}
	}
	settings := config.LoadSettings()
	settings.GlobalHotkeys = cfg
	if err := config.SaveSettings(settings); err != nil {
		return hotkeys.HotkeyApplyReport{}, err
	}
	return report, nil
}

func (s *CloudPlayerService) SetDesktopLyricsClickThrough(ignoreCursorEvents bool) error {
	window, ok := application.Get().Window.GetByName("lyrics")
	if !ok {
		return nil
	}
	window.SetIgnoreMouseEvents(ignoreCursorEvents)
	return nil
}

func (s *CloudPlayerService) LocalPathAccessible(path string) bool {
	info, err := os.Stat(strings.TrimSpace(path))
	return err == nil && !info.IsDir()
}

func (s *CloudPlayerService) SaveSettings(patch SettingsPatch) error {
	settings := config.LoadSettings()
	if patch.Volume != nil {
		settings.Volume = clampFloat(*patch.Volume, 0, 1)
	}
	if patch.PlayMode != nil {
		settings.PlayMode = config.NormalizePlayMode(*patch.PlayMode)
	}
	if patch.PlayQueue != nil {
		rows := make([]config.PlaybackQueueItem, 0, len(*patch.PlayQueue))
		for _, item := range *patch.PlayQueue {
			rows = append(rows, config.PlaybackQueueItem{
				SourceID:  item.SourceID,
				Title:     item.Title,
				Artist:    item.Artist,
				CoverURL:  item.CoverURL,
				LocalPath: item.LocalPath,
			})
		}
		settings.PlayQueue = config.NormalizePlaybackQueue(rows)
		if settings.PlayQueueIndex >= len(settings.PlayQueue) {
			if len(settings.PlayQueue) == 0 {
				settings.PlayQueueIndex = 0
			} else {
				settings.PlayQueueIndex = len(settings.PlayQueue) - 1
			}
		}
	}
	if patch.PlayQueueIndex != nil {
		if *patch.PlayQueueIndex < 0 {
			settings.PlayQueueIndex = 0
		} else {
			settings.PlayQueueIndex = *patch.PlayQueueIndex
		}
		if settings.PlayQueueIndex >= len(settings.PlayQueue) {
			if len(settings.PlayQueue) == 0 {
				settings.PlayQueueIndex = 0
			} else {
				settings.PlayQueueIndex = len(settings.PlayQueue) - 1
			}
		}
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
	if patch.NetworkProxyMode != nil {
		settings.NetworkProxyMode = config.NormalizeNetworkProxyMode(*patch.NetworkProxyMode)
	}
	if patch.NetworkProxyURL != nil {
		value, err := config.NormalizeNetworkProxyURL(*patch.NetworkProxyURL)
		if err != nil {
			return err
		}
		settings.NetworkProxyURL = value
	}
	if patch.LyricsLRCLibEnabled != nil {
		settings.LyricsLRCLibEnabled = *patch.LyricsLRCLibEnabled
	}
	if patch.LyricsProviderOrder != nil {
		settings.LyricsProviderOrder = *patch.LyricsProviderOrder
	}
	if patch.MainWindowCloseAction != nil {
		switch value := strings.ToLower(strings.TrimSpace(*patch.MainWindowCloseAction)); value {
		case "ask", "quit", "tray":
			settings.MainWindowCloseAction = value
		}
	}
	if patch.AppTheme != nil {
		settings.AppTheme = config.NormalizeAppTheme(*patch.AppTheme)
	}
	if patch.AppThemeMode != nil {
		settings.AppThemeMode = config.NormalizeAppThemeMode(*patch.AppThemeMode)
	}
	if patch.AppThemeCustomAccent != nil {
		if value, ok := normalizeHexColour(*patch.AppThemeCustomAccent); ok {
			settings.AppThemeCustomAccent = value
		}
	}
	if patch.DesktopLyricsColorBase != nil {
		if value, ok := normalizeHexColour(*patch.DesktopLyricsColorBase); ok {
			settings.DesktopLyricsColorBase = value
		}
	}
	if patch.DesktopLyricsColorHighlight != nil {
		if value, ok := normalizeHexColour(*patch.DesktopLyricsColorHighlight); ok {
			settings.DesktopLyricsColorHighlight = value
		}
	}
	if patch.DesktopLyricsIdleLine1 != nil {
		settings.DesktopLyricsIdleLine1 = config.NormalizeDesktopLyricsIdleLine(*patch.DesktopLyricsIdleLine1, config.DefaultSettings().DesktopLyricsIdleLine1)
	}
	if patch.DesktopLyricsIdleLine2 != nil {
		settings.DesktopLyricsIdleLine2 = config.NormalizeDesktopLyricsIdleLine(*patch.DesktopLyricsIdleLine2, config.DefaultSettings().DesktopLyricsIdleLine2)
	}
	if patch.ShareNeteaseCookieEnabled != nil {
		settings.ShareNeteaseCookieEnabled = *patch.ShareNeteaseCookieEnabled
	}
	if patch.ShareNeteaseCookie != nil {
		settings.ShareNeteaseCookie = *patch.ShareNeteaseCookie
	}
	if patch.MusicOnlineMode != nil {
		if *patch.MusicOnlineMode {
			status, err := s.GetKugouLoginStatus()
			if err != nil {
				return err
			}
			if !status.LoggedIn {
				return fmt.Errorf("请先登录酷狗概念版后再开启在线模式")
			}
		}
		settings.MusicOnlineMode = *patch.MusicOnlineMode
	}
	if patch.MusicSourceProvider != nil {
		settings.MusicSourceProvider = config.NormalizeMusicSourceProvider(*patch.MusicSourceProvider)
	}
	if patch.SearchCacheTTLHours != nil {
		settings.SearchCacheTTLHours = config.NormalizeSearchCacheTTLHours(*patch.SearchCacheTTLHours)
	}
	if err := config.SaveSettings(settings); err != nil {
		return err
	}
	s.state.SetSearchCacheTTLHours(settings.SearchCacheTTLHours)
	if err := s.state.ApplyNetworkSettings(settings); err != nil {
		return err
	}
	applyThemeAssets(s.state, settings.AppTheme, settings.AppThemeCustomAccent)
	return nil
}

func (s *CloudPlayerService) ClearSearchCache() int {
	return s.state.SearchCache.ClearSearchEntries()
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
