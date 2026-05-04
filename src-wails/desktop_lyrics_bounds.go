package main

import (
	"cloudplayer/internal/cloudplayer/config"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// Desktop lyrics bounds helpers keep geometry persistence close to native window APIs.
func persistDesktopLyricsBoundsNow() error {
	window, ok := application.Get().Window.GetByName("lyrics")
	if !ok {
		return nil
	}
	x, y := window.Position()
	width, height := window.Size()
	settings := config.LoadSettings()
	settings.DesktopLyricsX = intPtr(x)
	settings.DesktopLyricsY = intPtr(y)
	if width > 0 {
		settings.DesktopLyricsWidth = intPtr(width)
	}
	if height > 0 {
		settings.DesktopLyricsHeight = intPtr(height)
	}
	return config.SaveSettings(settings)
}

// PersistDesktopLyricsBounds snapshots the current floating lyrics geometry immediately.
func (s *CloudPlayerService) PersistDesktopLyricsBounds() error {
	return persistDesktopLyricsBoundsNow()
}

// ResetDesktopLyricsBounds clears persisted geometry and re-centers the live window when present.
func (s *CloudPlayerService) ResetDesktopLyricsBounds() error {
	settings := config.LoadSettings()
	settings.DesktopLyricsX = nil
	settings.DesktopLyricsY = nil
	settings.DesktopLyricsWidth = nil
	settings.DesktopLyricsHeight = nil
	if err := config.SaveSettings(settings); err != nil {
		return err
	}
	window, ok := application.Get().Window.GetByName("lyrics")
	if !ok {
		return nil
	}
	bounds := defaultDesktopLyricsBounds()
	window.SetSize(bounds.Width, bounds.Height)
	window.SetPosition(bounds.X, bounds.Y)
	return nil
}

func defaultDesktopLyricsBounds() application.Rect {
	screen := application.Get().Screen.GetPrimary()
	if screen == nil {
		return application.Rect{X: 120, Y: 48, Width: 720, Height: 132}
	}
	width := minInt(720, screen.Size.Width-40)
	if width < 320 {
		width = 320
	}
	x := maxInt(0, screen.Bounds.X+(screen.Size.Width-width)/2)
	return application.Rect{X: x, Y: 48, Width: width, Height: 132}
}

func intPtr(value int) *int {
	next := value
	return &next
}
