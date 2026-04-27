package lyrics

import (
	"regexp"
	"strings"
)

var (
	qrcLyric1RE         = regexp.MustCompile(`<Lyric_1\s+LyricType="1"\s+LyricContent="(?s)(?P<c>.*?)"\s*/>`)
	lineMSPairRE        = regexp.MustCompile(`^\[(\d+),(\d+)\](.*)$`)
	qrcWordTSRE         = regexp.MustCompile(`\((\d+),(\d+)\)`)
	yrcWordTSRE         = regexp.MustCompile(`\((\d+),(\d+),(\d+)\)`)
	wordOnlyLineRE      = regexp.MustCompile(`^\((\d+),(\d+)\)$`)
	allLyricContentAttr = regexp.MustCompile(`(?is)LyricContent\s*=\s*"([^"]*)"`)
)

func extractAllLyricContentAttrs(xml string) []string {
	matches := allLyricContentAttr.FindAllStringSubmatch(xml, -1)
	out := make([]string, 0, len(matches))
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		value := strings.TrimSpace(unescapeQRCAttr(match[1]))
		if value != "" {
			out = append(out, value)
		}
	}
	return out
}

func unescapeQRCAttr(value string) string {
	return strings.NewReplacer(
		"&quot;", `"`,
		"&#10;", "\n",
		"&#13;", "\r",
		"&lt;", "<",
		"&gt;", ">",
		"&amp;", "&",
	).Replace(value)
}

func qrcLineToWords(lineContent string, lineStart, lineEnd uint64) []WordTiming {
	matches := qrcWordTSRE.FindAllStringSubmatchIndex(lineContent, -1)
	if len(matches) == 0 {
		text := lineContent
		if strings.TrimSpace(text) == "" {
			return nil
		}
		return []WordTiming{{StartMS: lineStart, EndMS: lineEnd, Text: text}}
	}

	words := make([]WordTiming, 0, len(matches))
	prev := 0
	for _, match := range matches {
		text := lineContent[prev:match[0]]
		groups := qrcWordTSRE.FindStringSubmatch(lineContent[match[0]:match[1]])
		if len(groups) < 3 {
			prev = match[1]
			continue
		}
		startMS, _ := strconvParseUint(groups[1])
		durationMS, _ := strconvParseUint(groups[2])
		if text != "\r" {
			words = append(words, WordTiming{StartMS: startMS, EndMS: startMS + durationMS, Text: text})
		}
		prev = match[1]
	}
	if len(words) == 0 && strings.TrimSpace(lineContent) != "" {
		words = append(words, WordTiming{StartMS: lineStart, EndMS: lineEnd, Text: lineContent})
	}
	return words
}

func yrcLineToWords(lineContent string, lineStart, lineEnd uint64) []WordTiming {
	matches := yrcWordTSRE.FindAllStringSubmatchIndex(lineContent, -1)
	if len(matches) == 0 {
		text := lineContent
		if strings.TrimSpace(text) == "" {
			return nil
		}
		return []WordTiming{{StartMS: lineStart, EndMS: lineEnd, Text: text}}
	}

	words := make([]WordTiming, 0, len(matches))
	for i, match := range matches {
		groups := yrcWordTSRE.FindStringSubmatch(lineContent[match[0]:match[1]])
		if len(groups) < 3 {
			continue
		}
		startMS, _ := strconvParseUint(groups[1])
		durationMS, _ := strconvParseUint(groups[2])
		textEnd := len(lineContent)
		if i+1 < len(matches) {
			textEnd = matches[i+1][0]
		}
		words = append(words, WordTiming{
			StartMS: startMS,
			EndMS:   startMS + durationMS,
			Text:    lineContent[match[1]:textEnd],
		})
	}
	return words
}

func tryParseQRCInnerBodyPub(value string) *LyricsPayload {
	return parseQRCInnerBody(value)
}

