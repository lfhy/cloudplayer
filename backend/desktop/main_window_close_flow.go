package desktop

import (
	"cloudplayer/backend/config"
	"runtime"

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
		if runtime.GOOS == "windows" {
			if showWindowsMainWindowCloseDialog(onQuit) {
				return
			}
		}
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

// Windows uses a native multi-button confirmation here so close/titlebar flows match system dialog behavior.
func showWindowsMainWindowCloseDialog(onQuit func()) bool {
	result, err := (&DesktopService{}).ShowNativeChoiceDialog(NativeDialogChoiceRequest{
		Title:       "退出 CloudPlayer",
		Heading:     "关闭主窗口？",
		Message:     "你可以最小化到系统托盘，或直接退出 CloudPlayer。",
		ParentLabel: "main",
		Buttons: []NativeDialogButton{
			{Label: "最小化到托盘", Action: "tray", Default: true},
			{Label: "退出应用", Action: "quit"},
			{Label: "取消", Action: "cancel", Cancel: true},
		},
	})
	if err != nil {
		return false
	}
	switch result {
	case "tray":
		HideMainWindow()
		return true
	case "quit":
		if onQuit != nil {
			onQuit()
		}
		return true
	default:
		return true
	}
}
