//go:build darwin || (linux && !android) || windows

package cloudplayer

// Desktop-facing service methods proxy to the dedicated desktop package while keeping Wails bindings stable.

import "cloudplayer/backend/desktop"

func (s *CloudPlayerService) PersistDesktopLyricsBounds() error {
	return desktop.PersistDesktopLyricsBoundsNow()
}

func (s *CloudPlayerService) ResetDesktopLyricsBounds() error {
	return desktop.ResetDesktopLyricsBounds()
}
