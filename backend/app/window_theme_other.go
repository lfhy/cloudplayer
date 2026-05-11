//go:build !windows

package cloudplayer

import "github.com/wailsapp/wails/v3/pkg/application"

func syncNativeWindowTheme(_ application.Window, _ string) {}
