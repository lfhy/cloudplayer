//go:build !windows

package desktop

import "github.com/wailsapp/wails/v3/pkg/application"

func isThemedDesktopWindowLabel(_ string) bool {
	return false
}

func configureDesktopWindowTheme(_ *application.WebviewWindowOptions, _ string) {}

func syncDesktopWindowTheme(_ application.Window, _ string) {}

func SyncDesktopWindowThemes(_ string) {}
