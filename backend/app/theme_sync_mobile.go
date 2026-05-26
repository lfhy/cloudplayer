//go:build android || ios

package cloudplayer

import (
	"cloudplayer/backend/config"
	"cloudplayer/backend/state"
)

// Mobile builds only need the backend state to reflect the saved theme; there
// is no native Wails window chrome to update.
func syncThemeStateAfterSettingsChange(
	appState *state.AppState,
	theme string,
	customAccent string,
	_ string,
) {
	if appState == nil {
		return
	}
	appState.AppTheme = config.NormalizeAppTheme(theme)
	appState.AppThemeCustomAccent = customAccent
}
