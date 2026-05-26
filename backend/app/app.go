//go:build darwin || (linux && !android) || windows

package cloudplayer

// App startup stays in one place so the root entry file can stay thin after directory refactors.

import (
	"io/fs"
	"log"
	"runtime"
	"sync/atomic"
	"time"

	"cloudplayer/backend/config"
	"cloudplayer/backend/db"
	"cloudplayer/backend/desktop"
	"cloudplayer/backend/hotkeys"
	"cloudplayer/backend/state"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

var quitRequested atomic.Bool
var mainWindowShownOnce atomic.Bool

// Run boots the Wails application with the embedded frontend assets from the root package.
func Run(assets fs.FS, trayTemplateIcon []byte) error {
	defer HandlePanic()
	if err := InitAppLogging(); err != nil {
		log.Printf("init logging failed: %v", err)
	}
	setMacTrayTemplateIcon(trayTemplateIcon)

	conn, err := db.OpenAndInit()
	if err != nil {
		return err
	}
	state := state.NewAppState(conn)
	initialSettings := config.LoadSettings()
	if err := state.ApplyNetworkSettings(initialSettings); err != nil {
		log.Printf("proxy config invalid, fallback to direct client: %v", err)
	}
	state.AppTheme = initialSettings.AppTheme
	state.AppThemeCustomAccent = initialSettings.AppThemeCustomAccent
	state.StartBackgroundWorkers()
	desktop.StartDesktopLyricsHoverTracking()

	cloudPlayer := NewCloudPlayerService(state)
	desktopService := &desktop.DesktopService{}
	baseAssets := application.BundledAssetFileServer(assets)
	app := application.New(application.Options{
		Name:        "CloudPlayer",
		Description: "CloudPlayer desktop rebuilt with Wails v3",
		Icon:        appIconForTheme(initialSettings.AppTheme, initialSettings.AppThemeCustomAccent),
		Services: []application.Service{
			application.NewService(cloudPlayer),
			application.NewService(desktopService),
		},
		Assets: application.AssetOptions{
			Handler: remoteMediaHandler(state, baseAssets),
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
	if runtime.GOOS == "darwin" {
		installApplicationMenu(app)
	}

	state.Hotkeys = hotkeys.NewHotkeyManager(func(action string) {
		_ = app.Event.Emit("global-hotkey", action)
	})
	lyricsContextMenu := buildDesktopLyricsContextMenu(app)
	mainWindowOptions := application.WebviewWindowOptions{
		Name:             "main",
		Title:            "CloudPlayer",
		Width:            1100,
		Height:           700,
		MinWidth:         1000,
		MinHeight:        680,
		URL:              "/",
		BackgroundColour: application.NewRGB(24, 26, 31),
		Mac: application.MacWindow{
			TitleBar:                application.MacTitleBarHiddenInset,
			Appearance:              application.NSAppearanceNameDarkAqua,
			InvisibleTitleBarHeight: 56,
		},
	}
	// Windows keeps the stock titlebar so the shell can lean on native chrome instead of an inner wrapper.
	if runtime.GOOS == "windows" {
		mainWindowOptions.Windows.BackdropType = application.Mica
		configureMainWindowTheme(&mainWindowOptions, initialSettings.AppThemeMode)
	}
	mainWindow := app.Window.NewWithOptions(mainWindowOptions)
	mainWindow.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		if quitRequested.Load() {
			return
		}
		event.Cancel()
		desktop.HandleMainWindowCloseRequest(requestAppQuit)
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
		lyricsContextMenu.Menu.Update()
		app.ContextMenu.Add("lyrics", lyricsContextMenu)
		applyThemeAssets(state, initialSettings.AppTheme, initialSettings.AppThemeCustomAccent)
		go func() {
			time.Sleep(250 * time.Millisecond)
			showMainWindow()
			syncNativeWindowTheme(mainWindow, initialSettings.AppThemeMode)
			if _, err := state.Hotkeys.Apply(cloudPlayer.GetGlobalHotkeys()); err != nil {
				log.Printf("global hotkeys init failed: %v", err)
			}
		}()
	})
	app.Event.OnApplicationEvent(events.Mac.ApplicationShouldHandleReopen, func(_ *application.ApplicationEvent) {
		showMainWindow()
	})
	if runtime.GOOS == "windows" {
		app.Event.OnApplicationEvent(events.Windows.SystemThemeChanged, func(_ *application.ApplicationEvent) {
			mode := config.LoadSettings().AppThemeMode
			syncMainWindowTheme(mode)
			desktop.SyncDesktopWindowThemes(mode)
		})
	}
	app.Event.OnApplicationEvent(events.Mac.ApplicationWillTerminate, func(_ *application.ApplicationEvent) {
		if err := desktop.PersistDesktopLyricsBoundsNow(); err != nil {
			log.Printf("persist desktop lyrics bounds on quit failed: %v", err)
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
	state.SystemTray = systemTrayAdapter{tray: systemTray}
	systemTray.SetTooltip("CloudPlayer")
	systemTray.SetMenu(trayMenu)
	systemTray.AttachWindow(trayWindow).WindowOffset(1)
	return app.Run()
}

func buildDesktopLyricsContextMenu(app *application.App) *application.ContextMenu {
	menu := app.ContextMenu.New()
	menu.Add("关闭歌词").OnClick(func(ctx *application.Context) {
		_ = app.Event.Emit("desktop-lyrics-close-request")
	})
	menu.Add("更换歌词").OnClick(func(ctx *application.Context) {
		_ = app.Event.Emit("desktop-lyrics-open-replace")
	})
	menu.AddSeparator()
	menu.Add("缩小字号").OnClick(func(ctx *application.Context) {
		_ = app.Event.Emit("desktop-lyrics-scale-step", map[string]any{"delta": -0.08, "__tauriTarget": "lyrics"})
	})
	menu.Add("放大字号").OnClick(func(ctx *application.Context) {
		_ = app.Event.Emit("desktop-lyrics-scale-step", map[string]any{"delta": 0.08, "__tauriTarget": "lyrics"})
	})
	menu.AddSeparator()
	menu.Add("锁定歌词窗口").OnClick(func(ctx *application.Context) {
		_ = app.Event.Emit("desktop-lyrics-request-lock", map[string]any{"locked": true})
	})
	return menu
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
	if mainWindowShownOnce.CompareAndSwap(false, true) {
		window.Show()
		return
	}
	window.Restore()
	window.UnMinimise()
	window.Show()
	window.Focus()
}
