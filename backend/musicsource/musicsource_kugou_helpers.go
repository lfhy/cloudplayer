package musicsource

// Generic map helpers keep Kugou payload parsing local and resilient to response shape drift.

import (
	"fmt"
	"strings"
)

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
			if kugouLooksLikeTrack(typed) {
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
	return kugouPickString(item, "hash", "audio_hash", "file_hash", "hash_128", "FileHash") != "" &&
		kugouPickString(item, "songname", "song_name", "filename", "name", "audio_name", "FileName", "OriSongName") != ""
}

func kugouLooksLikeTrack(item map[string]any) bool {
	return kugouPickString(item, "hash", "audio_hash", "file_hash", "hash_128", "FileHash") != "" &&
		kugouPickString(item, "songname", "song_name", "filename", "name", "audio_name", "FileName", "OriSongName") != ""
}

func kugouDailyTrackToSearchResult(item map[string]any) (SearchResult, bool) {
	hash := strings.ToLower(strings.TrimSpace(kugouPickString(item, "hash", "audio_hash", "file_hash", "hash_128", "hash_320", "hash_flac", "FileHash")))
	title := kugouTrackTitle(item)
	if hash == "" || title == "" {
		return SearchResult{}, false
	}
	albumAudioID := kugouPickInt(item, "album_audio_id", "albumaudioid", "mixsongid", "mixsong_id", "MixSongID", "Audioid")
	return SearchResult{
		SourceID:   EncodeSourceID(ProviderKugou, encodeKugouRawID(hash, albumAudioID)),
		Title:      title,
		Artist:     kugouTrackArtist(item),
		Album:      kugouTrackAlbum(item),
		DurationMS: kugouTrackDurationMS(item),
		CoverURL:   kugouCoverURL(item),
	}, true
}

func kugouTrackArtist(item map[string]any) string {
	if value := strings.TrimSpace(kugouPickString(item, "singername", "singer_name", "author_name", "artist", "SingerName")); value != "" {
		return value
	}
	if raw, ok := item["Singers"].([]any); ok && len(raw) > 0 {
		names := make([]string, 0, len(raw))
		for _, entry := range raw {
			typed, ok := entry.(map[string]any)
			if !ok {
				continue
			}
			name := strings.TrimSpace(kugouPickString(typed, "name", "singername", "singer_name"))
			if name != "" {
				names = append(names, name)
			}
		}
		if len(names) > 0 {
			return strings.Join(names, " / ")
		}
	}
	if raw, ok := item["singerinfo"].([]any); ok && len(raw) > 0 {
		names := make([]string, 0, len(raw))
		for _, entry := range raw {
			typed, ok := entry.(map[string]any)
			if !ok {
				continue
			}
			name := strings.TrimSpace(kugouPickString(typed, "name", "singername", "singer_name"))
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
	if value := strings.TrimSpace(kugouPickString(item, "album_name", "albumname", "album", "AlbumName")); value != "" {
		return value
	}
	if raw, ok := item["albuminfo"].(map[string]any); ok {
		if value := strings.TrimSpace(kugouPickString(raw, "name", "album_name", "albumname")); value != "" {
			return value
		}
	}
	return ""
}

func kugouTrackTitle(item map[string]any) string {
	title := strings.TrimSpace(kugouPickString(item, "songname", "song_name", "filename", "name", "audio_name", "OriSongName", "FileName"))
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

func kugouTrackDurationMS(item map[string]any) int64 {
	duration := int64(kugouPickInt(item, "duration", "timelen", "time_length", "duration_ms", "Duration"))
	if duration > 0 && duration < 1000 {
		duration *= 1000
	}
	return duration
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
		if parsed := kugouNumericID(value); parsed > 0 {
			return parsed
		}
	}
	return 0
}

func kugouCoverURL(item map[string]any) *string {
	for _, key := range []string{"img", "image", "cover", "cover_url", "sizable_cover", "Image"} {
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
