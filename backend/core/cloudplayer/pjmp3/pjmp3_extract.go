package pjmp3

import (
	"fmt"
	"net/http"
	"strings"

	"cloudplayer/backend/core/cloudplayer/config"
)

// Page extractors turn PJMP3 HTML into metadata, stream URLs and lyrics URLs.
func ExtractStreamURLsFromSongHTML(html string) []string {
	text := strings.ReplaceAll(html, `\/`, `/`)
	var result []string
	seen := make(map[string]struct{})
	for _, match := range reStreamURL.FindAllString(text, -1) {
		pushStreamCandidate(&result, seen, match)
	}
	if len(result) == 0 {
		for _, match := range reMP3Fallback.FindAllString(text, -1) {
			pushStreamCandidate(&result, seen, match)
		}
	}
	if len(result) == 0 {
		for _, captures := range reAudioTagSrc.FindAllStringSubmatch(text, -1) {
			if len(captures) > 1 {
				pushStreamCandidate(&result, seen, captures[1])
			}
		}
		for _, captures := range reSourceTagSrc.FindAllStringSubmatch(text, -1) {
			if len(captures) > 1 {
				pushStreamCandidate(&result, seen, captures[1])
			}
		}
	}
	return result
}

func ExtractLRCURLs(html string) []string {
	var result []string
	seen := make(map[string]struct{})
	for _, match := range reLRCURL.FindAllString(html, -1) {
		value := strings.ReplaceAll(match, `\/`, `/`)
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func FetchSongLRCText(client *http.Client, songID string) (*string, error) {
	sid := strings.TrimSpace(songID)
	if sid == "" {
		return nil, fmt.Errorf("无效的歌曲 ID")
	}
	songPage := fmt.Sprintf("%s/song.php?id=%s", strings.TrimRight(config.BaseURL, "/"), sid)
	html, err := FetchSongPageHTML(client, sid)
	if err != nil {
		return nil, err
	}
	for _, lyricURL := range ExtractLRCURLs(html) {
		text, err := downloadTextWithSongReferer(client, lyricURL, songPage)
		if err != nil || !looksLikeLRC(text) {
			continue
		}
		return &text, nil
	}
	return nil, nil
}

func ExtractAlbumFromSongHTML(html string) string {
	for _, pattern := range reAlbumQuoted {
		captures := pattern.FindStringSubmatch(html)
		if len(captures) < 2 {
			continue
		}
		value := strings.TrimSpace(captures[1])
		if value != "" && len(value) < 300 {
			lower := strings.ToLower(value)
			if lower != "null" && lower != "undefined" && lower != "none" {
				return value
			}
		}
	}
	captures := reAlbumLine.FindStringSubmatch(html)
	if len(captures) > 1 {
		value := strings.TrimSpace(strings.Split(captures[1], "\n")[0])
		if value != "" && len(value) < 300 {
			return value
		}
	}
	return ""
}

func ExtractDurationMSFromSongHTML(html string) int64 {
	if captures := reDurMMSS.FindStringSubmatch(html); len(captures) > 2 {
		minutes := parseInt64(captures[1])
		seconds := parseInt64(captures[2])
		if minutes < 120 && seconds < 60 {
			return (minutes*60 + seconds) * 1000
		}
	}
	if captures := reDurHHMMSS.FindStringSubmatch(html); len(captures) > 3 {
		hours := parseInt64(captures[1])
		minutes := parseInt64(captures[2])
		seconds := parseInt64(captures[3])
		if minutes < 60 && seconds < 60 {
			return ((hours*60+minutes)*60 + seconds) * 1000
		}
	}
	var best int64
	for _, captures := range reAnyTime.FindAllStringSubmatch(html, -1) {
		if len(captures) < 3 {
			continue
		}
		minutes := parseInt64(captures[1])
		seconds := parseInt64(captures[2])
		if minutes >= 60 || seconds >= 60 {
			continue
		}
		value := (minutes*60 + seconds) * 1000
		if value >= 1000 && value <= 3_600_000 && value > best {
			best = value
		}
	}
	return best
}
