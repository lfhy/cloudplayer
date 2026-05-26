//go:build darwin || (linux && !android) || windows

package cloudplayer

import "github.com/wailsapp/wails/v3/pkg/application"

// systemTrayAdapter narrows Wails' fluent tray API to the small shared surface
// the backend state needs across desktop and mobile bridge builds.
type systemTrayAdapter struct {
	tray *application.SystemTray
}

func (adapter systemTrayAdapter) SetLabel(value string) {
	if adapter.tray == nil {
		return
	}
	adapter.tray.SetLabel(value)
}

func (adapter systemTrayAdapter) SetTemplateIcon(icon []byte) {
	if adapter.tray == nil {
		return
	}
	adapter.tray.SetTemplateIcon(icon)
}
