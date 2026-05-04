package desktop

// DesktopService coordinates secondary desktop windows such as tray and lyrics overlays.

import (
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

type DesktopService struct{}

type WindowCreateRequest struct {
	Label                   string `json:"label"`
	URL                     string `json:"url"`
	Title                   string `json:"title"`
	Width                   int    `json:"width"`
	Height                  int    `json:"height"`
	X                       int    `json:"x"`
	Y                       int    `json:"y"`
	Resizable               bool   `json:"resizable"`
	AlwaysOnTop             bool   `json:"always_on_top"`
	Decorations             bool   `json:"decorations"`
	Transparent             bool   `json:"transparent"`
	Shadow                  bool   `json:"shadow"`
	SkipTaskbar             bool   `json:"skip_taskbar"`
	Focus                   bool   `json:"focus"`
	MacTitleBarStyle        string `json:"mac_title_bar_style"`
	InvisibleTitleBarHeight int    `json:"invisible_title_bar_height"`
}

type WindowInfo struct {
	Exists  bool   `json:"exists"`
	Name    string `json:"name"`
	Visible bool   `json:"visible"`
}

func (s *DesktopService) EnsureWindow(req WindowCreateRequest) error {
	if req.Label == "" {
		return fmt.Errorf("window label is required")
	}
	if existing, ok := application.Get().Window.GetByName(req.Label); ok {
		if req.Title != "" {
			existing.SetTitle(req.Title)
		}
		if req.URL != "" {
			existing.SetURL(req.URL)
		}
		if req.Width > 0 && req.Height > 0 {
			existing.SetSize(req.Width, req.Height)
		}
		existing.SetPosition(req.X, req.Y)
		existing.SetAlwaysOnTop(req.AlwaysOnTop)
		existing.Show()
		if req.Focus {
			existing.Focus()
		}
		return nil
	}
	window := application.Get().Window.NewWithOptions(application.WebviewWindowOptions{
		Name:              req.Label,
		Title:             req.Title,
		URL:               req.URL,
		Width:             req.Width,
		Height:            req.Height,
		X:                 req.X,
		Y:                 req.Y,
		InitialPosition:   application.WindowXY,
		DisableResize:     !req.Resizable,
		AlwaysOnTop:       req.AlwaysOnTop,
		Frameless:         !req.Decorations,
		BackgroundType:    backgroundType(req.Transparent),
		IgnoreMouseEvents: false,
		Windows: application.WindowsWindow{
			HiddenOnTaskbar:                   req.SkipTaskbar,
			DisableFramelessWindowDecorations: !req.Shadow,
		},
		Mac: application.MacWindow{
			Backdrop:                macBackdrop(req.Transparent),
			DisableShadow:           !req.Shadow,
			TitleBar:                macTitleBar(req.MacTitleBarStyle),
			InvisibleTitleBarHeight: req.InvisibleTitleBarHeight,
			WindowLevel:             macWindowLevel(req.AlwaysOnTop),
		},
	})
	AttachWindowPersistenceHooks(window, req.Label)
	window.OnWindowEvent(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		_ = application.Get().Event.Emit("wails:window:closing", map[string]any{
			"name": req.Label,
		})
	})
	if req.Focus {
		window.Focus()
	}
	return nil
}

func (s *DesktopService) GetWindowInfo(label string) (WindowInfo, error) {
	window, ok := application.Get().Window.GetByName(label)
	if !ok {
		return WindowInfo{Exists: false, Name: label, Visible: false}, nil
	}
	return WindowInfo{
		Exists:  true,
		Name:    window.Name(),
		Visible: window.IsVisible(),
	}, nil
}

func (s *DesktopService) SetWindowIgnoreMouseEvents(label string, ignore bool) error {
	window, ok := application.Get().Window.GetByName(label)
	if !ok {
		return fmt.Errorf("window %q not found", label)
	}
	window.SetIgnoreMouseEvents(ignore)
	return nil
}

func (s *DesktopService) ShowWindow(label string) error {
	window, ok := application.Get().Window.GetByName(label)
	if !ok {
		return fmt.Errorf("window %q not found", label)
	}
	window.Show()
	return nil
}

func (s *DesktopService) HideWindow(label string) error {
	window, ok := application.Get().Window.GetByName(label)
	if !ok {
		return fmt.Errorf("window %q not found", label)
	}
	window.Hide()
	return nil
}

func (s *DesktopService) FocusWindow(label string) error {
	window, ok := application.Get().Window.GetByName(label)
	if !ok {
		return fmt.Errorf("window %q not found", label)
	}
	window.Focus()
	return nil
}

func backgroundType(transparent bool) application.BackgroundType {
	if transparent {
		return application.BackgroundTypeTransparent
	}
	return application.BackgroundTypeSolid
}

func macBackdrop(transparent bool) application.MacBackdrop {
	if transparent {
		return application.MacBackdropTransparent
	}
	return application.MacBackdropNormal
}

func macWindowLevel(alwaysOnTop bool) application.MacWindowLevel {
	if alwaysOnTop {
		return application.MacWindowLevelFloating
	}
	return application.MacWindowLevelNormal
}

func macTitleBar(style string) application.MacTitleBar {
	switch style {
	case "hidden":
		return application.MacTitleBarHidden
	case "hiddenInset":
		return application.MacTitleBarHiddenInset
	case "hiddenInsetUnified":
		return application.MacTitleBarHiddenInsetUnified
	default:
		return application.MacTitleBarDefault
	}
}
