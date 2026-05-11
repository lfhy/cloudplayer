//go:build windows

package cloudplayer

import (
	"cloudplayer/backend/config"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/w32"
)

func syncNativeWindowTheme(window application.Window, mode string) {
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
			w32.SetTitleBarColour(hwnd, rgbColour(24, 26, 31))
			w32.SetTitleTextColour(hwnd, rgbColour(236, 240, 244))
			w32.SetBorderColour(hwnd, rgbColour(24, 26, 31))
			return
		}
		w32.SetTitleBarColour(hwnd, rgbColour(248, 250, 252))
		w32.SetTitleTextColour(hwnd, rgbColour(24, 26, 31))
		w32.SetBorderColour(hwnd, rgbColour(235, 239, 245))
	})
}

func rgbColour(red, green, blue uint8) uint32 {
	return uint32(red) | uint32(green)<<8 | uint32(blue)<<16
}
