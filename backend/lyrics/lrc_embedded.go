package lyrics

import (
	"regexp"
	"strconv"
	"strings"
)

// Embedded LRC parsing upgrades inline word-timed text into the shared LyricsPayload shape.
var embeddedLRCTimestampRE = regexp.MustCompile(`\[(\d+):(\d{1,2})(?:[\.,](\d{1,3}))?\]`)

func embeddedCapToMS(match []string) uint64 {
	minutes, _ := strconvParseUint(match[1])
	seconds, _ := strconvParseUint(match[2])
	fracMS := uint64(0)
	if len(match) >= 4 && match[3] != "" {
		frac := match[3]
		for len(frac) < 3 {
			frac += "0"
		}
		if len(frac) > 3 {
			frac = frac[:3]
		}
		fracMS, _ = strconvParseUint(frac)
	}
	return minutes*60_000 + seconds*1_000 + fracMS
}

func tryParseEmbeddedWordLRC(raw string) *LyricsPayload {
	lines := strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n")
	wordLines := make([]WordLine, 0, len(lines))
	simpleLRCLines := make([]string, 0, len(lines))
	sawEmbedded := false

	for lineIndex, line := range lines {
		line = strings.TrimRight(line, "\r")
		if strings.TrimSpace(line) == "" {
			continue
		}
		matches := embeddedLRCTimestampRE.FindAllStringSubmatchIndex(line, -1)
		if len(matches) == 0 {
			continue
		}

		if len(matches) >= 2 {
			sawEmbedded = true
			words := make([]WordTiming, 0, len(matches))
			for i := 0; i < len(matches); i++ {
				match := matches[i]
				groups := embeddedLRCTimestampRE.FindStringSubmatch(line[match[0]:match[1]])
				if len(groups) == 0 {
					continue
				}
				startMS := embeddedCapToMS(groups)
				textStart := match[1]
				textEnd := len(line)
				if i+1 < len(matches) {
					textEnd = matches[i+1][0]
				}
				text := line[textStart:textEnd]
				endMS := startMS + 1500
				if i+1 < len(matches) {
					nextGroups := embeddedLRCTimestampRE.FindStringSubmatch(line[matches[i+1][0]:matches[i+1][1]])
					if len(nextGroups) > 0 {
						endMS = embeddedCapToMS(nextGroups)
					}
				} else if nextLineMS := nextLineFirstStartMS(lines, lineIndex+1); nextLineMS > 0 {
					endMS = nextLineMS
				}
				if text == "" && i+1 < len(matches) {
					continue
				}
				if endMS < startMS {
					continue
				}
				words = append(words, WordTiming{StartMS: startMS, EndMS: endMS, Text: text})
			}
			if len(words) == 0 {
				continue
			}
			lineStart := words[0].StartMS
			lineEnd := words[len(words)-1].EndMS
			var display strings.Builder
			for _, word := range words {
				display.WriteString(word.Text)
			}
			simpleLRCLines = append(simpleLRCLines, formatLRCLineMS(lineStart, display.String()))
			wordLines = append(wordLines, WordLine{StartMS: lineStart, EndMS: lineEnd, Words: words})
			continue
		}

		match := matches[0]
		groups := embeddedLRCTimestampRE.FindStringSubmatch(line[match[0]:match[1]])
		if len(groups) == 0 {
			continue
		}
		startMS := embeddedCapToMS(groups)
		text := strings.TrimRight(line[match[1]:], " ")
		endMS := nextLineFirstStartMS(lines, lineIndex+1)
		if endMS == 0 {
			endMS = startMS + 5_000
		}
		simpleLRCLines = append(simpleLRCLines, formatLRCLineMS(startMS, text))
		wordLines = append(wordLines, WordLine{
			StartMS: startMS,
			EndMS:   endMS,
			Words: []WordTiming{{
				StartMS: startMS,
				EndMS:   endMS,
				Text:    text,
			}},
		})
	}

	if !sawEmbedded || len(wordLines) == 0 {
		return nil
	}
	return &LyricsPayload{
		LRCText:   strings.Join(simpleLRCLines, "\n"),
		WordLines: wordLines,
	}
}

func nextLineFirstStartMS(lines []string, from int) uint64 {
	for idx := from; idx < len(lines); idx++ {
		line := strings.TrimRight(lines[idx], "\r")
		if strings.TrimSpace(line) == "" {
			continue
		}
		match := embeddedLRCTimestampRE.FindStringSubmatch(line)
		if len(match) > 0 {
			return embeddedCapToMS(match)
		}
	}
	return 0
}

func strconvParseUint(value string) (uint64, error) {
	parsed, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
	if err != nil {
		return 0, err
	}
	return parsed, nil
}
