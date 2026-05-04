package desktop

import (
	"cloudplayer/backend/config"

	"github.com/wailsapp/wails/v3/pkg/application"
)

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
		ShowMainWindowCloseModal()
	}
}

func HideMainWindow() {
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return
	}
	window.Hide()
}

func ShowMainWindowCloseModal() {
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return
	}
	window.Focus()
	window.ExecJS(`(() => {
		if (typeof window.__cloudplayerOpenCloseConfirmModal === "function") {
			window.__cloudplayerOpenCloseConfirmModal();
			return;
		}
		const remember = document.getElementById("close-choice-remember");
		if (remember) remember.checked = false;
		const modal = document.getElementById("close-confirm-modal");
		if (!modal) return;
		modal.hidden = false;
		modal.setAttribute("aria-hidden", "false");
	})();`)
}
