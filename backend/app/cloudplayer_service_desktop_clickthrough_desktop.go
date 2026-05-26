//go:build darwin || (linux && !android) || windows

package cloudplayer

import "github.com/wailsapp/wails/v3/pkg/application"

// Desktop lyrics click-through stays on desktop builds because it talks to the
// live Wails child window directly.
func (s *CloudPlayerService) SetDesktopLyricsClickThrough(ignoreCursorEvents bool) error {
	app := application.Get()
	if app == nil {
		return nil
	}
	window, ok := app.Window.GetByName("lyrics")
	if !ok {
		return nil
	}
	window.SetIgnoreMouseEvents(ignoreCursorEvents)
	return nil
}
