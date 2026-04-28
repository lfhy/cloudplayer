package main

import (
	"fmt"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Window-facing service methods stay isolated so bindings for desktop shell actions remain easy to scan.
func (s *CloudPlayerService) HideMainWindow() error {
	hideMainWindow()
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

func (s *CloudPlayerService) ApplyMainWindowCloseChoice(action string, remember bool) error {
	normalized := strings.ToLower(strings.TrimSpace(action))
	switch normalized {
	case "tray", "quit":
	default:
		return fmt.Errorf("unsupported close action")
	}
	if remember {
		if err := s.SaveSettings(SettingsPatch{MainWindowCloseAction: &normalized}); err != nil {
			return err
		}
		emitMainWindowCloseActionUpdated(normalized)
	}
	hideCloseConfirmWindow()
	switch normalized {
	case "tray":
		hideMainWindow()
	case "quit":
		requestAppQuit()
	}
	return nil
}
