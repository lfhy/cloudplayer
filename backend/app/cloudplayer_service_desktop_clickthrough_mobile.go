//go:build android || ios

package cloudplayer

// Mobile hosts do not expose a separate native lyrics window, so click-through
// changes become a no-op.
func (s *CloudPlayerService) SetDesktopLyricsClickThrough(bool) error {
	return nil
}
