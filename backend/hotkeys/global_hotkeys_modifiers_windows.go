//go:build windows

package hotkeys

import "golang.design/x/hotkey"

func platformAltModifier() hotkey.Modifier {
	return hotkey.ModAlt
}

func platformSuperModifier() hotkey.Modifier {
	return hotkey.ModWin
}
