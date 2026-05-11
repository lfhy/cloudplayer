package cloudplayer

// Windows titlebar theme helpers keep native chrome aligned with the app theme mode.

import (
	"cloudplayer/backend/config"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func configureMainWindowTheme(options *application.WebviewWindowOptions, mode string) {
	if options == nil {
		return
	}
	options.Windows.Theme = windowsThemeForMode(mode)
	options.Windows.CustomTheme = application.ThemeSettings{
		DarkModeActive: &application.WindowTheme{
			BorderColour:    application.NewRGBPtr(24, 26, 31),
			TitleBarColour:  application.NewRGBPtr(24, 26, 31),
			TitleTextColour: application.NewRGBPtr(236, 240, 244),
		},
		DarkModeInactive: &application.WindowTheme{
			BorderColour:    application.NewRGBPtr(40, 42, 47),
			TitleBarColour:  application.NewRGBPtr(40, 42, 47),
			TitleTextColour: application.NewRGBPtr(184, 190, 199),
		},
		LightModeActive: &application.WindowTheme{
			BorderColour:    application.NewRGBPtr(235, 239, 245),
			TitleBarColour:  application.NewRGBPtr(248, 250, 252),
			TitleTextColour: application.NewRGBPtr(24, 26, 31),
		},
		LightModeInactive: &application.WindowTheme{
			BorderColour:    application.NewRGBPtr(229, 233, 239),
			TitleBarColour:  application.NewRGBPtr(241, 244, 248),
			TitleTextColour: application.NewRGBPtr(108, 116, 128),
		},
	}
}

func windowsThemeForMode(mode string) application.Theme {
	switch config.NormalizeAppThemeMode(mode) {
	case "light":
		return application.Light
	case "system":
		return application.SystemDefault
	default:
		return application.Dark
	}
}

func syncMainWindowTheme(mode string) {
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return
	}
	syncNativeWindowTheme(window, mode)
}
