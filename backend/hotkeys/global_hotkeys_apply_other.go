//go:build (linux && !android) || windows

package hotkeys

func runHotkeyApply(fn func() (HotkeyApplyReport, error)) (HotkeyApplyReport, error) {
	return fn()
}
