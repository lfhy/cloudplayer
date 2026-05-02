//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework AppKit
#import <AppKit/AppKit.h>

typedef struct {
	double x;
	double y;
} CloudPlayerPoint;

static CloudPlayerPoint currentMouseLocation(void) {
	NSPoint point = [NSEvent mouseLocation];
	CloudPlayerPoint result;
	result.x = point.x;
	result.y = point.y;
	return result;
}
*/
import "C"

import (
	"math"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Desktop lyric hover tracking polls the global mouse position so hover works even when the window is inactive.
func startDesktopLyricsHoverTracking() {
	go func() {
		ticker := time.NewTicker(33 * time.Millisecond)
		defer ticker.Stop()
		hovered := false
		for range ticker.C {
			next := desktopLyricsWindowHovered()
			if next == hovered {
				continue
			}
			hovered = next
			_ = application.Get().Event.Emit("desktop-lyrics-hover-state", map[string]any{
				"hovered": hovered,
			})
		}
	}()
}

func desktopLyricsWindowHovered() bool {
	app := application.Get()
	if app == nil {
		return false
	}
	window, ok := app.Window.GetByName("lyrics")
	if !ok || !window.IsVisible() {
		return false
	}
	screen, err := window.GetScreen()
	if err != nil || screen == nil {
		return false
	}

	mouseX, mouseY := currentMouseLocation()
	screenBounds := screen.Bounds
	mousePointX := int(math.Round(mouseX))
	mousePointY := int(math.Round(mouseY))
	if !screenBounds.Contains(application.Point{X: mousePointX, Y: mousePointY}) {
		return false
	}

	winX, winY := window.Position()
	winW, winH := window.Size()
	scale := float64(screen.ScaleFactor)
	hoverX := int(math.Round(mouseX * scale))
	hoverY := int(math.Round((float64(screenBounds.Height) - (mouseY - float64(screenBounds.Y))) * scale))
	return hoverX >= winX && hoverX < winX+winW && hoverY >= winY && hoverY < winY+winH
}

func currentMouseLocation() (float64, float64) {
	point := C.currentMouseLocation()
	return float64(point.x), float64(point.y)
}
