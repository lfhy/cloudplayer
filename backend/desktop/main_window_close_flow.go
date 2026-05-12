package desktop

import (
	"cloudplayer/backend/config"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const closeConfirmWindowLabel = "close-confirm"

// Main-window close flow is handled in Go so the preference value always takes effect.
func HandleMainWindowCloseRequest(onQuit func()) {
	settings := config.LoadSettings()
	switch settings.MainWindowCloseAction {
	case "quit":
		if onQuit != nil {
			onQuit()
		}
	case "tray":
		HideMainWindow()
	default:
		ShowMainWindowCloseWindow()
	}
}

func HideMainWindow() {
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return
	}
	window.Hide()
}

// ShowMainWindowCloseWindow opens the dedicated child window used for the close confirmation flow.
func ShowMainWindowCloseWindow() {
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return
	}
	window.Focus()
	_ = (&DesktopService{}).EnsureWindow(WindowCreateRequest{
		Label:                   closeConfirmWindowLabel,
		URL:                     "/close_confirm.html",
		Title:                   "退出 CloudPlayer",
		Width:                   432,
		Height:                  188,
		CenterOnMain:            true,
		Resizable:               false,
		AlwaysOnTop:             true,
		Decorations:             true,
		Transparent:             false,
		Shadow:                  true,
		SkipTaskbar:             true,
		Focus:                   true,
		MacTitleBarStyle:        "hiddenInset",
		InvisibleTitleBarHeight: 44,
	})
}
