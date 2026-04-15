package pjmp3

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"cloudplayer/internal/cloudplayer/config"
	"github.com/PuerkitoBio/goquery"
)

const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

var (
	reSongID       = regexp.MustCompile(`(?i)song\.php\?id=(\d+)`)
	reSearchPage   = regexp.MustCompile(`[?&]page=(\d+)`)
	reSpeedSuffix  = regexp.MustCompile(`^(.+?)\s*\([^)]*[xX×][^)]*\)\s*(.+)$`)
	reStreamURL    = regexp.MustCompile(`(?i)https?://[^\s"'<>]+\.(?:mp3|aac|m4a|wav|ogg|flac)(?:\?[^\s"'<>]*)?`)
	reMP3Fallback  = regexp.MustCompile(`(?i)https?://[^\s"'<>]+\.mp3[^\s"'<>]*`)
	reAudioTagSrc  = regexp.MustCompile(`(?i)<audio[^>]+src\s*=\s*["']([^"']+)["']`)
	reSourceTagSrc = regexp.MustCompile(`(?i)<source[^>]+src\s*=\s*["']([^"']+)["']`)
	reLRCURL       = regexp.MustCompile(`(?i)https?://[^"'\s<>]+\.lrc[^"'\s<>]*`)
	reAlbumQuoted  = []*regexp.Regexp{
		regexp.MustCompile(`所属专辑\s*《([^》]{1,200})》`),
		regexp.MustCompile(`所属专辑\s*[\[【]([^\]}】]{1,200})[\]】]`),
		regexp.MustCompile(`专辑\s*《([^》]{1,200})》`),
		regexp.MustCompile(`"album"\s*:\s*"([^"\\]+)"`),
		regexp.MustCompile(`"albumName"\s*:\s*"([^"\\]+)"`),
		regexp.MustCompile(`"zhuanji"\s*:\s*"([^"\\]+)"`),
	}
	reAlbumLine = regexp.MustCompile(`专辑\s*[：:]\s*([^\n\r<]{1,200})`)
	reDurMMSS   = regexp.MustCompile(`时长\s*[：:]\s*(\d{1,2})\s*:\s*(\d{2})`)
	reDurHHMMSS = regexp.MustCompile(`时长\s*[：:]\s*(\d+)\s*[:：]\s*(\d{1,2})\s*[:：]\s*(\d{2})`)
	reAnyTime   = regexp.MustCompile(`\b(\d{1,2}):(\d{2})\b`)
)

type SearchResult struct {
	SourceID string  `json:"source_id"`
	Title    string  `json:"title"`
	Artist   string  `json:"artist"`
	Album    string  `json:"album"`
	CoverURL *string `json:"cover_url"`
}

func NormalizeImageURL(raw *string) *string {
	if raw == nil {
		return nil
	}
	value := strings.TrimSpace(*raw)
	if value == "" {
		return nil
	}
	switch {
	case strings.HasPrefix(value, "//"):
		out := "https:" + value
		return &out
	case strings.HasPrefix(value, "/"):
		out := strings.TrimRight(config.BaseURL, "/") + value
		return &out
	case strings.HasPrefix(value, "http://"), strings.HasPrefix(value, "https://"):
		return &value
	default:
		out := strings.TrimRight(config.BaseURL, "/") + "/" + strings.TrimLeft(value, "/")
		return &out
	}
}

func SearchPjmp3(client *http.Client, keyword string, page uint32) ([]SearchResult, bool, error) {
	values := url.Values{}
	values.Set("keyword", strings.TrimSpace(keyword))
	values.Set("page", fmt.Sprintf("%d", maxUint32(page, 1)))

	requestURL := strings.TrimRight(config.BaseURL, "/") + "/search.php?" + values.Encode()
	request, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, false, err
	}
	request.Header.Set("User-Agent", browserUA)
	request.Header.Set("Referer", strings.TrimRight(config.BaseURL, "/")+"/")
	request.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	response, err := client.Do(request)
	if err != nil {
		return nil, false, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, false, fmt.Errorf("search http %s", response.Status)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, false, err
	}
	return ParseSearchHTMLPage(string(body), maxUint32(page, 1))
}

func ParseSearchHTMLPage(html string, page uint32) ([]SearchResult, bool, error) {
	document, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, false, err
	}
	modern := parseModernCards(document)
	if len(modern) > 0 {
		return modern, detectNextPage(document, page, len(modern)), nil
	}
	legacy := parseLegacyTable(document)
	return legacy, detectNextPage(document, page, len(legacy)), nil
}

