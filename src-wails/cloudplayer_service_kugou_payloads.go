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
			if kugouDirectInt(typed, "listid", "list_id", "id") > 0 && kugouDirectString(typed, "listname", "list_name", "name", "title") != "" {
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
			if kugouDirectString(typed, "hash", "audio_hash", "file_hash", "hash_128") != "" &&
				kugouDirectString(typed, "songname", "song_name", "filename", "name", "audio_name") != "" {
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

func kugouDirectString(item map[string]any, keys ...string) string {
	for _, key := range keys {
		value, ok := item[key]
		if !ok {
			continue
		}
		text := strings.TrimSpace(fmt.Sprintf("%v", value))
		if text != "" && text != "<nil>" {
			return text
		}
	}
	return ""
}

func kugouTrackArtist(item map[string]any) string {
	if value := strings.TrimSpace(kugouMapString(item, "singername", "singer_name", "author_name", "artist")); value != "" {
		return value
	}
	if raw, ok := item["singerinfo"].([]any); ok && len(raw) > 0 {
		names := make([]string, 0, len(raw))
		for _, entry := range raw {
			typed, ok := entry.(map[string]any)
			if !ok {
				continue
			}
			name := strings.TrimSpace(kugouMapString(typed, "name", "singername", "singer_name"))
			if name != "" {
				names = append(names, name)
			}
		}
		if len(names) > 0 {
			return strings.Join(names, " / ")
		}
	}
	return ""
}

func kugouTrackAlbum(item map[string]any) string {
	if value := strings.TrimSpace(kugouMapString(item, "album_name", "albumname", "album")); value != "" {
		return value
	}
	if raw, ok := item["albuminfo"].(map[string]any); ok {
		if value := strings.TrimSpace(kugouMapString(raw, "name", "album_name", "albumname")); value != "" {
			return value
		}
	}
	return ""
}

func kugouTrackTitle(item map[string]any) string {
	title := strings.TrimSpace(kugouMapString(item, "songname", "song_name", "filename", "name", "audio_name"))
	if title == "" {
		return ""
	}
	title = strings.TrimSuffix(title, ".mp3")
	title = strings.TrimSuffix(title, ".flac")
	title = strings.TrimSuffix(title, ".wav")
	title = strings.TrimSpace(title)
	artist := kugouTrackArtist(item)
	if artist == "" {
		return title
	}
	artistAliases := []string{artist, strings.ReplaceAll(artist, " / ", "、"), strings.ReplaceAll(artist, " / ", "/")}
	for _, alias := range artistAliases {
		for _, sep := range []string{" - ", " – ", " — "} {
			prefix := alias + sep
			if strings.HasPrefix(title, prefix) {
				return strings.TrimSpace(strings.TrimPrefix(title, prefix))
			}
		}
	}
	return title
}

func kugouMapInt(item map[string]any, keys ...string) int {
	for _, key := range keys {
		value, ok := item[key]
		if !ok {
			continue
		}
		if parsed := kugouParseInt(value); parsed > 0 {
			return parsed
		}
	}
	return 0
}

func kugouDirectInt(item map[string]any, keys ...string) int {
	for _, key := range keys {
		value, ok := item[key]
		if !ok {
			continue
		}
		if parsed := kugouParseInt(value); parsed > 0 {
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
	return kugouParseInt(raw)
}
