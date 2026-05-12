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
	bounds := closeConfirmWindowBounds(window)
	_ = (&DesktopService{}).EnsureWindow(WindowCreateRequest{
		Label:                   closeConfirmWindowLabel,
		URL:                     "/close_confirm.html",
		Title:                   "退出 CloudPlayer",
		Width:                   bounds.Width,
		Height:                  bounds.Height,
		X:                       bounds.X,
		Y:                       bounds.Y,
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

func closeConfirmWindowBounds(mainWindow application.Window) application.Rect {
	const width = 420
	const height = 292
	x, y := mainWindow.Position()
	mainWidth, mainHeight := mainWindow.Size()
	nextX := x + (mainWidth-width)/2
	nextY := y + maxCloseConfirmInt(28, (mainHeight-height)/3)
	screen := application.Get().Screen.GetPrimary()
	if screen == nil {
		return application.Rect{X: maxCloseConfirmInt(0, nextX), Y: maxCloseConfirmInt(0, nextY), Width: width, Height: height}
	}
	maxX := screen.Bounds.X + maxCloseConfirmInt(0, screen.Size.Width-width)
	maxY := screen.Bounds.Y + maxCloseConfirmInt(0, screen.Size.Height-height)
	return application.Rect{
		X: clampInt(nextX, screen.Bounds.X, maxX),
		Y: clampInt(nextY, screen.Bounds.Y, maxY),
		Width:  width,
		Height: height,
	}
}

func clampInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func maxCloseConfirmInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
