package lyrics

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"cloudplayer/internal/cloudplayer/config"
)

type FetchRequest struct {
	PJMP3SourceID   *string  `json:"pjmp3SourceId,omitempty"`
	Title           string   `json:"title"`
	Artist          string   `json:"artist"`
	Album           string   `json:"album,omitempty"`
	LocalPath       *string  `json:"localPath,omitempty"`
	DurationSeconds *float64 `json:"durationSeconds,omitempty"`
}

type LyricsPayload struct {
	LRCText   string     `json:"lrcText"`
	WordLines []WordLine `json:"wordLines,omitempty"`
}

type WordLine struct {
	StartMS uint64       `json:"startMs"`
	EndMS   uint64       `json:"endMs"`
	Words   []WordTiming `json:"words"`
}

type WordTiming struct {
	StartMS uint64 `json:"startMs"`
	EndMS   uint64 `json:"endMs"`
	Text    string `json:"text"`
}

type LyricCandidate struct {
	Source     string  `json:"source"`
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Artist     string  `json:"artist"`
	Album      string  `json:"album"`
	DurationMS *int64  `json:"durationMs,omitempty"`
	QQMid      *string `json:"qqMid,omitempty"`
	KugouHash  *string `json:"kugouHash,omitempty"`
	NeteaseID  *int64  `json:"neteaseId,omitempty"`
	LRCLibID   *int64  `json:"lrclibId,omitempty"`
}

var lrcTimestampRE = regexp.MustCompile(`\[(\d+):(\d{1,2})(?:[\.,](\d{1,3}))?\]`)

func FetchSongLRCEnriched(client *http.Client, settings config.Settings, req FetchRequest) (*LyricsPayload, error) {
	return fetchSongLDDCEnriched(client, settings, req)
}

func SearchCandidates(client *http.Client, settings config.Settings, keyword string, durationMS *int64, sources []string) ([]LyricCandidate, error) {
	trimmed := strings.TrimSpace(keyword)
	if trimmed == "" {
		return nil, fmt.Errorf("请输入歌词搜索关键词")
	}

	selected := normalizeSourceList(sources)
	if len(selected) == 0 {
		selected = defaultLyricSources()
	}
	if !settings.LyricsLRCLibEnabled {
		selected = removeSource(selected, "lrclib")
	}

	out := make([]LyricCandidate, 0, 32)
	for _, source := range selected {
		switch source {
		case "qq":
			hits, err := searchQqSongs(client, trimmed, 1)
			if err != nil {
				continue
			}
			for _, hit := range hits {
				mid := hit.SongMid
				dms := hit.DurationMS
				out = append(out, LyricCandidate{
					Source:     "qq",
					ID:         strconv.FormatInt(hit.SongID, 10),
					Title:      hit.Title,
					Artist:     hit.Artist,
					Album:      hit.Album,
					DurationMS: &dms,
					QQMid:      &mid,
				})
			}
		case "kugou":
			hits, err := searchKugouSongs(client, trimmed, 1)
			if err != nil {
				continue
			}
			for _, hit := range hits {
				hash := hit.FileHash
				dms := hit.DurationMS
				out = append(out, LyricCandidate{
					Source:     "kugou",
					ID:         hit.AlbumAudioID,
					Title:      hit.Title,
					Artist:     hit.Artist,
					Album:      hit.Album,
					DurationMS: &dms,
					KugouHash:  &hash,
				})
			}
		case "netease":
			hits, err := neteaseSearchHits(client, trimmed, 20)
			if err != nil {
				continue
			}
			for _, hit := range hits {
				id := hit.ID
				dms := hit.DurationMS
				out = append(out, LyricCandidate{
					Source:     "netease",
					ID:         strconv.FormatInt(hit.ID, 10),
					Title:      hit.Title,
					Artist:     hit.Artist,
					Album:      hit.Album,
					DurationMS: &dms,
					NeteaseID:  &id,
				})
			}
		case "lrclib":
			hits, err := lrclibSearchHits(client, trimmed, durationMS)
			if err != nil {
				continue
			}
			for _, hit := range hits {
				id := hit.ID
				dms := hit.DurationMS
				out = append(out, LyricCandidate{
					Source:     "lrclib",
					ID:         strconv.FormatInt(hit.ID, 10),
					Title:      hit.Title,
					Artist:     hit.Artist,
					Album:      hit.Album,
					DurationMS: &dms,
					LRCLibID:   &id,
				})
			}
		}
	}
	return out, nil
}

