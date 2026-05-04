package lyrics

// Candidate/payload filters keep obvious non-lyrics placeholders out of the replacement flow.

import "strings"

func looksLikeUnavailableLyric(text string) bool {
	normalized := strings.ToLower(strings.TrimSpace(strings.ReplaceAll(text, "\r\n", "\n")))
	if normalized == "" {
		return true
	}
	for _, token := range []string{
		"酷狗音乐  就是歌多",
		"酷狗音乐 就是歌多",
		"纯音乐，请欣赏",
		"纯音乐，请赏析",
		"暂无歌词",
		"此歌曲为没有填词的纯音乐，请您欣赏",
		"inst.",
		"instrumental",
	} {
		if strings.Contains(normalized, strings.ToLower(token)) {
			return true
		}
	}
	return false
}
