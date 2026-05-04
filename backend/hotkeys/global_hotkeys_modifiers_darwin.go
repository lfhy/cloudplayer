//go:build darwin

package hotkeys

import "golang.design/x/hotkey"

func platformAltModifier() hotkey.Modifier {
	return hotkey.ModOption
}

func platformSuperModifier() hotkey.Modifier {
	return hotkey.ModCmd
}
