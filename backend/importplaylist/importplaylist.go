package importplaylist

import (
	"encoding/json"
	"regexp"
	"strings"
)

// ImportedTrackDTO is the normalized playlist import item used across multiple import paths.
type ImportedTrackDTO struct {
	Title         string `json:"title"`
	Artist        string `json:"artist"`
	Album         string `json:"album"`
	Pjmp3SourceID string `json:"pjmp3_source_id,omitempty"`
	CoverURL      string `json:"cover_url,omitempty"`
	DurationMS    int64  `json:"duration_ms,omitempty"`
}

var linePrefixRE = regexp.MustCompile(`^\s*(?:\d+[.)]\s*|\d+\s+)`)

func DetectFormat(text string) string {
	trimmed := strings.TrimSpace(text)
	if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
		var v any
		if json.Unmarshal([]byte(trimmed), &v) == nil {
			return "json"
		}
	}
	first := ""
	if idx := strings.IndexByte(text, '\n'); idx >= 0 {
		first = text[:idx]
	} else {
		first = text
	}
	if strings.Contains(first, ",") && (!strings.Contains(first, "\t") || strings.Count(first, ",") >= 2) {
		return "csv"
	}
	return "text"
}

func ParsePlaylistText(text, format string) ([]ImportedTrackDTO, error) {
	if format == "auto" || format == "" {
		format = DetectFormat(text)
	}
	switch format {
	case "json":
		return parseJSON(text)
	case "csv":
		return parseCSV(text), nil
	default:
		return parseLines(text), nil
	}
}

func stripLinePrefix(line string) string {
	return strings.TrimSpace(linePrefixRE.ReplaceAllString(line, ""))
}

func splitTitleArtist(line string) *ImportedTrackDTO {
	line = stripLinePrefix(line)
	if line == "" {
		return nil
	}
	for _, sep := range []string{" - ", " – ", " — ", " / ", "\t", "|"} {
		if idx := strings.Index(line, sep); idx >= 0 {
			title := strings.TrimSpace(line[:idx])
			artist := strings.TrimSpace(line[idx+len(sep):])
			if title != "" && artist != "" {
				return &ImportedTrackDTO{Title: title, Artist: artist}
			}
		}
	}
	return &ImportedTrackDTO{Title: line}
}

func parseLines(text string) []ImportedTrackDTO {
	var result []ImportedTrackDTO
	for _, line := range strings.Split(text, "\n") {
		if item := splitTitleArtist(line); item != nil {
			result = append(result, *item)
		}
	}
	return result
}

func splitCSVLine(line string) []string {
	var (
		result   []string
		current  strings.Builder
		inQuotes bool
	)
	for _, char := range line {
		switch {
		case char == '"':
			inQuotes = !inQuotes
		case char == ',' && !inQuotes:
			result = append(result, strings.TrimSpace(current.String()))
			current.Reset()
		default:
			current.WriteRune(char)
		}
	}
	result = append(result, strings.TrimSpace(current.String()))
	return result
}

func parseCSV(text string) []ImportedTrackDTO {
	lines := make([]string, 0)
	for _, line := range strings.Split(text, "\n") {
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}
	if len(lines) == 0 {
		return nil
	}
	header := splitCSVLine(lines[0])
	lower := make([]string, len(header))
	for i, value := range header {
		lower[i] = strings.ToLower(strings.TrimSpace(value))
	}
	titleIdx, artistIdx, albumIdx := -1, -1, -1
	for i, value := range lower {
		switch value {
		case "title":
			titleIdx = i
		case "artist":
			artistIdx = i
		case "album":
			albumIdx = i
		}
	}
	var result []ImportedTrackDTO
	start := 0
	if titleIdx >= 0 && artistIdx >= 0 {
		start = 1
	}
	for _, line := range lines[start:] {
		record := splitCSVLine(line)
		if titleIdx >= 0 && artistIdx >= 0 {
			if len(record) <= titleIdx || len(record) <= artistIdx {
				continue
			}
			item := ImportedTrackDTO{
				Title:  strings.TrimSpace(record[titleIdx]),
				Artist: strings.TrimSpace(record[artistIdx]),
			}
			if albumIdx >= 0 && len(record) > albumIdx {
				item.Album = strings.TrimSpace(record[albumIdx])
			}
			result = append(result, item)
			continue
		}
		switch len(record) {
		case 0:
			continue
		case 1:
			if item := splitTitleArtist(record[0]); item != nil {
				result = append(result, *item)
			}
		default:
			result = append(result, ImportedTrackDTO{
				Title:  strings.TrimSpace(record[0]),
				Artist: strings.TrimSpace(record[1]),
				Album:  strings.TrimSpace(joinOrEmpty(record, 2)),
			})
		}
	}
	return result
}

func joinOrEmpty(items []string, index int) string {
	if index >= len(items) {
		return ""
	}
	return items[index]
}

func parseJSON(text string) ([]ImportedTrackDTO, error) {
	var data any
	if err := json.Unmarshal([]byte(strings.TrimSpace(text)), &data); err != nil {
		return nil, err
	}
	return parseJSONValue(data), nil
}

func parseJSONValue(data any) []ImportedTrackDTO {
	switch value := data.(type) {
	case []any:
		result := make([]ImportedTrackDTO, 0, len(value))
		for _, item := range value {
			switch typed := item.(type) {
			case map[string]any:
				title := firstString(typed, "title", "name", "song")
				if strings.TrimSpace(title) == "" {
					continue
				}
				result = append(result, ImportedTrackDTO{
					Title:  strings.TrimSpace(title),
					Artist: strings.TrimSpace(firstString(typed, "artist", "singer")),
					Album:  strings.TrimSpace(firstString(typed, "album", "albumname", "album_name")),
				})
			case string:
				if item := splitTitleArtist(typed); item != nil {
					result = append(result, *item)
				}
			}
		}
		return result
	case map[string]any:
		if tracks, ok := value["tracks"]; ok {
			return parseJSONValue(tracks)
		}
	}
	return nil
}

func firstString(data map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := data[key]; ok {
			if text, ok := value.(string); ok {
				return text
			}
		}
	}
	return ""
}