func FetchCandidate(client *http.Client, settings config.Settings, candidate LyricCandidate) (LyricsPayload, error) {
	switch strings.ToLower(strings.TrimSpace(candidate.Source)) {
	case "qq":
		id, err := strconv.ParseInt(strings.TrimSpace(candidate.ID), 10, 64)
		if err != nil {
			return LyricsPayload{}, fmt.Errorf("qq: bad id")
		}
		mid := ""
		if candidate.QQMid != nil {
			mid = strings.TrimSpace(*candidate.QQMid)
		}
		return fetchQqLyrics(client, qqSearchHit{
			SongID:     id,
			SongMid:    mid,
			Title:      candidate.Title,
			Artist:     candidate.Artist,
			Album:      candidate.Album,
			DurationMS: derefInt64(candidate.DurationMS),
		})
	case "kugou":
		hash := ""
		if candidate.KugouHash != nil {
			hash = strings.TrimSpace(*candidate.KugouHash)
		}
		return fetchKugouLyrics(client, kugouSearchHit{
			AlbumAudioID: strings.TrimSpace(candidate.ID),
			FileHash:     hash,
			Title:        candidate.Title,
			Artist:       candidate.Artist,
			Album:        candidate.Album,
			DurationMS:   derefInt64(candidate.DurationMS),
		})
	case "netease":
		id, ok := candidateIDInt64(candidate.ID, candidate.NeteaseID)
		if !ok {
			return LyricsPayload{}, fmt.Errorf("netease: bad id")
		}
		payload, err := fetchNeteaseLyricsBySongID(client, settings.LyricsNeteaseAPIBase, id)
		if err != nil {
			return LyricsPayload{}, err
		}
		if payload == nil {
			return LyricsPayload{}, fmt.Errorf("netease: no lyrics")
		}
		return *payload, nil
	case "lrclib":
		if !settings.LyricsLRCLibEnabled {
			return LyricsPayload{}, fmt.Errorf("lrclib disabled in settings")
		}
		id, ok := candidateIDInt64(candidate.ID, candidate.LRCLibID)
		if !ok {
			return LyricsPayload{}, fmt.Errorf("lrclib: bad id")
		}
		payload, err := fetchLRCLibByID(client, id)
		if err != nil {
			return LyricsPayload{}, err
		}
		if payload == nil {
			return LyricsPayload{}, fmt.Errorf("lrclib: no lyrics")
		}
		return *payload, nil
	default:
		return LyricsPayload{}, fmt.Errorf("unknown lyric source %s", candidate.Source)
	}
}

func fetchSongLDDCEnriched(client *http.Client, settings config.Settings, req FetchRequest) (*LyricsPayload, error) {
	keyword := strings.TrimSpace(strings.TrimSpace(req.Artist) + " " + strings.TrimSpace(req.Title))
	if keyword == "" {
		return nil, nil
	}

	var durationMS *int64
	if req.DurationSeconds != nil && *req.DurationSeconds > 0 {
		value := int64((*req.DurationSeconds) * 1000)
		durationMS = &value
	}

	chain := parseProviderOrder(settings.LyricsProviderOrder)
	if !settings.LyricsLRCLibEnabled {
		chain = removeSource(chain, "lrclib")
	}
	if len(chain) == 0 {
		chain = defaultLyricSources()
		if !settings.LyricsLRCLibEnabled {
			chain = removeSource(chain, "lrclib")
		}
	}

	var fallback *LyricsPayload
	for _, source := range chain {
		candidates, err := SearchCandidates(client, settings, keyword, durationMS, []string{source})
		if err != nil || len(candidates) == 0 {
			continue
		}
		payload, err := FetchCandidate(client, settings, candidates[0])
		if err != nil {
			continue
		}
		if strings.TrimSpace(payload.LRCText) == "" {
			continue
		}
		if len(payload.WordLines) > 0 {
			return &payload, nil
		}
		if fallback == nil {
			copyPayload := payload
			fallback = &copyPayload
		}
	}
	return fallback, nil
}

type neteaseHit struct {
	ID         int64
	Title      string
	Artist     string
	Album      string
	DurationMS int64
}

type lrclibHit struct {
	ID         int64
	Title      string
	Artist     string
	Album      string
	DurationMS int64
}

