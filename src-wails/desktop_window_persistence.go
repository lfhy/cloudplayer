package main

import (
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// Native window persistence hooks keep secondary-window geometry durable across relaunches.
func attachWindowPersistenceHooks(window application.Window, label string) {
	if label != "lyrics" {
		return
	}
	var saveTimer *time.Timer
	scheduleSave := func() {
		if saveTimer != nil {
			saveTimer.Stop()
		}
		saveTimer = time.AfterFunc(220*time.Millisecond, func() {
			if err := persistDesktopLyricsBoundsNow(); err != nil {
				log.Printf("persist desktop lyrics bounds failed: %v", err)
			}
		})
	}
	saveNow := func() {
		if saveTimer != nil {
			saveTimer.Stop()
			saveTimer = nil
		}
		if err := persistDesktopLyricsBoundsNow(); err != nil {
			log.Printf("persist desktop lyrics bounds failed: %v", err)
		}
	}
	window.OnWindowEvent(events.Common.WindowDidMove, func(_ *application.WindowEvent) {
		scheduleSave()
	})
	window.OnWindowEvent(events.Common.WindowDidResize, func(_ *application.WindowEvent) {
		scheduleSave()
	})
	window.OnWindowEvent(events.Common.WindowHide, func(_ *application.WindowEvent) {
		saveNow()
	})
	window.OnWindowEvent(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		saveNow()
	})
}
