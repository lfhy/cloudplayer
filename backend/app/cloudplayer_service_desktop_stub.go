//go:build android || ios

package cloudplayer

// Mobile bridge builds keep desktop-only service methods as no-ops so shared
// bindings remain callable without dragging Wails window dependencies in.
func (s *CloudPlayerService) PersistDesktopLyricsBounds() error {
	return nil
}

func (s *CloudPlayerService) ResetDesktopLyricsBounds() error {
	return nil
}
