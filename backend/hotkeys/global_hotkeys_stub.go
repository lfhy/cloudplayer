//go:build !(darwin || linux || windows)

package hotkeys

import "cloudplayer/backend/config"

type HotkeyEntryStatus struct {
	OK    bool    `json:"ok"`
	Error *string `json:"error,omitempty"`
}

type HotkeyApplyReport struct {
	PlayPause  HotkeyEntryStatus `json:"play_pause"`
	Prev       HotkeyEntryStatus `json:"prev"`
	Next       HotkeyEntryStatus `json:"next"`
	VolumeUp   HotkeyEntryStatus `json:"volume_up"`
	VolumeDown HotkeyEntryStatus `json:"volume_down"`
}

func AllOKHotkeyReport() HotkeyApplyReport {
	ok := HotkeyEntryStatus{OK: true}
	return HotkeyApplyReport{
		PlayPause:  ok,
		Prev:       ok,
		Next:       ok,
		VolumeUp:   ok,
		VolumeDown: ok,
	}
}

type HotkeyManager struct{}

func NewHotkeyManager(func(string)) *HotkeyManager {
	return &HotkeyManager{}
}

func (m *HotkeyManager) Apply(config.GlobalHotkeys) (HotkeyApplyReport, error) {
	return AllOKHotkeyReport(), nil
}

func ValidateAcceleratorString(string) error {
	return nil
}
