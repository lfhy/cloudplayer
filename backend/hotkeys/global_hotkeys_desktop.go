//go:build darwin || (linux && !android) || windows

package hotkeys

import (
	"fmt"
	"strings"
	"sync"

	"cloudplayer/backend/config"
	"golang.design/x/hotkey"
)

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

func allOKStatus() HotkeyEntryStatus {
	return HotkeyEntryStatus{OK: true}
}

func statusErr(err error) HotkeyEntryStatus {
	if err == nil {
		return allOKStatus()
	}
	msg := err.Error()
	return HotkeyEntryStatus{OK: false, Error: &msg}
}

func AllOKHotkeyReport() HotkeyApplyReport {
	ok := allOKStatus()
	return HotkeyApplyReport{
		PlayPause:  ok,
		Prev:       ok,
		Next:       ok,
		VolumeUp:   ok,
		VolumeDown: ok,
	}
}

type registeredHotkey struct {
	action string
	hk     *hotkey.Hotkey
}

type HotkeyManager struct {
	mu       sync.Mutex
	active   []*registeredHotkey
	onAction func(string)
}

func NewHotkeyManager(onAction func(string)) *HotkeyManager {
	return &HotkeyManager{onAction: onAction}
}

func (m *HotkeyManager) Apply(cfg config.GlobalHotkeys) (HotkeyApplyReport, error) {
	return runHotkeyApply(func() (HotkeyApplyReport, error) {
		return m.applyLocked(cfg)
	})
}

func (m *HotkeyManager) applyLocked(cfg config.GlobalHotkeys) (HotkeyApplyReport, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if err := m.unregisterAllLocked(); err != nil {
		return HotkeyApplyReport{}, err
	}

	report := AllOKHotkeyReport()
	if !cfg.Enabled {
		return report, nil
	}

	report.PlayPause = m.registerLocked("play_pause", cfg.PlayPause)
	report.Prev = m.registerLocked("prev", cfg.Prev)
	report.Next = m.registerLocked("next", cfg.Next)
	report.VolumeUp = m.registerLocked("volume_up", cfg.VolumeUp)
	report.VolumeDown = m.registerLocked("volume_down", cfg.VolumeDown)
	return report, nil
}

