package main

import (
	"embed"
	"log"
	"net/http"
	"sync/atomic"

	"cloudplayer/internal/cloudplayer/db"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

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
	state.StartBackgroundWorkers()
	cloudPlayer := NewCloudPlayerService(state)
	desktop := &DesktopService{}

	baseAssets := application.BundledAssetFileServer(assets)
	app := application.New(application.Options{
		Name:        "CloudPlayer",
		Description: "CloudPlayer desktop rebuilt with Wails v3",
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
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(_ *application.ApplicationEvent) {
		app.Show()
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
	if len(appIcon) > 0 {
		systemTray.SetIcon(appIcon)
	}
	systemTray.SetTooltip("CloudPlayer")
	systemTray.SetMenu(trayMenu)
	systemTray.OnClick(func() {
		showMainWindow()
	})

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
