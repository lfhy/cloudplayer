//go:build !darwin

package main

// Desktop lyric hover tracking is platform-specific; non-macOS builds keep it disabled.
func startDesktopLyricsHoverTracking() {}
