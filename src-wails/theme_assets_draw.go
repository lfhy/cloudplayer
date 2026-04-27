package main

import (
	"image"
	"image/color"
	"math"
)

// Drawing helpers keep icon rasterization logic out of the higher-level theme asset entrypoints.
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
