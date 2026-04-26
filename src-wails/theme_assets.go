package main

import (
	"bytes"
	_ "embed"
	"image"
	"image/color"
	"image/png"
	"math"
	"runtime"
	"strings"
	"sync"

	"cloudplayer/internal/cloudplayer/config"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed build/trayicon_template_macos.png
var macTrayTemplateIcon []byte

var appIconCache sync.Map

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
	fillRoundedRect(img, 24, 24, size-24, size-24, 108, accent)
	addGloss(img, accent)
	drawWaveform(img, color.NRGBA{R: 255, G: 255, B: 255, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil
	}
	return buf.Bytes()
}

func fillRoundedRect(img *image.NRGBA, x0, y0, x1, y1, radius int, c color.NRGBA) {
	r2 := radius * radius
	for y := y0; y < y1; y++ {
		for x := x0; x < x1; x++ {
			switch {
			case x >= x0+radius && x < x1-radius:
				img.SetNRGBA(x, y, c)
			case y >= y0+radius && y < y1-radius:
				img.SetNRGBA(x, y, c)
			default:
				cx := x0 + radius
				if x >= x1-radius {
					cx = x1 - radius - 1
				}
				cy := y0 + radius
				if y >= y1-radius {
					cy = y1 - radius - 1
				}
				dx := x - cx
				dy := y - cy
				if dx*dx+dy*dy <= r2 {
					img.SetNRGBA(x, y, c)
				}
			}
		}
	}
}

func addGloss(img *image.NRGBA, accent color.NRGBA) {
	highlight := color.NRGBA{R: 255, G: 255, B: 255, A: 36}
	fillRoundedRect(img, 56, 56, 456, 200, 72, highlight)
	shadow := color.NRGBA{R: 0, G: 0, B: 0, A: 18}
	fillRoundedRect(img, 56, 330, 456, 430, 72, shadow)
	_ = accent
}

func drawWaveform(img *image.NRGBA, c color.NRGBA) {
	points := [][2]float64{
		{84, 294},
		{146, 294},
		{186, 226},
		{236, 350},
		{286, 178},
		{336, 320},
		{392, 230},
		{430, 230},
	}
	for i := 0; i < len(points)-1; i++ {
		drawThickSegment(img, points[i][0], points[i][1], points[i+1][0], points[i+1][1], 22, c)
	}
	drawDot(img, 84, 294, 11, c)
	drawDot(img, 430, 230, 11, c)
}

func drawThickSegment(img *image.NRGBA, x0, y0, x1, y1 float64, radius float64, c color.NRGBA) {
	dx := x1 - x0
	dy := y1 - y0
	distance := math.Hypot(dx, dy)
	steps := int(distance / 4)
	if steps < 1 {
		steps = 1
	}
	for i := 0; i <= steps; i++ {
		t := float64(i) / float64(steps)
		drawDot(img, x0+dx*t, y0+dy*t, radius, c)
	}
}

func drawDot(img *image.NRGBA, cx, cy, radius float64, c color.NRGBA) {
	minX := int(cx - radius)
	maxX := int(cx + radius)
	minY := int(cy - radius)
	maxY := int(cy + radius)
	r2 := radius * radius
	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			if !image.Pt(x, y).In(img.Rect) {
				continue
			}
			dx := (float64(x) + 0.5) - cx
			dy := (float64(y) + 0.5) - cy
			if dx*dx+dy*dy <= r2 {
				img.SetNRGBA(x, y, c)
			}
		}
	}
}
