//go:build darwin || (linux && !android) || windows

package cloudplayer

import (
	"cloudplayer/backend/desktop"
	"cloudplayer/backend/state"
)

// Theme sync stays in a desktop-only wrapper so shared settings persistence can
// update native chrome without importing Wails symbols on mobile targets.
func syncThemeStateAfterSettingsChange(
	appState *state.AppState,
	theme string,
	customAccent string,
	mode string,
) {
	applyThemeAssets(appState, theme, customAccent)
	syncMainWindowTheme(mode)
	desktop.SyncDesktopWindowThemes(mode)
}
