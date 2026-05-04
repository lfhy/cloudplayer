package main

import (
	"bytes"
	_ "embed"
	"image"
	"image/color"
	"image/png"
	"runtime"
	"strings"
	"sync"

	"cloudplayer/internal/cloudplayer/config"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed build/trayicon_template_macos.png
var macTrayTemplateIcon []byte

// Theme icon caches let the dock icon follow the selected accent without rerendering every time.
var appIconCache sync.Map
var templateIconOnce sync.Once
var templateIcon image.Image

var presetThemeAccents = map[string]string{
	"coral":   "#c62f2f",
	"ocean":   "#1f6aa5",
	"forest":  "#2f7d4b",
	"netease": "#d43c33",
	"kugou":   "#1977ff",
	"qqmusic": "#31c27c",
}

func appIconForTheme(theme, customAccent string) []byte {
	normalizedTheme := config.NormalizeAppTheme(theme)
	accent := accentHexForTheme(normalizedTheme, customAccent)
	cacheKey := normalizedTheme + "|" + accent
	if cached, ok := appIconCache.Load(cacheKey); ok {
		return cached.([]byte)
	}
	icon := renderRuntimeAppIcon(accent)
	if len(icon) > 0 {
		appIconCache.Store(cacheKey, icon)
	}
	return icon
}

func applyThemeAssets(state *AppState, theme, customAccent string) {
	normalizedTheme := config.NormalizeAppTheme(theme)
	normalizedAccent := normalizeAccentHex(customAccent, presetThemeAccents["coral"])
	if state != nil {
		state.AppTheme = normalizedTheme
		state.AppThemeCustomAccent = normalizedAccent
	}
	if app := application.Get(); app != nil {
		if icon := appIconForTheme(normalizedTheme, normalizedAccent); len(icon) > 0 {
			app.SetIcon(icon)
		}
	}
	if state != nil && state.SystemTray != nil && runtime.GOOS == "darwin" && len(macTrayTemplateIcon) > 0 {
		state.SystemTray.SetTemplateIcon(macTrayTemplateIcon)
	}
}

func accentHexForTheme(theme, customAccent string) string {
	normalizedTheme := config.NormalizeAppTheme(theme)
	if normalizedTheme == "custom" {
		return normalizeAccentHex(customAccent, presetThemeAccents["coral"])
	}
	if accent, ok := presetThemeAccents[normalizedTheme]; ok {
		return accent
	}
	return presetThemeAccents["coral"]
}

func normalizeAccentHex(value, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) == 7 && trimmed[0] == '#' {
		valid := true
		for _, r := range trimmed[1:] {
			if (r < '0' || r > '9') && (r < 'a' || r > 'f') && (r < 'A' || r > 'F') {
				valid = false
				break
			}
		}
		if valid {
			return strings.ToLower(trimmed)
		}
	}
	if fallback == "" {
		return "#c62f2f"
	}
	return strings.ToLower(fallback)
}

func parseAccentHex(value string) color.NRGBA {
	hex := normalizeAccentHex(value, "#c62f2f")
	return color.NRGBA{
		R: hexByte(hex[1], hex[2]),
		G: hexByte(hex[3], hex[4]),
		B: hexByte(hex[5], hex[6]),
		A: 0xff,
	}
}

func hexByte(hi, lo byte) uint8 {
	return fromHexNibble(hi)<<4 | fromHexNibble(lo)
}

func fromHexNibble(value byte) uint8 {
	switch {
	case value >= '0' && value <= '9':
		return value - '0'
	case value >= 'a' && value <= 'f':
		return value - 'a' + 10
	case value >= 'A' && value <= 'F':
		return value - 'A' + 10
	default:
		return 0
	}
}

func renderRuntimeAppIcon(accentHex string) []byte {
	const size = 512
	img := image.NewNRGBA(image.Rect(0, 0, size, size))
	accent := parseAccentHex(accentHex)
	drawGradientRoundedRect(img, 34, 34, size-34, size-34, 112, accent, darkenColor(accent, 0.08))
	if !drawTemplateForeground(img, color.NRGBA{R: 255, G: 255, B: 255, A: 255}) {
		drawEqualizerGlyph(img, color.NRGBA{R: 255, G: 255, B: 255, A: 255})
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil
	}
	return buf.Bytes()
}

func drawTemplateForeground(dst *image.NRGBA, tint color.NRGBA) bool {
	src := loadTemplateIcon()
	if src == nil {
		return false
	}
	srcBounds := src.Bounds()
	if srcBounds.Empty() {
		return false
	}
	const inset = 76
	destRect := image.Rect(inset, inset, dst.Bounds().Dx()-inset, dst.Bounds().Dy()-inset)
	destWidth := destRect.Dx()
	destHeight := destRect.Dy()
	srcWidth := srcBounds.Dx()
	srcHeight := srcBounds.Dy()
	for y := 0; y < destHeight; y++ {
		sy := srcBounds.Min.Y + y*srcHeight/destHeight
		for x := 0; x < destWidth; x++ {
			sx := srcBounds.Min.X + x*srcWidth/destWidth
			_, _, _, a16 := src.At(sx, sy).RGBA()
			if a16 == 0 {
				continue
			}
			alpha := uint8(a16 >> 8)
			blendOver(dst, destRect.Min.X+x, destRect.Min.Y+y, color.NRGBA{
				R: tint.R,
				G: tint.G,
				B: tint.B,
				A: alpha,
			})
		}
	}
	return true
}

func loadTemplateIcon() image.Image {
	templateIconOnce.Do(func() {
		icon, err := png.Decode(bytes.NewReader(macTrayTemplateIcon))
		if err == nil {
			templateIcon = icon
		}
	})
	return templateIcon
}
