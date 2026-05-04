package lyrics

import (
	"regexp"
	"strings"
)

var (
	krcLineRE = regexp.MustCompile(`(?m)^\[(\d+),(\d+)\](.*)$`)
	krcWordRE = regexp.MustCompile(`<((\d+),(\d+),\d+)>`)
)

// KRC payload parsing keeps the timed-word reconstruction isolated from network fetch code.
func krcPlainToPayload(value string) (LyricsPayload, error) {
	wordLines := make([]WordLine, 0)
	for _, line := range strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n") {
		groups := krcLineRE.FindStringSubmatch(line)
		if len(groups) < 4 {
			continue
		}
		lineStart, errStart := strconvParseUint(groups[1])
		lineDur, errDur := strconvParseUint(groups[2])
		if errStart != nil || errDur != nil {
			continue
		}
		lineEnd := lineStart + lineDur
		rest := strings.TrimRight(groups[3], "\r")
		matches := krcWordRE.FindAllStringSubmatchIndex(rest, -1)
		if len(matches) == 0 {
			text := strings.TrimSpace(rest)
			if text == "" {
				continue
			}
			wordLines = append(wordLines, WordLine{
				StartMS: lineStart,
				EndMS:   lineEnd,
				Words:   []WordTiming{{StartMS: lineStart, EndMS: lineEnd, Text: text}},
			})
			continue
		}
		words := make([]WordTiming, 0, len(matches))
		for index, match := range matches {
			groups := krcWordRE.FindStringSubmatch(rest[match[0]:match[1]])
			if len(groups) < 4 {
				continue
			}
			offsetMS, _ := strconvParseUint(groups[2])
			durationMS, _ := strconvParseUint(groups[3])
			textStart := match[1]
			textEnd := len(rest)
			if index+1 < len(matches) {
				textEnd = matches[index+1][0]
			}
			text := rest[textStart:textEnd]
			words = append(words, WordTiming{
				StartMS: lineStart + offsetMS,
				EndMS:   lineStart + offsetMS + durationMS,
				Text:    text,
			})
		}
		if len(words) == 0 {
			continue
		}
		wordLines = append(wordLines, WordLine{StartMS: lineStart, EndMS: lineEnd, Words: words})
	}
	if payload := payloadFromWordLines(wordLines); payload != nil {
		return *payload, nil
	}
	return lineOnlyPayload(value), nil
}
