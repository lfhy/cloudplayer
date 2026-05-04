//go:build !darwin

package cloudplayer

// Desktop lyric hover tracking is platform-specific; non-macOS builds keep it disabled.
func startDesktopLyricsHoverTracking() {}
