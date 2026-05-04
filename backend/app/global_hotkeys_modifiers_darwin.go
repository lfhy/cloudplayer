//go:build darwin

package cloudplayer

import "golang.design/x/hotkey"

func platformAltModifier() hotkey.Modifier {
	return hotkey.ModOption
}

func platformSuperModifier() hotkey.Modifier {
	return hotkey.ModCmd
}