func PreviewAudioCacheDir() string {
	return filepath.Join(os.TempDir(), "cloudplayer_tauri_audio")
}

var previewCacheExts = []string{".mp3", ".m4a", ".aac", ".flac", ".ogg", ".wav"}

func PreviewCachePathIfExists(songID string) string {
	name := previewCacheName(songID)
	if name == "" {
		return ""
	}
	dir := PreviewAudioCacheDir()
	for _, ext := range previewCacheExts {
		path := filepath.Join(dir, "preview_"+name+ext)
		info, err := os.Stat(path)
		if err == nil && !info.IsDir() && info.Size() > 0 {
			return path
		}
	}
	return ""
}

func FetchSongPageHTML(client *http.Client, songID string) (string, error) {
	sid := strings.TrimSpace(songID)
	if sid == "" {
		return "", fmt.Errorf("invalid song id")
	}
	requestURL := fmt.Sprintf("%s/song.php?id=%s", strings.TrimRight(config.BaseURL, "/"), url.QueryEscape(sid))
	request, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("User-Agent", browserUA)
	request.Header.Set("Referer", strings.TrimRight(config.BaseURL, "/")+"/")
	request.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("song page http %s", response.Status)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func FetchPreviewURL(client *http.Client, songID string) (string, error) {
	html, err := FetchSongPageHTML(client, songID)
	if err != nil {
		return "", err
	}
	urls := ExtractStreamURLsFromSongHTML(html)
	if len(urls) == 0 {
		return "", nil
	}
	return urls[0], nil
}

func CachePreviewAudioFile(client *http.Client, songID string) (string, error) {
	sid := strings.TrimSpace(songID)
	if sid == "" {
		return "", fmt.Errorf("无效的歌曲 ID")
	}
	if err := os.MkdirAll(PreviewAudioCacheDir(), 0o755); err != nil {
		return "", err
	}
	name := previewCacheName(sid)
	songPage := fmt.Sprintf("%s/song.php?id=%s", strings.TrimRight(config.BaseURL, "/"), sid)

	const rounds = 6
	for round := 0; round < rounds; round++ {
		html, err := FetchSongPageHTML(client, sid)
		if err != nil {
			return "", err
		}
		urls := ExtractStreamURLsFromSongHTML(html)
		sort.Slice(urls, func(i, j int) bool {
			left := strings.Contains(strings.ToLower(urls[i]), "er-sycdn")
			right := strings.Contains(strings.ToLower(urls[j]), "er-sycdn")
			return !left && right
		})
		if len(urls) == 0 {
			if round+1 < rounds {
				time.Sleep(220 * time.Millisecond)
			}
			continue
		}
		for _, mediaURL := range urls {
			ext := previewFileExtensionForURL(mediaURL)
			path := filepath.Join(PreviewAudioCacheDir(), "preview_"+name+ext)
			for _, candidate := range expandMP3URLCandidates(mediaURL) {
				bytes, err := downloadMP3Bytes(client, candidate, songPage)
				if err != nil {
					continue
				}
				if err := validateAudioBytes(bytes); err != nil {
					continue
				}
				if err := os.WriteFile(path, bytes, 0o644); err != nil {
					return "", err
				}
				return path, nil
			}
		}
		if round+1 < rounds {
			time.Sleep(200 * time.Millisecond)
		}
	}

	return "", fmt.Errorf("无法下载试听：站点返回的试听链暂时不可用（多为酷我 CDN 410）。请再点一次播放或重新搜索后重试。")
}

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

func parseModernCards(document *goquery.Document) []SearchResult {
	var result []SearchResult
	seen := make(map[string]struct{})
	document.Find(`a.search-result-list-item[href*="song.php"]`).Each(func(_ int, card *goquery.Selection) {
		href, _ := card.Attr("href")
		match := reSongID.FindStringSubmatch(strings.ReplaceAll(href, `\`, `/`))
		if len(match) < 2 {
			return
		}
		songID := match[1]
		if _, ok := seen[songID]; ok {
			return
		}
		title := strings.TrimSpace(card.Find(".search-result-list-item-left-song").First().Text())
		if title == "" {
			return
		}
		artist := strings.TrimSpace(card.Find(".search-result-list-item-left-singer").First().Text())
		coverURL := pickNormalizedImage(card.Find(".search-result-list-item-img img").First(), "src", "data-src", "data-original")
		seen[songID] = struct{}{}
		result = append(result, SearchResult{
			SourceID: songID,
			Title:    title,
			Artist:   artist,
			Album:    "",
			CoverURL: coverURL,
		})
	})
	return result
}

func parseLegacyTable(document *goquery.Document) []SearchResult {
	var result []SearchResult
	seen := make(map[string]struct{})

	document.Find("tr").Each(func(_ int, tr *goquery.Selection) {
		tr.Find(`a[href*="song.php"]`).Each(func(_ int, anchor *goquery.Selection) {
			href, _ := anchor.Attr("href")
			match := reSongID.FindStringSubmatch(href)
			if len(match) < 2 {
				return
			}
			songID := match[1]
			if _, ok := seen[songID]; ok {
				return
			}
			title := strings.TrimSpace(anchor.Text())
			if title == "" {
				return
			}
			switch strings.ToLower(title) {
			case "下载", "播放", "试听":
				return
			}

			var artist string
			var album string

			cells := make([]*goquery.Selection, 0, tr.Find("td").Length())
			tr.Find("td").Each(func(_ int, td *goquery.Selection) {
				cells = append(cells, td)
			})

			needle := "song.php?id=" + songID
			needleLower := strings.ToLower(needle)
			anchorIndex := -1
			for index, cell := range cells {
				html, err := cell.Html()
				if err != nil {
					continue
				}
				if strings.Contains(strings.ToLower(html), needleLower) {
					anchorIndex = index
					break
				}
			}
			if anchorIndex >= 0 {
				if anchorIndex+1 < len(cells) {
					artist = strings.TrimSpace(cells[anchorIndex+1].Text())
				}
				if anchorIndex+2 < len(cells) {
					album = strings.TrimSpace(cells[anchorIndex+2].Text())
				}

				var textsAfter []string
				for _, cell := range cells[anchorIndex+1:] {
					text := strings.TrimSpace(cell.Text())
					if text == "" || allDigits(text) || text == title {
						continue
					}
					textsAfter = append(textsAfter, text)
				}
				if artist == "" && len(textsAfter) > 0 {
					artist = textsAfter[0]
				}
				if album == "" && len(textsAfter) >= 2 {
					album = textsAfter[1]
				}
				if album == "" && len(textsAfter) >= 3 {
					album = textsAfter[2]
				}
			}

			var bestCover *string
			tr.Find("img").Each(func(_ int, image *goquery.Selection) {
				coverURL := pickNormalizedImage(image, "src", "data-src", "data-original", "data-lazy-src")
				if coverURL == nil {
					return
				}
				lower := strings.ToLower(*coverURL)
				if strings.Contains(lower, "blank") || strings.Contains(lower, "spacer") {
					return
				}
				if bestCover == nil {
					bestCover = coverURL
				}
				if strings.Contains(lower, "albumcover") || strings.Contains(lower, "/cover") || strings.Contains(lower, "pic") {
					bestCover = coverURL
				}
			})

			if artist == "" {
				for _, sep := range []string{" - ", " – ", " — ", " · ", " / ", "|", "／"} {
					if index := strings.Index(title, sep); index >= 0 {
						left := strings.TrimSpace(title[:index])
						right := strings.TrimSpace(title[index+len(sep):])
						if left != "" && right != "" {
							title = left
							artist = right
							break
						}
					}
				}
			}
			if artist == "" && containsCJK(title) {
				compact := strings.Join(strings.Fields(title), " ")
				if parts := strings.Fields(compact); len(parts) >= 2 {
					left := strings.TrimSpace(parts[0])
					right := strings.TrimSpace(strings.Join(parts[1:], " "))
					if left != "" && right != "" && len(left) <= 64 {
						title = left
						artist = right
					}
				}
			}
			if artist == "" {
				if newTitle, newArtist, ok := splitTitleSpeedSuffix(title); ok {
					title = newTitle
					artist = newArtist
				}
			}
			if artist == "" {
				if newTitle, newArtist, ok := splitGluedPureCJK(title); ok {
					title = newTitle
					artist = newArtist
				}
			}

			seen[songID] = struct{}{}
			result = append(result, SearchResult{
				SourceID: songID,
				Title:    title,
				Artist:   artist,
				Album:    album,
				CoverURL: bestCover,
			})
		})
	})

	return result
}

func detectNextPage(document *goquery.Document, currentPage uint32, resultCount int) bool {
	hasNext := false
	document.Find("a[href]").EachWithBreak(func(_ int, anchor *goquery.Selection) bool {
		href, _ := anchor.Attr("href")
		href = strings.ReplaceAll(href, `\`, `/`)
		match := reSearchPage.FindStringSubmatch(href)
		if len(match) < 2 {
			return true
		}
		page := parseUint32(match[1])
		lower := strings.ToLower(href)
		if page > currentPage && (strings.Contains(lower, "search") || strings.HasPrefix(href, "?") || strings.Contains(lower, "keyword=")) {
			hasNext = true
			return false
		}
		return true
	})
	return hasNext || resultCount >= 12
}

func previewCacheName(songID string) string {
	safe := onlyDigits(strings.TrimSpace(songID))
	if safe == "" {
		return "unknown"
	}
	return safe
}

func normalizeMediaURL(raw string) string {
	value := strings.TrimSpace(strings.TrimSuffix(strings.ReplaceAll(raw, `\/`, `/`), `\`))
	if strings.HasPrefix(value, "//") {
		return "https:" + value
	}
	return value
}

func isExcludedStreamURL(value string) bool {
	lower := strings.ToLower(value)
	if strings.Contains(lower, "albumcover") || strings.Contains(lower, "/star/albumcover") {
		return true
	}
	pathOnly := strings.Split(value, "?")[0]
	lower = strings.ToLower(pathOnly)
	return strings.HasSuffix(lower, ".jpg") ||
		strings.HasSuffix(lower, ".jpeg") ||
		strings.HasSuffix(lower, ".png") ||
		strings.HasSuffix(lower, ".webp") ||
		strings.HasSuffix(lower, ".gif") ||
		strings.HasSuffix(lower, ".css") ||
		strings.HasSuffix(lower, ".js")
}

func pushStreamCandidate(result *[]string, seen map[string]struct{}, raw string) {
	value := normalizeMediaURL(raw)
	if value == "" || !strings.HasPrefix(strings.ToLower(value), "http") || isExcludedStreamURL(value) {
		return
	}
	if _, ok := seen[value]; ok {
		return
	}
	seen[value] = struct{}{}
	*result = append(*result, value)
}

func previewFileExtensionForURL(value string) string {
	pathOnly := strings.ToLower(strings.Split(value, "?")[0])
	switch {
	case strings.HasSuffix(pathOnly, ".m4a"):
		return ".m4a"
	case strings.HasSuffix(pathOnly, ".aac"):
		return ".aac"
	case strings.HasSuffix(pathOnly, ".flac"):
		return ".flac"
	case strings.HasSuffix(pathOnly, ".ogg"):
		return ".ogg"
	case strings.HasSuffix(pathOnly, ".wav"):
		return ".wav"
	case strings.HasSuffix(pathOnly, ".mp3"):
		return ".mp3"
	default:
		return ".mp3"
	}
}

func expandMP3URLCandidates(value string) []string {
	result := []string{value}
	if strings.Contains(strings.ToLower(value), "er-sycdn.kuwo.cn") {
		result = append(result, strings.Replace(value, "er-sycdn.kuwo.cn", "sycdn.kuwo.cn", 1))
	}
	return dedupeStrings(result)
}

func downloadMP3Bytes(client *http.Client, mediaURL, songPage string) ([]byte, error) {
	base := strings.TrimRight(config.BaseURL, "/")
	refHome := base + "/"
	attempts := []struct {
		referer string
		origin  string
	}{
		{referer: songPage, origin: base},
		{referer: songPage},
		{referer: "https://www.kuwo.cn/", origin: "https://www.kuwo.cn"},
		{referer: refHome, origin: base},
		{referer: songPage, origin: "https://www.kuwo.cn"},
	}

	lastErr := "未知错误"
	for _, attempt := range attempts {
		request, err := http.NewRequest(http.MethodGet, mediaURL, nil)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		request.Header.Set("User-Agent", browserUA)
		request.Header.Set("Accept", "*/*")
		request.Header.Set("Referer", attempt.referer)
		if attempt.origin != "" {
			request.Header.Set("Origin", attempt.origin)
		}
		response, err := client.Do(request)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		body, readErr := io.ReadAll(response.Body)
		response.Body.Close()
		if readErr != nil {
			lastErr = readErr.Error()
			continue
		}
		switch response.StatusCode {
		case http.StatusGone, http.StatusForbidden, http.StatusNotFound:
			lastErr = fmt.Sprintf("HTTP %d", response.StatusCode)
			continue
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			lastErr = "HTTP " + response.Status
			continue
		}
		return body, nil
	}
	return nil, fmt.Errorf("%s", lastErr)
}

func validateAudioBytes(bytes []byte) error {
	if len(bytes) < 64 {
		return fmt.Errorf("音频数据过短或无效")
	}
	for _, value := range bytes {
		switch value {
		case ' ', '\n', '\r', '\t':
			continue
		case '<':
			return fmt.Errorf("试听链接返回了网页而非音频")
		default:
			return nil
		}
	}
	return nil
}

func looksLikeLRC(text string) bool {
	trimmed := strings.TrimLeft(text, " \t\r\n")
	return strings.HasPrefix(trimmed, "[") ||
		strings.Contains(text, "[00:") ||
		strings.Contains(text, "[01:") ||
		strings.Contains(text, "[02:")
}

func downloadTextWithSongReferer(client *http.Client, rawURL, songPage string) (string, error) {
	base := strings.TrimRight(config.BaseURL, "/")
	attempts := []struct {
		referer string
		origin  string
	}{
		{referer: songPage, origin: base},
		{referer: songPage},
		{referer: base + "/", origin: base},
	}
	lastErr := "未知错误"
	for _, attempt := range attempts {
		request, err := http.NewRequest(http.MethodGet, rawURL, nil)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		request.Header.Set("User-Agent", browserUA)
		request.Header.Set("Accept", "text/plain,*/*;q=0.8")
		request.Header.Set("Referer", attempt.referer)
		if attempt.origin != "" {
			request.Header.Set("Origin", attempt.origin)
		}
		response, err := client.Do(request)
		if err != nil {
			lastErr = err.Error()
			continue
		}
		body, readErr := io.ReadAll(response.Body)
		response.Body.Close()
		if readErr != nil {
			lastErr = readErr.Error()
			continue
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			lastErr = "HTTP " + response.Status
			continue
		}
		return string(body), nil
	}
	return "", fmt.Errorf("%s", lastErr)
}

func splitTitleSpeedSuffix(title string) (string, string, bool) {
	match := reSpeedSuffix.FindStringSubmatch(strings.TrimSpace(title))
	if len(match) < 3 {
		return "", "", false
	}
	left := strings.TrimSpace(match[1])
	right := strings.TrimSpace(match[2])
	if left == "" || right == "" {
		return "", "", false
	}
	return left, right, true
}

func splitGluedPureCJK(title string) (string, string, bool) {
	compact := strings.Map(func(r rune) rune {
		if r == ' ' || r == '\t' || r == '\n' || r == '\r' {
			return -1
		}
		return r
	}, title)
	length := len([]rune(compact))
	if length < 5 || length > 14 {
		return "", "", false
	}
	for _, r := range compact {
		if r < '\u4e00' || r > '\u9fff' {
			return "", "", false
		}
	}
	cut := length / 2
	if length%2 == 1 {
		cut = (length - 1) / 2
	}
	runes := []rune(compact)
	if cut < 2 || len(runes)-cut < 2 {
		return "", "", false
	}
	return string(runes[:cut]), string(runes[cut:]), true
}

func pickNormalizedImage(selection *goquery.Selection, attrs ...string) *string {
	if selection == nil || selection.Length() == 0 {
		return nil
	}
	for _, attr := range attrs {
		value, ok := selection.Attr(attr)
		if !ok {
			continue
		}
		if normalized := NormalizeImageURL(&value); normalized != nil {
			return normalized
		}
	}
	return nil
}

func dedupeStrings(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	result := make([]string, 0, len(items))
	for _, item := range items {
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result
}

func allDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func containsCJK(value string) bool {
	for _, r := range value {
		if r >= '\u4e00' && r <= '\u9fff' {
			return true
		}
	}
	return false
}

func onlyDigits(value string) string {
	var builder strings.Builder
	for _, r := range value {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func parseInt64(value string) int64 {
	var result int64
	for _, r := range value {
		if r < '0' || r > '9' {
			return 0
		}
		result = result*10 + int64(r-'0')
	}
	return result
}

func parseUint32(value string) uint32 {
	var result uint32
	for _, r := range value {
		if r < '0' || r > '9' {
			return 0
		}
		result = result*10 + uint32(r-'0')
	}
	return result
}

func maxUint32(value, minValue uint32) uint32 {
	if value < minValue {
		return minValue
	}
	return value
}
