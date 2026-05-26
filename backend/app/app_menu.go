//go:build darwin || (linux && !android) || windows

package cloudplayer

// macOS application menu replaces the stock Wails menus with CloudPlayer-focused entries.

import "github.com/wailsapp/wails/v3/pkg/application"

const aboutDialogMessage = "作者：3000y\n交流群：572532027"

func installApplicationMenu(app *application.App) {
	if app == nil {
		return
	}
	app.Menu.SetApplicationMenu(buildMacApplicationMenu(app))
}

func buildMacApplicationMenu(app *application.App) *application.Menu {
	menu := app.NewMenu()

	appMenu := menu.AddSubmenu("CloudPlayer")
	appMenu.Add("关于 CloudPlayer").OnClick(func(*application.Context) {
		showAboutCloudPlayer(app)
	})
	appMenu.AddSeparator()
	appMenu.Add("显示主窗口").OnClick(func(*application.Context) {
		showMainWindow()
	})
	appMenu.AddSeparator()
	appMenu.Add("隐藏 CloudPlayer").SetRole(application.Hide)
	appMenu.Add("隐藏其他应用").SetRole(application.HideOthers)
	appMenu.Add("显示所有应用").SetRole(application.ShowAll)
	appMenu.AddSeparator()
	appMenu.Add("退出 CloudPlayer").SetAccelerator("CmdOrCtrl+q").OnClick(func(*application.Context) {
		requestAppQuit()
	})

	windowMenu := menu.AddSubmenu("窗口")
	windowMenu.Add("显示主窗口").OnClick(func(*application.Context) {
		showMainWindow()
	})
	windowMenu.AddSeparator()
	windowMenu.Add("最小化").SetAccelerator("CmdOrCtrl+m").OnClick(func(*application.Context) {
		if window := currentMenuWindow(); window != nil {
			window.Minimise()
		}
	})
	windowMenu.Add("缩放").OnClick(func(*application.Context) {
		if window := currentMenuWindow(); window != nil {
			window.Zoom()
		}
	})
	windowMenu.AddSeparator()
	windowMenu.Add("前置所有窗口").OnClick(func(*application.Context) {
		showMainWindow()
	})

	return menu
}

func showAboutCloudPlayer(app *application.App) {
	dialog := app.Dialog.Info().
		SetTitle("关于 CloudPlayer").
		SetMessage(aboutDialogMessage)
	if window := currentMenuWindow(); window != nil {
		dialog.AttachToWindow(window)
	}
	dialog.Show()
}

func currentMenuWindow() application.Window {
	current := application.Get().Window.Current()
	if current != nil {
		return current
	}
	window, ok := application.Get().Window.GetByName("main")
	if !ok {
		return nil
	}
	return window
}
