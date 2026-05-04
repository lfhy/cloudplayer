package captcha

import (
	"bytes"
	"encoding/base64"
	_ "golang.org/x/image/webp"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"strings"
)

const minConfidence = 0.25

// Captcha rendering keeps QR-code overlays and image composition logic together.

type edgeImage struct {
	width  int
	height int
	values []float64
	mask   []float64
}

func GuessSliderOffset(backgroundB64, sliderB64 string) (int, bool) {
	background, ok := decodeImageB64(backgroundB64)
	if !ok {
		return 0, false
	}
	slider, ok := decodeImageB64(sliderB64)
	if !ok {
		return 0, false
	}

	bg := makeEdgeImage(background, false)
	fg := makeEdgeImage(slider, true)
	if bg.width < fg.width+8 || bg.height < fg.height+2 {
		return 0, false
	}

	var templateEnergy float64
	var activeMask float64
	for index, value := range fg.values {
		weight := fg.mask[index]
		if weight <= 0 {
			continue
		}
		activeMask += weight
		templateEnergy += value * value * weight
	}
	if templateEnergy == 0 || activeMask < float64(fg.width*fg.height)/12 {
		return 0, false
	}

	bestScore := -1.0
	bestX := 0
	for y := 0; y <= bg.height-fg.height; y++ {
		for x := 0; x <= bg.width-fg.width; x++ {
			var numerator float64
			var backgroundEnergy float64
			for sy := 0; sy < fg.height; sy++ {
				bgRow := (y+sy)*bg.width + x
				fgRow := sy * fg.width
				for sx := 0; sx < fg.width; sx++ {
					weight := fg.mask[fgRow+sx]
					if weight <= 0 {
						continue
					}
					bgValue := bg.values[bgRow+sx]
					fgValue := fg.values[fgRow+sx]
					numerator += bgValue * fgValue * weight
					backgroundEnergy += bgValue * bgValue * weight
				}
			}
			if backgroundEnergy == 0 {
				continue
			}
			score := numerator / math.Sqrt(backgroundEnergy*templateEnergy)
			if score > bestScore {
				bestScore = score
				bestX = x
			}
		}
	}
	if !isFinite(bestScore) || bestScore < minConfidence {
		return 0, false
	}
	return bestX, true
}

func decodeImageB64(value string) (image.Image, bool) {
	raw := strings.TrimSpace(value)
	if index := strings.Index(raw, ","); index >= 0 && strings.Contains(strings.ToLower(raw[:index]), "base64") {
		raw = strings.TrimSpace(raw[index+1:])
	}
	decoded, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, false
	}
	imageValue, _, err := image.Decode(bytes.NewReader(decoded))
	if err != nil {
		return nil, false
	}
	return imageValue, true
}

func makeEdgeImage(source image.Image, withMask bool) edgeImage {
	bounds := source.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	gray := make([]float64, width*height)
	mask := make([]float64, width*height)

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r16, g16, b16, a16 := source.At(bounds.Min.X+x, bounds.Min.Y+y).RGBA()
			r := float64(r16) / 257.0
			g := float64(g16) / 257.0
			b := float64(b16) / 257.0
			alpha := float64(a16) / 65535.0
			index := y*width + x
			gray[index] = 0.299*r + 0.587*g + 0.114*b
			if withMask && alpha < 0.05 {
				mask[index] = 0
			} else if withMask {
				mask[index] = alpha
			} else {
				mask[index] = 1
			}
		}
	}

	edges := make([]float64, width*height)
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			index := y*width + x
			center := gray[index]
			right := center
			down := center
			if x+1 < width {
				right = gray[index+1]
			}
			if y+1 < height {
				down = gray[index+width]
			}
			value := math.Abs(center-right) + math.Abs(center-down)
			edges[index] = value
		}
	}
	return edgeImage{width: width, height: height, values: edges, mask: mask}
}

func isFinite(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}
