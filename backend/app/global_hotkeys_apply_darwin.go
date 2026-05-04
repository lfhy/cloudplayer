//go:build darwin

package cloudplayer

type hotkeyApplyResult struct {
	report HotkeyApplyReport
	err    error
}

func runHotkeyApply(fn func() (HotkeyApplyReport, error)) (HotkeyApplyReport, error) {
	ch := make(chan hotkeyApplyResult, 1)
	go func() {
		report, err := fn()
		ch <- hotkeyApplyResult{report: report, err: err}
	}()
	result := <-ch
	return result.report, result.err
}
