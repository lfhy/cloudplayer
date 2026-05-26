//go:build darwin || (linux && !android) || windows

package desktop

// Native dialog helpers keep Windows-specific message/confirm flows out of the custom child-window chrome.

import (
	"fmt"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type NativeDialogRequest struct {
	Title       string `json:"title"`
	Heading     string `json:"heading"`
	Message     string `json:"message"`
	ParentLabel string `json:"parent_label"`
}

func nativeDialogParentWindow(label string) application.Window {
	trimmed := strings.TrimSpace(label)
	if trimmed != "" {
		if window, ok := application.Get().Window.GetByName(trimmed); ok {
			return window
		}
	}
	if current := application.Get().Window.Current(); current != nil {
		return current
	}
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return nil
	}
	return window
}

func nativeDialogMessage(heading, message string) string {
	trimmedHeading := strings.TrimSpace(heading)
	trimmedMessage := strings.TrimSpace(message)
	switch {
	case trimmedHeading == "":
		return trimmedMessage
	case trimmedMessage == "":
		return trimmedHeading
	case trimmedHeading == trimmedMessage:
		return trimmedMessage
	default:
		return trimmedHeading + "\n\n" + trimmedMessage
	}
}

func applyDialogIcon(dialog *application.MessageDialog) *application.MessageDialog {
	if dialog == nil {
		return nil
	}
	if runtime.GOOS == "windows" {
		if app := application.Get(); app != nil {
			icon := app.Config().Icon
			if len(icon) > 0 {
				return dialog.SetIcon(icon)
			}
		}
	}
	return dialog
}

func (s *DesktopService) ShowNativeMessageDialog(req NativeDialogRequest) error {
	app := application.Get()
	if app == nil || app.Dialog == nil {
		return fmt.Errorf("application dialog manager unavailable")
	}
	dialog := applyDialogIcon(app.Dialog.Info()).
		SetTitle(strings.TrimSpace(req.Title)).
		SetMessage(nativeDialogMessage(req.Heading, req.Message))
	if window := nativeDialogParentWindow(req.ParentLabel); window != nil {
		dialog.AttachToWindow(window)
	}
	dialog.Show()
	return nil
}

func (s *DesktopService) ShowNativeQuestionDialog(req NativeDialogRequest) (bool, error) {
	app := application.Get()
	if app == nil || app.Dialog == nil {
		return false, fmt.Errorf("application dialog manager unavailable")
	}
	accepted := false
	dialog := applyDialogIcon(app.Dialog.Question()).
		SetTitle(strings.TrimSpace(req.Title)).
		SetMessage(nativeDialogMessage(req.Heading, req.Message))
	yesButton := dialog.AddButton("Yes").OnClick(func() {
		accepted = true
	})
	noButton := dialog.AddButton("No").OnClick(func() {
		accepted = false
	})
	dialog.SetDefaultButton(yesButton)
	dialog.SetCancelButton(noButton)
	if window := nativeDialogParentWindow(req.ParentLabel); window != nil {
		dialog.AttachToWindow(window)
	}
	dialog.Show()
	return accepted, nil
}
