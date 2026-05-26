//go:build linux && !android

package hotkeys

import "golang.design/x/hotkey"

func platformAltModifier() hotkey.Modifier {
	return hotkey.Mod1
}

func platformSuperModifier() hotkey.Modifier {
	return hotkey.Mod4
}