func (m *HotkeyManager) unregisterAllLocked() error {
	var firstErr error
	for _, item := range m.active {
		if item == nil || item.hk == nil {
			continue
		}
		if err := item.hk.Unregister(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	m.active = nil
	return firstErr
}

func (m *HotkeyManager) registerLocked(action, accelerator string) HotkeyEntryStatus {
	parsed, err := parseAccelerator(strings.TrimSpace(accelerator))
	if err != nil {
		return statusErr(err)
	}
	if parsed == nil {
		return allOKStatus()
	}
	if err := parsed.Register(); err != nil {
		return statusErr(err)
	}
	item := &registeredHotkey{action: action, hk: parsed}
	m.active = append(m.active, item)
	go func() {
		for range parsed.Keydown() {
			if m.onAction != nil {
				m.onAction(action)
			}
		}
	}()
	return allOKStatus()
}

func ValidateAcceleratorString(raw string) error {
	_, err := parseAccelerator(raw)
	return err
}

func parseAccelerator(raw string) (*hotkey.Hotkey, error) {
	text := strings.ToLower(strings.TrimSpace(raw))
	if text == "" {
		return nil, nil
	}
	parts := strings.Split(text, "+")
	if len(parts) < 2 {
		return nil, fmt.Errorf("快捷键至少需要一个修饰键和一个主键")
	}

	mods := make([]hotkey.Modifier, 0, len(parts)-1)
	seen := make(map[string]struct{}, len(parts)-1)
	for _, part := range parts[:len(parts)-1] {
		modToken := strings.TrimSpace(part)
		if modToken == "" {
			return nil, fmt.Errorf("快捷键格式无效")
		}
		if _, ok := seen[modToken]; ok {
			continue
		}
		mod, err := parseModifier(modToken)
		if err != nil {
			return nil, err
		}
		mods = append(mods, mod)
		seen[modToken] = struct{}{}
	}

	keyToken := strings.TrimSpace(parts[len(parts)-1])
	key, err := parseKey(keyToken)
	if err != nil {
		return nil, err
	}
	return hotkey.New(mods, key), nil
}

func parseModifier(token string) (hotkey.Modifier, error) {
	switch token {
	case "ctrl", "control":
		return hotkey.ModCtrl, nil
	case "shift":
		return hotkey.ModShift, nil
	case "alt", "option":
		return platformAltModifier(), nil
	case "super", "cmd", "command", "meta":
		return platformSuperModifier(), nil
	default:
		return 0, fmt.Errorf("不支持的修饰键: %s", token)
	}
}

func parseKey(token string) (hotkey.Key, error) {
	switch token {
	case "space":
		return hotkey.KeySpace, nil
	case "left":
		return hotkey.KeyLeft, nil
	case "right":
		return hotkey.KeyRight, nil
	case "up":
		return hotkey.KeyUp, nil
	case "down":
		return hotkey.KeyDown, nil
	case "enter", "return":
		return hotkey.KeyReturn, nil
	case "tab":
		return hotkey.KeyTab, nil
	case "delete":
		return hotkey.KeyDelete, nil
	case "escape", "esc":
		return hotkey.KeyEscape, nil
	}

	if key, ok := supportedKeys[token]; ok {
		return key, nil
	}

	if len(token) > 1 && token[0] == 'f' {
		switch token {
		case "f1":
			return hotkey.KeyF1, nil
		case "f2":
			return hotkey.KeyF2, nil
		case "f3":
			return hotkey.KeyF3, nil
		case "f4":
			return hotkey.KeyF4, nil
		case "f5":
			return hotkey.KeyF5, nil
		case "f6":
			return hotkey.KeyF6, nil
		case "f7":
			return hotkey.KeyF7, nil
		case "f8":
			return hotkey.KeyF8, nil
		case "f9":
			return hotkey.KeyF9, nil
		case "f10":
			return hotkey.KeyF10, nil
		case "f11":
			return hotkey.KeyF11, nil
		case "f12":
			return hotkey.KeyF12, nil
		case "f13":
			return hotkey.KeyF13, nil
		case "f14":
			return hotkey.KeyF14, nil
		case "f15":
			return hotkey.KeyF15, nil
		case "f16":
			return hotkey.KeyF16, nil
		case "f17":
			return hotkey.KeyF17, nil
		case "f18":
			return hotkey.KeyF18, nil
		case "f19":
			return hotkey.KeyF19, nil
		case "f20":
			return hotkey.KeyF20, nil
		}
	}

	return 0, fmt.Errorf("不支持的按键: %s", token)
}

var supportedKeys = map[string]hotkey.Key{
	"0": hotkey.Key0,
	"1": hotkey.Key1,
	"2": hotkey.Key2,
	"3": hotkey.Key3,
	"4": hotkey.Key4,
	"5": hotkey.Key5,
	"6": hotkey.Key6,
	"7": hotkey.Key7,
	"8": hotkey.Key8,
	"9": hotkey.Key9,
	"a": hotkey.KeyA,
	"b": hotkey.KeyB,
	"c": hotkey.KeyC,
	"d": hotkey.KeyD,
	"e": hotkey.KeyE,
	"f": hotkey.KeyF,
	"g": hotkey.KeyG,
	"h": hotkey.KeyH,
	"i": hotkey.KeyI,
	"j": hotkey.KeyJ,
	"k": hotkey.KeyK,
	"l": hotkey.KeyL,
	"m": hotkey.KeyM,
	"n": hotkey.KeyN,
	"o": hotkey.KeyO,
	"p": hotkey.KeyP,
	"q": hotkey.KeyQ,
	"r": hotkey.KeyR,
	"s": hotkey.KeyS,
	"t": hotkey.KeyT,
	"u": hotkey.KeyU,
	"v": hotkey.KeyV,
	"w": hotkey.KeyW,
	"x": hotkey.KeyX,
	"y": hotkey.KeyY,
	"z": hotkey.KeyZ,
}
