//go:build (linux && !android) || windows

package desktop

// Desktop lyric hover tracking is platform-specific; non-macOS builds keep it disabled.
func StartDesktopLyricsHoverTracking() {}
