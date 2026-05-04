package cloudplayer

import (
	"cloudplayer/backend/desktop"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// Window-facing service methods stay isolated so bindings for desktop shell actions remain easy to scan.
func (s *CloudPlayerService) HideMainWindow() error {
	desktop.HideMainWindow()
	return nil
}

func (s *CloudPlayerService) ShowMainWindow() error {
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return nil
	}
	window.Show()
	window.Focus()
	return nil
}

func (s *CloudPlayerService) QuitApp() {
	requestAppQuit()
}
