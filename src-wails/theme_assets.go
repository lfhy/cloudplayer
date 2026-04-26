package main

import (
	_ "embed"
	"runtime"

	"cloudplayer/internal/cloudplayer/config"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed build/theme_icons/appicon_coral.png
var appIconCoral []byte

//go:embed build/theme_icons/appicon_ocean.png
var appIconOcean []byte

//go:embed build/theme_icons/appicon_forest.png
var appIconForest []byte

//go:embed build/trayicon_template_macos.png
var macTrayTemplateIcon []byte

func appIconForTheme(theme string) []byte {
	switch config.NormalizeAppTheme(theme) {
	case "ocean":
		return appIconOcean
	case "forest":
		return appIconForest
	default:
		return appIconCoral
	}
}

func applyThemeAssets(state *AppState, theme string) {
	normalized := config.NormalizeAppTheme(theme)
	if state != nil {
		state.AppTheme = normalized
	}
	if app := application.Get(); app != nil {
		if icon := appIconForTheme(normalized); len(icon) > 0 {
			app.SetIcon(icon)
		}
	}
	if state != nil && state.SystemTray != nil && runtime.GOOS == "darwin" && len(macTrayTemplateIcon) > 0 {
		state.SystemTray.SetTemplateIcon(macTrayTemplateIcon)
	}
}
