package desktop

import "github.com/wailsapp/wails/v3/pkg/application"

const mainWindowLabel = "main"

// centerWindowOnMain uses screen-relative work-area coordinates so desktop child windows align with the main window on macOS and Windows.
func centerWindowOnMain(window application.Window, width, height int) bool {
	nextX, nextY, ok := centeredRelativePositionOnMain(width, height)
	if !ok {
		return false
	}
	window.SetRelativePosition(nextX, nextY)
	return true
}

func centeredRelativePositionOnMain(width, height int) (int, int, bool) {
	if width <= 0 || height <= 0 {
		return 0, 0, false
	}
	mainWindow, ok := application.Get().Window.GetByName(mainWindowLabel)
	if !ok {
		return 0, 0, false
	}
	mainX, mainY := mainWindow.RelativePosition()
	mainWidth, mainHeight := mainWindow.Size()
	nextX := mainX + (mainWidth-width)/2
	nextY := mainY + (mainHeight-height)/2
	screen, err := mainWindow.GetScreen()
	if err != nil || screen == nil {
		return maxDesktopInt(0, nextX), maxDesktopInt(0, nextY), true
	}
	workArea := screen.WorkArea
	maxX := maxDesktopInt(0, workArea.Width-width)
	maxY := maxDesktopInt(0, workArea.Height-height)
	return clampDesktopInt(nextX, 0, maxX), clampDesktopInt(nextY, 0, maxY), true
}

func clampDesktopInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func maxDesktopInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