func neteaseSearchHits(client *http.Client, keyword string, limit int) ([]neteaseHit, error) {
	values := url.Values{}
	values.Set("s", strings.TrimSpace(keyword))
	values.Set("type", "1")
	values.Set("limit", strconv.Itoa(limit))
	request, err := http.NewRequest(http.MethodGet, "https://music.163.com/api/search/get/web?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	applyNeteasePortalHeaders(request)
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("netease search http %d", response.StatusCode)
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if code, ok := numberValue(pointerValue(payload, "/code")); ok && code != 200 {
		return []neteaseHit{}, nil
	}

	items := arrayAt(payload, "/result/songs")
	out := make([]neteaseHit, 0, len(items))
	for _, item := range items {
		id, ok := numberValue(pointerValue(item, "/id"))
		if !ok || id <= 0 {
			continue
		}
		title := stringValue(pointerValue(item, "/name"))
		album := stringValue(pointerValue(item, "/al/name"))
		artists := arrayAt(item, "/ar")
		artistNames := make([]string, 0, len(artists))
		for _, artist := range artists {
			name := strings.TrimSpace(stringValue(pointerValue(artist, "/name")))
			if name != "" {
				artistNames = append(artistNames, name)
			}
		}
		out = append(out, neteaseHit{
			ID:         id,
			Title:      title,
			Artist:     strings.Join(artistNames, " / "),
			Album:      album,
			DurationMS: int64Value(pointerValue(item, "/dt")),
		})
	}
	return out, nil
}

func lrclibSearchHits(client *http.Client, keyword string, durationMS *int64) ([]lrclibHit, error) {
	request, err := http.NewRequest(http.MethodGet, "https://lrclib.net/api/search", nil)
	if err != nil {
		return nil, err
	}
	values := request.URL.Query()
	values.Set("q", keyword)
	request.URL.RawQuery = values.Encode()

	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("lrclib search http %d", response.StatusCode)
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	items, ok := payload.([]any)
	if !ok {
		items = arrayAt(payload, "/results")
	}

	out := make([]lrclibHit, 0, len(items))
	for _, item := range items {
		id, ok := numberValue(pointerValue(item, "/id"))
		if !ok || id <= 0 {
			continue
		}
		dms := int64(floatValue(pointerValue(item, "/duration")) * 1000)
		if durationMS != nil && *durationMS > 0 && dms > 0 && absInt64(*durationMS-dms) > 12_000 {
			continue
		}
		out = append(out, lrclibHit{
			ID:         id,
			Title:      stringValue(pointerValue(item, "/trackName")),
			Artist:     stringValue(pointerValue(item, "/artistName")),
			Album:      stringValue(pointerValue(item, "/albumName")),
			DurationMS: dms,
		})
		if len(out) >= 20 {
			break
		}
	}
	return out, nil
}

func fetchNeteaseLyricsBySongID(client *http.Client, apiBase string, songID int64) (*LyricsPayload, error) {
	base := strings.TrimSpace(strings.TrimRight(apiBase, "/"))
	if base != "" {
		if payload, err := lyricNeteaseAPILyricNew(client, base, songID); err == nil && payload != nil {
			return payload, nil
		}

		values := url.Values{}
		values.Set("id", strconv.FormatInt(songID, 10))
		request, err := http.NewRequest(http.MethodGet, base+"/lyric?"+values.Encode(), nil)
		if err == nil {
			response, err := client.Do(request)
			if err == nil {
				defer response.Body.Close()
				if response.StatusCode >= 200 && response.StatusCode < 300 {
					var payload any
					if err := json.NewDecoder(response.Body).Decode(&payload); err == nil {
						if lyric := lrcLineFromNeteaseLyricValue(payload); looksLikeLRC(lyric) {
							result := lineOnlyPayload(lyric)
							return &result, nil
						}
					}
				}
			}
		}
	}

	values := url.Values{}
	values.Set("id", strconv.FormatInt(songID, 10))
	values.Set("lv", "-1")
	values.Set("kv", "-1")
	values.Set("tv", "-1")
	request, err := http.NewRequest(http.MethodGet, "https://music.163.com/api/song/lyric?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	applyNeteasePortalHeaders(request)
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, nil
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if lyric := lrcLineFromNeteaseLyricValue(payload); looksLikeLRC(lyric) {
		result := lineOnlyPayload(lyric)
		return &result, nil
	}
	return nil, nil
}

func lyricNeteaseAPILyricNew(client *http.Client, apiBase string, songID int64) (*LyricsPayload, error) {
	values := url.Values{}
	values.Set("id", strconv.FormatInt(songID, 10))
	request, err := http.NewRequest(http.MethodGet, apiBase+"/lyric/new?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, nil
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if raw := yrcRawFromLyricNewJSON(payload); raw != "" {
		if result := parseYRCBody(raw); result != nil {
			return result, nil
		}
	}
	if lyric := lrcLineFromNeteaseLyricValue(payload); looksLikeLRC(lyric) {
		result := lineOnlyPayload(lyric)
		return &result, nil
	}
	return nil, nil
}

func fetchLRCLibByID(client *http.Client, lrclibID int64) (*LyricsPayload, error) {
	request, err := http.NewRequest(http.MethodGet, fmt.Sprintf("https://lrclib.net/api/get/%d", lrclibID), nil)
	if err != nil {
		return nil, err
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, nil
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if value := strings.TrimSpace(stringValue(pointerValue(payload, "/syncedLyrics"))); looksLikeLRC(value) {
		result := lineOnlyPayload(value)
		return &result, nil
	}
	if value := strings.TrimSpace(stringValue(pointerValue(payload, "/plainLyrics"))); looksLikeLRC(value) {
		result := lineOnlyPayload(value)
		return &result, nil
	}
	return nil, nil
}

func applyNeteasePortalHeaders(request *http.Request) {
	request.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	request.Header.Set("Referer", "https://music.163.com/")
	request.Header.Set("Accept", "application/json, text/plain, */*")
}

func defaultLyricSources() []string {
	return []string{"qq", "kugou", "netease", "lrclib"}
}

func parseProviderOrder(value string) []string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" || normalized == "pjmp3,netease,lrclib" {
		return defaultLyricSources()
	}

	out := make([]string, 0, 4)
	seen := map[string]struct{}{}
	for _, part := range strings.Split(normalized, ",") {
		source := strings.TrimSpace(part)
		switch source {
		case "qq", "kugou", "netease", "lrclib":
			if _, ok := seen[source]; ok {
				continue
			}
			seen[source] = struct{}{}
			out = append(out, source)
		}
	}
	if len(out) == 0 {
		return defaultLyricSources()
	}
	return out
}

func normalizeSourceList(sources []string) []string {
	out := make([]string, 0, len(sources))
	seen := map[string]struct{}{}
	for _, source := range sources {
		normalized := strings.ToLower(strings.TrimSpace(source))
		switch normalized {
		case "qq", "kugou", "netease", "lrclib":
			if _, ok := seen[normalized]; ok {
				continue
			}
			seen[normalized] = struct{}{}
			out = append(out, normalized)
		}
	}
	return out
}

func removeSource(sources []string, source string) []string {
	target := strings.ToLower(strings.TrimSpace(source))
	out := make([]string, 0, len(sources))
	for _, item := range sources {
		if strings.ToLower(strings.TrimSpace(item)) == target {
			continue
		}
		out = append(out, item)
	}
	return out
}

func candidateIDInt64(id string, fallback *int64) (int64, bool) {
	if fallback != nil && *fallback > 0 {
		return *fallback, true
	}
	value, err := strconv.ParseInt(strings.TrimSpace(id), 10, 64)
	return value, err == nil && value > 0
}

func derefInt64(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

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
	return &LyricsPayload{
		LRCText:   strings.Join(lines, "\n"),
		WordLines: wordLines,
	}
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

func pointerValue(root any, path string) any {
	current := root
	for _, part := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		if part == "" {
			continue
		}
		switch typed := current.(type) {
		case map[string]any:
			current = typed[part]
		case []any:
			index, err := strconv.Atoi(part)
			if err != nil || index < 0 || index >= len(typed) {
				return nil
			}
			current = typed[index]
		default:
			return nil
		}
	}
	return current
}

func arrayAt(root any, path string) []any {
	value := pointerValue(root, path)
	items, _ := value.([]any)
	return items
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case json.Number:
		return typed.String()
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case float32:
		return strconv.FormatInt(int64(typed), 10)
	case int:
		return strconv.Itoa(typed)
	case int64:
		return strconv.FormatInt(typed, 10)
	case int32:
		return strconv.FormatInt(int64(typed), 10)
	case uint64:
		return strconv.FormatUint(typed, 10)
	case uint32:
		return strconv.FormatUint(uint64(typed), 10)
	default:
		return ""
	}
}

func numberValue(value any) (int64, bool) {
	switch typed := value.(type) {
	case int64:
		return typed, true
	case int:
		return int64(typed), true
	case float64:
		return int64(typed), true
	case float32:
		return int64(typed), true
	case json.Number:
		parsed, err := typed.Int64()
		if err == nil {
			return parsed, true
		}
	case string:
		parsed, err := strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
		if err == nil {
			return parsed, true
		}
	}
	return 0, false
}

func int64Value(value any) int64 {
	result, _ := numberValue(value)
	return result
}

func floatValue(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int64:
		return float64(typed)
	case int:
		return float64(typed)
	case json.Number:
		parsed, err := typed.Float64()
		if err == nil {
			return parsed
		}
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err == nil {
			return parsed
		}
	}
	return 0
}

func absInt64(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}
