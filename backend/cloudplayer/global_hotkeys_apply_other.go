//go:build linux || windows

package cloudplayer

func runHotkeyApply(fn func() (HotkeyApplyReport, error)) (HotkeyApplyReport, error) {
	return fn()
}
