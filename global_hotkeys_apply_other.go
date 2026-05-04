//go:build linux || windows

package main

func runHotkeyApply(fn func() (HotkeyApplyReport, error)) (HotkeyApplyReport, error) {
	return fn()
}
