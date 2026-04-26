package main

import (
	"embed"
	"log"
	"net/http"
	"runtime"
	"sync/atomic"

	"cloudplayer/internal/cloudplayer/config"
	"cloudplayer/internal/cloudplayer/db"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

var quitRequested atomic.Bool

func main() {
	defer HandlePanic()
	if err := InitAppLogging(); err != nil {
		log.Printf("init logging failed: %v", err)
	}
	conn, err := db.OpenAndInit()
	if err != nil {
		log.Fatal(err)
	}
	state := NewAppState(conn)
	initialSettings := config.LoadSettings()
	state.AppTheme = initialSettings.AppTheme
	state.AppThemeCustomAccent = initialSettings.AppThemeCustomAccent
	state.StartBackgroundWorkers()
	cloudPlayer := NewCloudPlayerService(state)
	desktop := &DesktopService{}

	baseAssets := application.BundledAssetFileServer(assets)
	app := application.New(application.Options{
		Name:        "CloudPlayer",
		Description: "CloudPlayer desktop rebuilt with Wails v3",
		Icon:        appIconForTheme(initialSettings.AppTheme, initialSettings.AppThemeCustomAccent),
		Services: []application.Service{
			application.NewService(cloudPlayer),
			application.NewService(desktop),
		},
		Assets: application.AssetOptions{
			Handler: mediaHandler(baseAssets),
		},
		Windows: application.WindowsOptions{
			DisableQuitOnLastWindowClosed: true,
		},
		Linux: application.LinuxOptions{
			DisableQuitOnLastWindowClosed: true,
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})
	state.Hotkeys = NewHotkeyManager(func(action string) {
		_ = app.Event.Emit("global-hotkey", action)
	})
	mainWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "main",
		Title:            "CloudPlayer",
		Width:            1100,
		Height:           700,
		URL:              "/",
		BackgroundColour: application.NewRGB(245, 245, 247),
		Mac: application.MacWindow{
			TitleBar:                application.MacTitleBarHiddenInset,
			InvisibleTitleBarHeight: 56,
		},
	})
	mainWindow.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		if quitRequested.Load() {
			return
		}
		event.Cancel()
		_ = application.Get().Event.Emit("main-close-requested", map[string]any{
			"__tauriTarget": "main",
		})
	})
	trayWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "tray-player",
		Title:            "CloudPlayer",
		Width:            364,
		Height:           182,
		URL:              "/tray_player.html",
		BackgroundType:   application.BackgroundTypeTransparent,
		Hidden:           true,
		Frameless:        true,
		AlwaysOnTop:      true,
		DisableResize:    true,
		HideOnFocusLost:  true,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),
		Mac: application.MacWindow{
			Backdrop:      application.MacBackdropTranslucent,
			DisableShadow: false,
			WindowLevel:   application.MacWindowLevelFloating,
		},
		Windows: application.WindowsWindow{
			HiddenOnTaskbar: true,
		},
	})
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(_ *application.ApplicationEvent) {
		application.InvokeSync(app.Show)
		applyThemeAssets(state, initialSettings.AppTheme, initialSettings.AppThemeCustomAccent)
		showMainWindow()
		if _, err := state.Hotkeys.Apply(cloudPlayer.GetGlobalHotkeys()); err != nil {
			log.Printf("global hotkeys init failed: %v", err)
		}
	})

	trayMenu := app.NewMenu()
	trayMenu.Add("显示主窗口").OnClick(func(ctx *application.Context) {
		showMainWindow()
	})
	trayMenu.Add("退出").OnClick(func(ctx *application.Context) {
		requestAppQuit()
	})
	systemTray := app.SystemTray.New()
	if runtime.GOOS == "darwin" && len(macTrayTemplateIcon) > 0 {
		systemTray.SetTemplateIcon(macTrayTemplateIcon)
	} else if icon := appIconForTheme(initialSettings.AppTheme, initialSettings.AppThemeCustomAccent); len(icon) > 0 {
		systemTray.SetIcon(icon)
	}
	state.SystemTray = systemTray
	systemTray.SetTooltip("CloudPlayer")
	systemTray.SetMenu(trayMenu)
	systemTray.AttachWindow(trayWindow).WindowOffset(1)

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

func requestAppQuit() {
	quitRequested.Store(true)
	application.Get().Quit()
}

func showMainWindow() {
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return
	}
	window.Show()
	window.Focus()
}

func mediaHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/__media__" {
			path := request.URL.Query().Get("path")
			if path == "" {
				http.NotFound(writer, request)
				return
			}
			http.ServeFile(writer, request, path)
			return
		}
		next.ServeHTTP(writer, request)
	})
}
