package musicsource

import (
	"fmt"
	"strings"
)

// Generic map helpers keep Kugou payload parsing local and resilient to response shape drift.
func kugouFindSongItems(root any) []map[string]any {
	var out []map[string]any
	var walk func(any)
	walk = func(value any) {
		switch typed := value.(type) {
		case []any:
			for _, item := range typed {
				walk(item)
			}
		case map[string]any:
			if kugouLooksLikeSong(typed) {
				out = append(out, typed)
			}
			for _, item := range typed {
				walk(item)
			}
		}
	}
	walk(root)
	return out
}

func kugouLooksLikeSong(item map[string]any) bool {
	return kugouPickString(item, "hash", "audio_hash", "file_hash", "hash_128") != "" &&
		kugouPickString(item, "songname", "song_name", "filename", "name", "audio_name") != ""
}

func kugouPickString(item map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := item[key]; ok {
			text := strings.TrimSpace(fmt.Sprintf("%v", value))
			if text != "" && text != "<nil>" {
				return text
			}
		}
	}
	return ""
}

func kugouPickInt(item map[string]any, keys ...string) int {
	for _, key := range keys {
		value, ok := item[key]
		if !ok {
			continue
		}
		text := strings.TrimSpace(fmt.Sprintf("%v", value))
		if text == "" || text == "<nil>" {
			continue
		}
		var parsed int
		if _, err := fmt.Sscanf(text, "%d", &parsed); err == nil && parsed > 0 {
			return parsed
		}
	}
	return 0
}

func kugouCoverURL(item map[string]any) *string {
	for _, key := range []string{"img", "image", "cover", "cover_url", "sizable_cover"} {
		value := strings.TrimSpace(kugouPickString(item, key))
		if value == "" {
			continue
		}
		value = strings.ReplaceAll(value, "{size}", "240")
		value = strings.ReplaceAll(value, "/{size}/", "/240/")
		value = strings.ReplaceAll(value, "{w}", "240")
		value = strings.ReplaceAll(value, "{h}", "240")
		if strings.HasPrefix(value, "//") {
			value = "https:" + value
		}
		return &value
	}
	return nil
}
