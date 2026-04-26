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

func drawGradientRoundedRect(img *image.NRGBA, x0, y0, x1, y1, radius int, topLeft, bottomRight color.NRGBA) {
	r2 := radius * radius
	width := float64(maxInt(x1-x0, 1))
	height := float64(maxInt(y1-y0, 1))
	for y := y0; y < y1; y++ {
		for x := x0; x < x1; x++ {
			if !pointInsideRoundedRect(x, y, x0, y0, x1, y1, radius, r2) {
				continue
			}
			tx := float64(x-x0) / width
			ty := float64(y-y0) / height
			t := (tx + ty) / 2
			img.SetNRGBA(x, y, lerpColor(topLeft, bottomRight, t))
		}
	}
}

func pointInsideRoundedRect(x, y, x0, y0, x1, y1, radius, r2 int) bool {
	switch {
	case x >= x0+radius && x < x1-radius:
		return true
	case y >= y0+radius && y < y1-radius:
		return true
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
		return dx*dx+dy*dy <= r2
	}
}

func drawEqualizerGlyph(img *image.NRGBA, c color.NRGBA) {
	bars := []struct {
		x      int
		y      int
		width  int
		height int
	}{
		{86, 248, 22, 36},
		{126, 224, 22, 84},
		{166, 194, 22, 144},
		{206, 162, 22, 204},
		{246, 130, 22, 264},
		{286, 162, 22, 204},
		{326, 194, 22, 144},
		{366, 224, 22, 84},
		{406, 248, 22, 36},
	}
	for _, bar := range bars {
		fillRoundedRect(img, bar.x, bar.y, bar.x+bar.width, bar.y+bar.height, bar.width/2, c)
	}
	fillRoundedRect(img, 78, 244, 434, 262, 9, color.NRGBA{R: 255, G: 255, B: 255, A: 242})
}

func blendOver(dst *image.NRGBA, x, y int, src color.NRGBA) {
	if !image.Pt(x, y).In(dst.Rect) {
		return
	}
	dstColor := dst.NRGBAAt(x, y)
	sa := float64(src.A) / 255
	da := float64(dstColor.A) / 255
	outA := sa + da*(1-sa)
	if outA <= 0 {
		dst.SetNRGBA(x, y, color.NRGBA{})
		return
	}
	blend := func(sc, dc uint8) uint8 {
		value := (float64(sc)*sa + float64(dc)*da*(1-sa)) / outA
		return uint8(math.Round(value))
	}
	dst.SetNRGBA(x, y, color.NRGBA{
		R: blend(src.R, dstColor.R),
		G: blend(src.G, dstColor.G),
		B: blend(src.B, dstColor.B),
		A: uint8(math.Round(outA * 255)),
	})
}

func lightenColor(c color.NRGBA, amount float64) color.NRGBA {
	return color.NRGBA{
		R: uint8(math.Round(float64(c.R) + (255-float64(c.R))*amount)),
		G: uint8(math.Round(float64(c.G) + (255-float64(c.G))*amount)),
		B: uint8(math.Round(float64(c.B) + (255-float64(c.B))*amount)),
		A: c.A,
	}
}

func darkenColor(c color.NRGBA, amount float64) color.NRGBA {
	return color.NRGBA{
		R: uint8(math.Round(float64(c.R) * (1 - amount))),
		G: uint8(math.Round(float64(c.G) * (1 - amount))),
		B: uint8(math.Round(float64(c.B) * (1 - amount))),
		A: c.A,
	}
}

func lerpColor(a, b color.NRGBA, t float64) color.NRGBA {
	return color.NRGBA{
		R: uint8(math.Round(float64(a.R) + (float64(b.R)-float64(a.R))*t)),
		G: uint8(math.Round(float64(a.G) + (float64(b.G)-float64(a.G))*t)),
		B: uint8(math.Round(float64(a.B) + (float64(b.B)-float64(a.B))*t)),
		A: uint8(math.Round(float64(a.A) + (float64(b.A)-float64(a.A))*t)),
	}
}
