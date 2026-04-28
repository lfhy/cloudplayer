package main

import (
	"cloudplayer/internal/cloudplayer/config"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

const (
	closeConfirmWindowName   = "close-confirm"
	closeConfirmWindowWidth  = 548
	closeConfirmWindowHeight = 348
)

// Native close-confirm helpers keep main-window shutdown behavior reliable even if the main webview is busy.
func handleMainWindowCloseRequest() {
	settings := config.LoadSettings()
	switch settings.MainWindowCloseAction {
	case "quit":
		requestAppQuit()
	case "tray":
		hideMainWindow()
	default:
		showCloseConfirmWindow()
	}
}

func hideMainWindow() {
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return
	}
	window.Hide()
}

func hideCloseConfirmWindow() {
	window, ok := application.Get().Window.GetByName(closeConfirmWindowName)
	if !ok {
		return
	}
	window.Hide()
}

func showCloseConfirmWindow() {
	mainWindow, _ := application.Get().Window.GetByName("main")
	dialog := ensureCloseConfirmWindow()
	positionCloseConfirmWindow(mainWindow, dialog)
	dialog.Show()
	dialog.Focus()
}

func positionCloseConfirmWindow(mainWindow application.Window, dialog *application.WebviewWindow) {
	if dialog == nil {
		return
	}
	if mainWindow == nil {
		dialog.Center()
		return
	}
	bounds := mainWindow.Bounds()
	if bounds.Width <= 0 || bounds.Height <= 0 {
		dialog.Center()
		return
	}
	x := bounds.X + maxInt((bounds.Width-closeConfirmWindowWidth)/2, 24)
	y := bounds.Y + maxInt((bounds.Height-closeConfirmWindowHeight)/2-28, 24)
	dialog.SetPosition(x, y)
}

func ensureCloseConfirmWindow() *application.WebviewWindow {
	if existing, ok := application.Get().Window.GetByName(closeConfirmWindowName); ok {
		if dialog, dialogOK := existing.(*application.WebviewWindow); dialogOK {
			return dialog
		}
		return nil
	}
	dialog := application.Get().Window.NewWithOptions(application.WebviewWindowOptions{
		Name:          closeConfirmWindowName,
		Title:         "关闭 CloudPlayer",
		URL:           "/close_confirm.html",
		Width:         closeConfirmWindowWidth,
		Height:        closeConfirmWindowHeight,
		Hidden:        true,
		AlwaysOnTop:   true,
		DisableResize: true,
		Mac: application.MacWindow{
			TitleBar:    application.MacTitleBarDefault,
			WindowLevel: application.MacWindowLevelFloating,
		},
		Windows: application.WindowsWindow{
			HiddenOnTaskbar: true,
		},
	})
	dialog.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		event.Cancel()
		dialog.Hide()
	})
	return dialog
}

func emitMainWindowCloseActionUpdated(action string) {
	_ = application.Get().Event.Emit("main-window-close-action-updated", map[string]any{
		"__tauriTarget": "main",
		"payload": map[string]any{
			"action": action,
		},
	})
}
