package main

import (
	"fmt"
	"strings"
)

// Kugou payload walkers stay backend-local so SDK response shape changes do not leak into the service surface.
func kugouFindPlaylistItems(root any) []map[string]any {
	var out []map[string]any
	var walk func(any)
	walk = func(value any) {
		switch typed := value.(type) {
		case []any:
			for _, item := range typed {
				walk(item)
			}
		case map[string]any:
			if kugouMapInt(typed, "listid", "list_id", "id") > 0 && kugouMapString(typed, "listname", "list_name", "name", "title") != "" {
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

func kugouFindTrackItems(root any) []map[string]any {
	var out []map[string]any
	var walk func(any)
	walk = func(value any) {
		switch typed := value.(type) {
		case []any:
			for _, item := range typed {
				walk(item)
			}
		case map[string]any:
			if kugouMapString(typed, "hash", "audio_hash", "file_hash", "hash_128") != "" &&
				kugouMapString(typed, "songname", "song_name", "filename", "name", "audio_name") != "" {
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

func kugouFindPlaylistName(root any) string {
	if value := strings.TrimSpace(kugouBodyString(root, "listname", "list_name", "playlist_name", "name", "title")); value != "" {
		return value
	}
	return "酷狗同步歌单"
}

func kugouBodyString(root any, keys ...string) string {
	switch typed := root.(type) {
	case map[string]any:
		for _, key := range keys {
			if value, ok := typed[key]; ok {
				text := strings.TrimSpace(fmt.Sprintf("%v", value))
				if text != "" && text != "<nil>" {
					return text
				}
			}
		}
		for _, value := range typed {
			if found := kugouBodyString(value, keys...); found != "" {
				return found
			}
		}
	case []any:
		for _, value := range typed {
			if found := kugouBodyString(value, keys...); found != "" {
				return found
			}
		}
	}
	return ""
}

func kugouMapString(item map[string]any, keys ...string) string {
	return kugouBodyString(item, keys...)
}

func kugouMapInt(item map[string]any, keys ...string) int {
	for _, key := range keys {
		value, ok := item[key]
		if !ok {
			continue
		}
		var parsed int
		if _, err := fmt.Sscanf(strings.TrimSpace(fmt.Sprintf("%v", value)), "%d", &parsed); err == nil && parsed > 0 {
			return parsed
		}
	}
	return 0
}

func kugouMapCover(item map[string]any) *string {
	value := kugouMapCoverString(item)
	if value == "" {
		return nil
	}
	return &value
}

func kugouMapCoverString(item map[string]any) string {
	for _, key := range []string{"img", "image", "cover", "cover_url", "sizable_cover"} {
		value := strings.TrimSpace(kugouMapString(item, key))
		if value == "" {
			continue
		}
		value = strings.ReplaceAll(value, "{size}", "240")
		value = strings.ReplaceAll(value, "/{size}/", "/240/")
		return kugouNormalizeAssetURL(value)
	}
	return ""
}

func kugouNormalizeAssetURL(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if strings.HasPrefix(value, "//") {
		return "https:" + value
	}
	if strings.HasPrefix(value, "http://") {
		return "https://" + strings.TrimPrefix(value, "http://")
	}
	return value
}

func kugouTrackDurationMS(item map[string]any) int64 {
	duration := int64(kugouMapInt(item, "duration", "timelen", "time_length", "duration_ms"))
	if duration > 0 && duration < 1000 {
		duration *= 1000
	}
	return duration
}

func kugouInt(raw string) int {
	var value int
	_, _ = fmt.Sscanf(strings.TrimSpace(raw), "%d", &value)
	return value
}
