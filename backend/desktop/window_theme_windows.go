//go:build windows

package desktop

// Windows child-window theme helpers keep native titlebars aligned with the current app theme mode.

import (
	"cloudplayer/backend/config"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/w32"
)

var themedDesktopWindowLabels = map[string]struct{}{
	"account-center":      {},
	"close-confirm":       {},
	"lyrics-replace":      {},
	"message-dialog":      {},
	"online-mode-confirm": {},
}

func isThemedDesktopWindowLabel(label string) bool {
	_, ok := themedDesktopWindowLabels[label]
	return ok
}

func configureDesktopWindowTheme(options *application.WebviewWindowOptions, mode string) {
	if options == nil {
		return
	}
	options.Windows.Theme = desktopWindowsThemeForMode(mode)
	options.Windows.CustomTheme = application.ThemeSettings{
		DarkModeActive: &application.WindowTheme{
			BorderColour:    application.NewRGBPtr(24, 26, 31),
			TitleBarColour:  application.NewRGBPtr(24, 26, 31),
			TitleTextColour: application.NewRGBPtr(236, 240, 244),
		},
		DarkModeInactive: &application.WindowTheme{
			BorderColour:    application.NewRGBPtr(40, 42, 47),
			TitleBarColour:  application.NewRGBPtr(40, 42, 47),
			TitleTextColour: application.NewRGBPtr(184, 190, 199),
		},
		LightModeActive: &application.WindowTheme{
			BorderColour:    application.NewRGBPtr(235, 239, 245),
			TitleBarColour:  application.NewRGBPtr(248, 250, 252),
			TitleTextColour: application.NewRGBPtr(24, 26, 31),
		},
		LightModeInactive: &application.WindowTheme{
			BorderColour:    application.NewRGBPtr(229, 233, 239),
			TitleBarColour:  application.NewRGBPtr(241, 244, 248),
			TitleTextColour: application.NewRGBPtr(108, 116, 128),
		},
	}
}

func syncDesktopWindowTheme(window application.Window, mode string) {
	if window == nil {
		return
	}
	nativeWindow := window.NativeWindow()
	if nativeWindow == nil {
		return
	}
	normalizedMode := config.NormalizeAppThemeMode(mode)
	isDarkMode := normalizedMode != "light"
	if normalizedMode == "system" {
		isDarkMode = w32.IsCurrentlyDarkMode()
	}
	application.InvokeSync(func() {
		hwnd := uintptr(nativeWindow)
		if w32.AllowDarkModeForWindow != nil {
			w32.AllowDarkModeForWindow(w32.HWND(hwnd), isDarkMode)
		}
		w32.SetTheme(hwnd, isDarkMode)
		if isDarkMode {
			w32.SetTitleBarColour(hwnd, desktopRGBColour(24, 26, 31))
			w32.SetTitleTextColour(hwnd, desktopRGBColour(236, 240, 244))
			w32.SetBorderColour(hwnd, desktopRGBColour(24, 26, 31))
			return
		}
		w32.SetTitleBarColour(hwnd, desktopRGBColour(248, 250, 252))
		w32.SetTitleTextColour(hwnd, desktopRGBColour(24, 26, 31))
		w32.SetBorderColour(hwnd, desktopRGBColour(235, 239, 245))
	})
}

func SyncDesktopWindowThemes(mode string) {
	for _, window := range application.Get().Window.GetAll() {
		if window == nil || !isThemedDesktopWindowLabel(window.Name()) {
			continue
		}
		syncDesktopWindowTheme(window, mode)
	}
}

func desktopWindowsThemeForMode(mode string) application.Theme {
	switch config.NormalizeAppThemeMode(mode) {
	case "light":
		return application.Light
	case "system":
		return application.SystemDefault
	default:
		return application.Dark
	}
}

func desktopRGBColour(red, green, blue uint8) uint32 {
	return uint32(red) | uint32(green)<<8 | uint32(blue)<<16
}
