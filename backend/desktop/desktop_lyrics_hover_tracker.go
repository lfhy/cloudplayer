//go:build !darwin

package desktop

// Desktop lyric hover tracking is platform-specific; non-macOS builds keep it disabled.
func StartDesktopLyricsHoverTracking() {}
