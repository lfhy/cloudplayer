package cloudplayer

import (
	"runtime"
	"strings"
)

// Tray-facing service methods keep menu bar label updates isolated from playback and window APIs.
func (s *CloudPlayerService) SetTrayLabel(text string) error {
	if runtime.GOOS != "darwin" || s == nil || s.state == nil || s.state.SystemTray == nil {
		return nil
	}
	label := strings.TrimSpace(strings.NewReplacer("\r", " ", "\n", " ").Replace(text))
	s.state.SystemTray.SetLabel(label)
	return nil
}
