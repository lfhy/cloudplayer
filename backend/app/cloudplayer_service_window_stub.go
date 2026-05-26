//go:build android || ios

package cloudplayer

// Window shell controls are desktop-only; mobile bridge builds expose no-op
// implementations to keep the API surface stable.
func (s *CloudPlayerService) HideMainWindow() error {
	return nil
}

func (s *CloudPlayerService) ShowMainWindow() error {
	return nil
}

func (s *CloudPlayerService) QuitApp() {}