func parseQRCInnerBody(inner string) *LyricsPayload {
	wordLines := make([]WordLine, 0)
	anyMatched := false
	for _, rawLine := range strings.Split(strings.ReplaceAll(inner, "\r\n", "\n"), "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}
		groups := lineMSPairRE.FindStringSubmatch(line)
		if len(groups) < 4 {
			continue
		}
		lineStart, errStart := strconvParseUint(groups[1])
		lineDur, errDur := strconvParseUint(groups[2])
		if errStart != nil || errDur != nil {
			continue
		}
		lineContent := groups[3]
		lineEnd := lineStart + lineDur
		anyMatched = true
		if wordOnlyLineRE.MatchString(strings.TrimSpace(lineContent)) {
			wordLines = append(wordLines, WordLine{StartMS: lineStart, EndMS: lineEnd, Words: []WordTiming{}})
			continue
		}
		words := qrcLineToWords(lineContent, lineStart, lineEnd)
		if len(words) == 0 {
			continue
		}
		wordLines = append(wordLines, WordLine{StartMS: lineStart, EndMS: lineEnd, Words: words})
	}
	if !anyMatched {
		return nil
	}
	return payloadFromWordLines(wordLines)
}

func parseYRCBody(text string) *LyricsPayload {
	wordLines := make([]WordLine, 0)
	anyMatched := false
	for _, rawLine := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" || !strings.HasPrefix(line, "[") {
			continue
		}
		groups := lineMSPairRE.FindStringSubmatch(line)
		if len(groups) < 4 {
			continue
		}
		lineStart, errStart := strconvParseUint(groups[1])
		lineDur, errDur := strconvParseUint(groups[2])
		if errStart != nil || errDur != nil {
			continue
		}
		lineEnd := lineStart + lineDur
		anyMatched = true
		words := yrcLineToWords(groups[3], lineStart, lineEnd)
		if len(words) == 0 {
			continue
		}
		wordLines = append(wordLines, WordLine{StartMS: lineStart, EndMS: lineEnd, Words: words})
	}
	if !anyMatched {
		return nil
	}
	return payloadFromWordLines(wordLines)
}

func tryParseLyricContentBody(value string) *LyricsPayload {
	if value == "" {
		return nil
	}
	if payload := parseQRCInnerBody(value); payload != nil {
		return payload
	}
	if payload := parseYRCBody(value); payload != nil {
		return payload
	}
	if payload := tryParseEmbeddedWordLRC(value); payload != nil {
		return payload
	}
	return nil
}

func tryLDDCQQLyricsPlain(value string) *LyricsPayload {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	if strings.Contains(trimmed, "LyricContent") {
		attrs := extractAllLyricContentAttrs(trimmed)
		var lineOnlyFallback *LyricsPayload
		for _, inner := range attrs {
			payload := tryParseLyricContentBody(inner)
			if payload == nil {
				continue
			}
			if len(payload.WordLines) > 0 {
				return payload
			}
			if lineOnlyFallback == nil {
				lineOnlyFallback = payload
			}
		}
		if lineOnlyFallback != nil {
			return lineOnlyFallback
		}
	}

	if strings.Contains(trimmed, "Lyric_1") && strings.Contains(trimmed, "LyricContent") {
		if groups := qrcLyric1RE.FindStringSubmatch(trimmed); len(groups) >= 2 {
			if payload := parseQRCInnerBody(strings.TrimSpace(unescapeQRCAttr(groups[1]))); payload != nil {
				return payload
			}
		}
	}

	looksLikeMillisecondBracket := false
	for _, line := range strings.Split(trimmed, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "[") {
			continue
		}
		header := strings.SplitN(strings.TrimPrefix(line, "["), "]", 2)[0]
		if strings.Contains(header, ",") && !strings.Contains(header, ":") {
			looksLikeMillisecondBracket = true
			break
		}
	}
	if looksLikeMillisecondBracket {
		if payload := parseYRCBody(trimmed); payload != nil {
			return payload
		}
		if payload := parseQRCInnerBody(trimmed); payload != nil {
			return payload
		}
	}

	if payload := tryParseEmbeddedWordLRC(trimmed); payload != nil {
		return payload
	}
	return nil
}
