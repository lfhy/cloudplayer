package cloudplayer

import (
	"cloudplayer/backend/config"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Main-window close flow is handled in Go so the preference value always takes effect.
func handleMainWindowCloseRequest() {
	settings := config.LoadSettings()
	switch settings.MainWindowCloseAction {
	case "quit":
		requestAppQuit()
	case "tray":
		hideMainWindow()
	default:
		showMainWindowCloseModal()
	}
}

func hideMainWindow() {
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return
	}
	window.Hide()
}

func showMainWindowCloseModal() {
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
