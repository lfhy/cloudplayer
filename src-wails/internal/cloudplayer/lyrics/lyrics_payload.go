package lyrics

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

var lrcTimestampRE = regexp.MustCompile(`\[(\d+):(\d{1,2})(?:[\.,](\d{1,3}))?\]`)

// Payload helpers convert provider-specific lyric bodies into the shared frontend shape.
func looksLikeLRC(text string) bool {
	trimmed := strings.TrimLeft(text, " \t\r\n")
	return strings.HasPrefix(trimmed, "[") || lrcTimestampRE.MatchString(text)
}

func packLyricsForUI(raw string) string {
	return strings.TrimSpace(strings.ReplaceAll(raw, "\r\n", "\n"))
}

func lineOnlyPayload(raw string) LyricsPayload {
	if payload := tryParseEmbeddedWordLRC(raw); payload != nil {
		return *payload
	}
	return LyricsPayload{LRCText: packLyricsForUI(raw)}
}

func payloadFromWordLines(wordLines []WordLine) *LyricsPayload {
	if len(wordLines) == 0 {
		return nil
	}
	lines := make([]string, 0, len(wordLines))
	for _, line := range wordLines {
		var builder strings.Builder
		for _, word := range line.Words {
			builder.WriteString(word.Text)
		}
		lines = append(lines, formatLRCLineMS(line.StartMS, builder.String()))
	}
	return &LyricsPayload{LRCText: strings.Join(lines, "\n"), WordLines: wordLines}
}

func formatLRCLineMS(startMS uint64, text string) string {
	seconds := startMS / 1000
	msPart := startMS % 1000
	minutes := seconds / 60
	secs := seconds % 60
	return fmt.Sprintf("[%02d:%02d.%03d]%s", minutes, secs, msPart, text)
}

func firstLineLooksLikeYRCBracket(text string) bool {
	first := strings.TrimSpace(text)
	if first == "" {
		return false
	}
	first = strings.TrimSpace(strings.SplitN(first, "\n", 2)[0])
	if !strings.HasPrefix(first, "[") {
		return false
	}
	end := strings.Index(first, "]")
	if end <= 1 {
		return false
	}
	inside := first[1:end]
	if strings.Contains(inside, ":") {
		return false
	}
	return strings.Contains(inside, ",")
}

func lrcLineFromNeteaseLyricValue(root any) string {
	if value := strings.TrimSpace(stringValue(pointerValue(root, "/lrc/lyric"))); value != "" {
		return value
	}
	return strings.TrimSpace(stringValue(pointerValue(root, "/lrc")))
}

func yrcRawFromLyricNewJSON(root any) string {
	if result := yrcRawDepth(root, 0); result != "" {
		return result
	}
	return ""
}

func yrcRawDepth(root any, depth int) string {
	if depth > 4 {
		return ""
	}
	for _, path := range []string{
		"/yrc/lyric", "/Yrc/lyric", "/body/yrc/lyric", "/body/Yrc/lyric",
		"/data/yrc/lyric", "/data/Yrc/lyric", "/result/yrc/lyric", "/result/Yrc/lyric",
		"/result/data/yrc/lyric", "/data/result/yrc/lyric", "/body/data/yrc/lyric",
		"/body/result/yrc/lyric", "/data/data/yrc/lyric",
	} {
		if value := strings.TrimSpace(stringValue(pointerValue(root, path))); value != "" {
			return value
		}
	}
	for _, path := range []string{"/yrc", "/Yrc", "/body/yrc", "/body/Yrc", "/data/yrc", "/data/Yrc", "/result/yrc", "/result/Yrc"} {
		if value := yrcValueLike(pointerValue(root, path)); value != "" {
			return value
		}
	}
	for _, path := range []string{"/klyric/lyric", "/body/klyric/lyric", "/data/klyric/lyric", "/result/klyric/lyric"} {
		if value := strings.TrimSpace(stringValue(pointerValue(root, path))); firstLineLooksLikeYRCBracket(value) {
			return value
		}
	}
	for _, path := range []string{"/klyric", "/body/klyric", "/data/klyric", "/result/klyric"} {
		if value := yrcValueLike(pointerValue(root, path)); firstLineLooksLikeYRCBracket(value) {
			return value
		}
	}
	if inner := unwrapJSONStringChild(root); inner != nil {
		if value := yrcRawDepth(inner, depth+1); value != "" {
			return value
		}
	}
	if value := pointerValue(root, "/data/body"); value != nil {
		if inner := unwrapJSONStringChild(value); inner != nil {
			if result := yrcRawDepth(inner, depth+1); result != "" {
				return result
			}
		}
	}
	return ""
}

func yrcValueLike(node any) string {
	if node == nil {
		return ""
	}
	if value := strings.TrimSpace(stringValue(node)); value != "" {
		return value
	}
	if value := strings.TrimSpace(stringValue(pointerValue(node, "/lyric"))); value != "" {
		return value
	}
	return ""
}

func unwrapJSONStringChild(root any) any {
	for _, path := range []string{"/body", "/data", "/result", "/payload"} {
		value := pointerValue(root, path)
		text, ok := value.(string)
		if !ok {
			continue
		}
		trimmed := strings.TrimSpace(text)
		if trimmed == "" || (!strings.HasPrefix(trimmed, "{") && !strings.HasPrefix(trimmed, "[")) {
			continue
		}
		var inner any
		if err := json.Unmarshal([]byte(trimmed), &inner); err == nil {
			return inner
		}
	}
	return nil
}
