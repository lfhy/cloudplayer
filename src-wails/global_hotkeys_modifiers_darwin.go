//go:build darwin

package main

import "golang.design/x/hotkey"

func platformAltModifier() hotkey.Modifier {
	return hotkey.ModOption
}

func platformSuperModifier() hotkey.Modifier {
	return hotkey.ModCmd
}
