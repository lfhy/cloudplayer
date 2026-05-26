//go:build darwin || (linux && !android)

package cloudplayer

import "github.com/wailsapp/wails/v3/pkg/application"

func syncNativeWindowTheme(_ application.Window, _ string) {}
