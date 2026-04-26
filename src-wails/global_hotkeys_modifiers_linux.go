//go:build linux

package main

import "golang.design/x/hotkey"

func platformAltModifier() hotkey.Modifier {
	return hotkey.Mod1
}

func platformSuperModifier() hotkey.Modifier {
	return hotkey.Mod4
}
