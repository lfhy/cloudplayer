package pjmp3

import (
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// Small parsing helpers stay together so DOM heuristics can be tuned without touching fetch code.
func parseLegacyRowText(tr *goquery.Selection, songID, title string) (string, string) {
	var artist string
	var album string
	cells := make([]*goquery.Selection, 0, tr.Find("td").Length())
	tr.Find("td").Each(func(_ int, td *goquery.Selection) {
		cells = append(cells, td)
	})
	needle := "song.php?id=" + songID
	needleLower := strings.ToLower(needle)
	anchorIndex := -1
	for index, cell := range cells {
		html, err := cell.Html()
		if err != nil {
			continue
		}
		if strings.Contains(strings.ToLower(html), needleLower) {
			anchorIndex = index
			break
		}
	}
	if anchorIndex < 0 {
		return artist, album
	}
	if anchorIndex+1 < len(cells) {
		artist = strings.TrimSpace(cells[anchorIndex+1].Text())
	}
	if anchorIndex+2 < len(cells) {
		album = strings.TrimSpace(cells[anchorIndex+2].Text())
	}
	textsAfter := make([]string, 0, len(cells))
	for _, cell := range cells[anchorIndex+1:] {
		text := strings.TrimSpace(cell.Text())
		if text == "" || allDigits(text) || text == title {
			continue
		}
		textsAfter = append(textsAfter, text)
	}
	if artist == "" && len(textsAfter) > 0 {
		artist = textsAfter[0]
	}
	if album == "" && len(textsAfter) >= 2 {
		album = textsAfter[1]
	}
	if album == "" && len(textsAfter) >= 3 {
		album = textsAfter[2]
	}
	return artist, album
}

func parseLegacyRowCover(tr *goquery.Selection) *string {
	var bestCover *string
	tr.Find("img").Each(func(_ int, image *goquery.Selection) {
		coverURL := pickNormalizedImage(image, "src", "data-src", "data-original", "data-lazy-src")
		if coverURL == nil {
			return
		}
		lower := strings.ToLower(*coverURL)
		if strings.Contains(lower, "blank") || strings.Contains(lower, "spacer") {
			return
		}
		if bestCover == nil {
			bestCover = coverURL
		}
		if strings.Contains(lower, "albumcover") || strings.Contains(lower, "/cover") || strings.Contains(lower, "pic") {
			bestCover = coverURL
		}
	})
	return bestCover
}

func normalizeLegacyTitleArtist(title, artist string) (string, string) {
	if artist == "" {
		for _, sep := range []string{" - ", " – ", " — ", " · ", " / ", "|", "／"} {
			if index := strings.Index(title, sep); index >= 0 {
				left := strings.TrimSpace(title[:index])
				right := strings.TrimSpace(title[index+len(sep):])
				if left != "" && right != "" {
					return left, right
				}
			}
		}
	}
	if artist == "" && containsCJK(title) {
		compact := strings.Join(strings.Fields(title), " ")
		if parts := strings.Fields(compact); len(parts) >= 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(strings.Join(parts[1:], " "))
			if left != "" && right != "" && len(left) <= 64 {
				return left, right
			}
		}
	}
	if artist == "" {
		if newTitle, newArtist, ok := splitTitleSpeedSuffix(title); ok {
			return newTitle, newArtist
		}
	}
	if artist == "" {
		if newTitle, newArtist, ok := splitGluedPureCJK(title); ok {
			return newTitle, newArtist
		}
	}
	return title, artist
}

func splitTitleSpeedSuffix(title string) (string, string, bool) {
	match := reSpeedSuffix.FindStringSubmatch(strings.TrimSpace(title))
	if len(match) < 3 {
		return "", "", false
	}
	left := strings.TrimSpace(match[1])
	right := strings.TrimSpace(match[2])
	if left == "" || right == "" {
		return "", "", false
	}
	return left, right, true
}

func splitGluedPureCJK(title string) (string, string, bool) {
	compact := strings.Map(func(r rune) rune {
		if r == ' ' || r == '\t' || r == '\n' || r == '\r' {
			return -1
		}
		return r
	}, title)
	length := len([]rune(compact))
	if length < 5 || length > 14 {
		return "", "", false
	}
	for _, r := range compact {
		if r < '\u4e00' || r > '\u9fff' {
			return "", "", false
		}
	}
	cut := length / 2
	if length%2 == 1 {
		cut = (length - 1) / 2
	}
	runes := []rune(compact)
	if cut < 2 || len(runes)-cut < 2 {
		return "", "", false
	}
	return string(runes[:cut]), string(runes[cut:]), true
}

func pickNormalizedImage(selection *goquery.Selection, attrs ...string) *string {
	if selection == nil || selection.Length() == 0 {
		return nil
	}
	for _, attr := range attrs {
		value, ok := selection.Attr(attr)
		if !ok {
			continue
		}
		if normalized := NormalizeImageURL(&value); normalized != nil {
			return normalized
		}
	}
	return nil
}

func dedupeStrings(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	result := make([]string, 0, len(items))
	for _, item := range items {
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result
}

func allDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func containsCJK(value string) bool {
	for _, r := range value {
		if r >= '\u4e00' && r <= '\u9fff' {
			return true
		}
	}
	return false
}

func onlyDigits(value string) string {
	var builder strings.Builder
	for _, r := range value {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func parseInt64(value string) int64 {
	var result int64
	for _, r := range value {
		if r < '0' || r > '9' {
			return 0
		}
		result = result*10 + int64(r-'0')
	}
	return result
}

func parseUint32(value string) uint32 {
	var result uint32
	for _, r := range value {
		if r < '0' || r > '9' {
			return 0
		}
		result = result*10 + uint32(r-'0')
	}
	return result
}

func maxUint32(value, minValue uint32) uint32 {
	if value < minValue {
		return minValue
	}
	return value
}
