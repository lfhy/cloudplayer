package main

// DesktopService exposes native context menus for lightweight utility windows.

import (
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type WindowContextMenuRequest struct {
	Label string `json:"label"`
	Menu  string `json:"menu"`
	X     int    `json:"x"`
	Y     int    `json:"y"`
}

func (s *DesktopService) OpenWindowContextMenu(req WindowContextMenuRequest) error {
	if req.Label == "" {
		return fmt.Errorf("window label is required")
	}
	window, ok := application.Get().Window.GetByName(req.Label)
	if !ok {
		return fmt.Errorf("window %q not found", req.Label)
	}
	menu, ok := application.Get().ContextMenu.Get(req.Menu)
	if !ok {
		return fmt.Errorf("context menu %q not found", req.Menu)
	}
	window.OpenContextMenu(&application.ContextMenuData{
		Id: req.Menu,
		X:  req.X,
		Y:  req.Y,
	})
	menu.Update()
	return nil
}
