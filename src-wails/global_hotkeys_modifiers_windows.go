//go:build windows

package main

import "golang.design/x/hotkey"

func platformAltModifier() hotkey.Modifier {
	return hotkey.ModAlt
}

func platformSuperModifier() hotkey.Modifier {
	return hotkey.ModWin
}
