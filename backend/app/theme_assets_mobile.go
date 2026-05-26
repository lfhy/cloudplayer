//go:build android || ios

package cloudplayer

import (
	"cloudplayer/backend/config"
	"cloudplayer/backend/state"
)

// Mobile bridge builds do not render native dock or tray icons, so theme asset
// hooks collapse to backend state updates only.
func setMacTrayTemplateIcon([]byte) {}

func appIconForTheme(string, string) []byte {
	return nil
}

func applyThemeAssets(appState *state.AppState, theme, customAccent string) {
	if appState == nil {
		return
	}
	appState.AppTheme = config.NormalizeAppTheme(theme)
	appState.AppThemeCustomAccent = customAccent
}
