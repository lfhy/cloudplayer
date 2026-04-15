package sharelink

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"cloudplayer/internal/cloudplayer/importplaylist"
)

const (
	neteaseReferer = "https://music.163.com/"
	qqReferer      = "https://y.qq.com/"
)

var (
	reFirstURL          = regexp.MustCompile(`https?://[^\s<>"']+`)
	reNeteaseQueryID    = regexp.MustCompile(`[?&]id=(\d+)`)
	reNeteasePathID     = regexp.MustCompile(`/playlist[/?](\d+)`)
	reQQIDFallback      = regexp.MustCompile(`[?&]id=(\d+)`)
	reQQPlaylistPath    = regexp.MustCompile(`/playlist/(\d+)`)
	reQQPlaylistPathAlt = regexp.MustCompile(`(?i)playlist[/_](\d+)`)
)

type FetchOptions struct {
	NeteaseCookieEnabled bool
	NeteaseCookie        string
}

func FetchPlaylistFromShareURL(client *http.Client, rawURL string, options FetchOptions) (string, []importplaylist.ImportedTrackDTO, error) {
	value := strings.TrimSpace(rawURL)
	if value == "" {
		return "", nil, fmt.Errorf("链接为空")
	}
	normalized := value
	if !strings.HasPrefix(normalized, "http://") && !strings.HasPrefix(normalized, "https://") {
		if match := reFirstURL.FindString(normalized); match != "" {
			normalized = match
		}
	}

	switch DetectPlatform(normalized) {
	case "netease":
		return fetchNeteasePlaylist(client, normalized, options)
	case "qq":
		return fetchQQPlaylist(client, normalized)
	default:
		return "", nil, fmt.Errorf("暂只支持网易云音乐、QQ 音乐的分享链接（music.163.com / y.qq.com）。")
	}
}

func DetectPlatform(value string) string {
	lower := strings.ToLower(value)
	switch {
	case strings.Contains(lower, "163.com"), strings.Contains(lower, "163cn"), strings.Contains(lower, "music.163"):
		return "netease"
	case strings.Contains(lower, "qq.com"):
		return "qq"
	default:
		return ""
	}
}

func fetchNeteasePlaylist(client *http.Client, rawURL string, options FetchOptions) (string, []importplaylist.ImportedTrackDTO, error) {
	var cookie string
	if options.NeteaseCookieEnabled {
		cookie = options.NeteaseCookie
	}
	resolved, err := resolveNeteaseShareURL(client, rawURL, cookie)
	if err != nil {
		return "", nil, err
	}
	playlistID := extractNeteasePlaylistID(resolved)
	if playlistID == "" {
		return "", nil, fmt.Errorf("无法从链接中识别网易云歌单 id（请使用 music.163.com 歌单分享链接）。")
	}

	var payload map[string]any
	for _, endpoint := range []string{
		"https://music.163.com/api/playlist/detail",
		"https://music.163.com/api/v6/playlist/detail",
	} {
		values := url.Values{}
		values.Set("id", playlistID)
		values.Set("n", "100000")
		values.Set("s", "0")
		request, err := http.NewRequest(http.MethodGet, endpoint+"?"+values.Encode(), nil)
		if err != nil {
			return "", nil, err
		}
		applyHeaders(request, neteaseHeaders(cookie))
		body, status, err := doRequest(client, request, 60*time.Second)
		if err != nil {
			return "", nil, err
		}
		var decoded map[string]any
		if err := json.Unmarshal(body, &decoded); err != nil {
			return "", nil, fmt.Errorf("网易云返回非 JSON：%w", err)
		}
		if intValue(decoded["code"]) == 200 && status >= 200 && status < 300 {
			payload = decoded
			break
		}
	}
	if payload == nil {
		return "", nil, fmt.Errorf("网易云接口错误：playlist/detail 未返回成功")
	}

	playlist := mapValue(payload["playlist"])
	if len(playlist) == 0 {
		playlist = mapValue(payload["result"])
	}
	name := strings.TrimSpace(stringValue(playlist["name"]))
	if name == "" {
		name = "未命名歌单"
	}

	var tracks []importplaylist.ImportedTrackDTO
	for _, item := range arrayValue(playlist["tracks"]) {
		if track, ok := trackFromNeteaseItem(item); ok {
			tracks = append(tracks, track)
		}
	}
	if len(tracks) == 0 {
		ids := collectTrackIDs(playlist["trackIds"])
		if len(ids) > 0 {
			tracks, err = neteaseSongDetailBatch(client, ids)
			if err != nil {
				return "", nil, err
			}
		}
	}

	if len(tracks) == 0 {
		pageReq, err := http.NewRequest(http.MethodGet, "https://music.163.com/playlist?id="+playlistID, nil)
		if err != nil {
			return "", nil, err
		}
		applyHeaders(pageReq, neteaseHeaders(cookie))
		if body, _, err := doRequest(client, pageReq, 45*time.Second); err == nil {
			html := strings.ToLower(string(body))
			if strings.Contains(html, "login-list") ||
				strings.Contains(html, "forcelogin=true") ||
				strings.Contains(html, "degrade") ||
				strings.Contains(html, "请登录") {
				return "", nil, fmt.Errorf("该网易云歌单当前需要登录后访问（或开启了隐私限制），请在浏览器登录后复制公开歌单链接再试。")
			}
		}
		return "", nil, fmt.Errorf("歌单为空或接口未返回曲目（可能是隐私歌单、需登录，或接口风控）。")
	}

	return name, tracks, nil
}

func fetchQQPlaylist(client *http.Client, rawURL string) (string, []importplaylist.ImportedTrackDTO, error) {
	resolved, err := resolveQQShareURL(client, rawURL)
	if err != nil {
		return "", nil, err
	}
	disstid := extractQQDisstid(resolved)
	if disstid == "" {
		return "", nil, fmt.Errorf("无法从链接中识别 QQ 音乐歌单 id。")
	}

	values := url.Values{}
	for key, value := range map[string]string{
		"type":        "1",
		"json":        "1",
		"utf8":        "1",
		"onlysong":    "0",
		"new_format":  "1",
		"disstid":     disstid,
		"format":      "json",
		"inCharset":   "utf8",
		"outCharset":  "utf-8",
		"notice":      "0",
		"platform":    "yqq.json",
		"needNewCode": "0",
		"g_tk":        "5381",
		"loginUin":    "0",
		"hostUin":     "0",
	} {
		values.Set(key, value)
	}
	request, err := http.NewRequest(http.MethodGet, "https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?"+values.Encode(), nil)
	if err != nil {
		return "", nil, err
	}
	applyHeaders(request, qqHeaders())
	body, _, err := doRequest(client, request, 60*time.Second)
	if err != nil {
		return "", nil, err
	}
	payload, err := parseJSONPOrJSON(string(body))
	if err != nil {
		return "", nil, fmt.Errorf("QQ 音乐返回无法解析：%w", err)
	}
	cdlist := arrayValue(payload["cdlist"])
	playlist := mapValue(firstAny(cdlist))
	name := strings.TrimSpace(stringValue(playlist["dissname"]))
	if name == "" {
		name = strings.TrimSpace(stringValue(playlist["diss_name"]))
	}
	if name == "" {
		name = "未命名歌单"
	}

	var tracks []importplaylist.ImportedTrackDTO
	for _, item := range arrayValue(playlist["songlist"]) {
		if track, ok := songFromQQ(item); ok {
			tracks = append(tracks, track)
		}
	}
	if len(tracks) == 0 {
		return "", nil, fmt.Errorf("歌单曲目为空或接口限制。")
	}
	return name, tracks, nil
}

func resolveNeteaseShareURL(client *http.Client, rawURL, cookie string) (string, error) {
	normalized := ensureURL(rawURL)
	if extractNeteasePlaylistID(normalized) != "" {
		return normalized, nil
	}

	request, err := http.NewRequest(http.MethodGet, normalized, nil)
	if err != nil {
		return "", err
	}
	applyHeaders(request, neteaseHeaders(cookie))
	body, finalURL, err := doRequestWithFinalURL(client, request, 45*time.Second)
	if err != nil {
		return "", err
	}
	if extractNeteasePlaylistID(finalURL) != "" {
		return finalURL, nil
	}
	for _, pattern := range []string{
		`"playlistId"\s*:\s*"?(\d+)"?`,
		`playlist\?id=(\d+)`,
		`/playlist/(\d+)`,
	} {
		re := regexp.MustCompile(pattern)
		if match := re.FindStringSubmatch(string(body)); len(match) > 1 {
			return "https://music.163.com/playlist?id=" + match[1], nil
		}
	}
	return normalized, nil
}

func resolveQQShareURL(client *http.Client, rawURL string) (string, error) {
	normalized := percentDecodeURL(ensureURL(rawURL))
	if extractQQDisstid(normalized) != "" {
		return normalized, nil
	}

	request, err := http.NewRequest(http.MethodGet, normalized, nil)
	if err != nil {
		return "", err
	}
	applyHeaders(request, qqHeaders())
	body, finalURL, err := doRequestWithFinalURL(client, request, 45*time.Second)
	if err != nil {
		return "", err
	}
	if disstid := extractQQDisstid(finalURL); disstid != "" {
		return finalURL, nil
	}

	html := string(body)
	for _, pattern := range []string{
		`"dissid"\s*:\s*"?(\d+)"?`,
		`"disstid"\s*:\s*"?(\d+)"?`,
		`"tid"\s*:\s*"?(\d+)"?\s*,\s*"dirid"`,
		`dissid=(\d+)`,
		`disstid=(\d+)`,
		`/n/ryqq/playlist/(\d+)`,
		`ryqq/pl/(\d+)`,
		`/playlist/(\d+)(?:\?|$|/)`,
		`playlistId=(\d+)`,
		`songlistid=(\d+)`,
	} {
		re := regexp.MustCompile(pattern)
		if match := re.FindStringSubmatch(html); len(match) > 1 {
			return "https://y.qq.com/n/ryqq/playlist/" + match[1], nil
		}
	}

	if parsed, err := url.Parse(finalURL); err == nil {
		if fragment := parsed.Fragment; strings.Contains(fragment, "id=") {
			queryPart := fragment
			if index := strings.LastIndex(fragment, "?"); index >= 0 {
				queryPart = fragment[index+1:]
			}
			for _, pair := range strings.Split(queryPart, "&") {
				key, value, ok := strings.Cut(pair, "=")
				if !ok {
					continue
				}
				if (key == "id" || key == "dissid" || key == "disstid") && allDigits(value) {
					return "https://y.qq.com/n/ryqq/playlist/" + value, nil
				}
			}
		}
	}

	return "", fmt.Errorf("无法解析 QQ 音乐短链（页面结构可能更新）。请在浏览器打开该链接，从地址栏复制带 playlist 数字 id 的长链接后再粘贴。")
}

func neteaseSongDetailBatch(client *http.Client, ids []int64) ([]importplaylist.ImportedTrackDTO, error) {
	var result []importplaylist.ImportedTrackDTO
	for start := 0; start < len(ids); start += 500 {
		end := start + 500
		if end > len(ids) {
			end = len(ids)
		}
		chunk := ids[start:end]
		idStrings := make([]string, 0, len(chunk))
		for _, id := range chunk {
			idStrings = append(idStrings, fmt.Sprintf("%d", id))
		}
		request, err := http.NewRequest(http.MethodGet, "https://music.163.com/api/song/detail?ids=["+strings.Join(idStrings, ",")+"]", nil)
		if err != nil {
			return nil, err
		}
		applyHeaders(request, neteaseHeaders(""))
		body, _, err := doRequest(client, request, 60*time.Second)
		if err != nil {
			return nil, err
		}
		payload := map[string]any{}
		if err := json.Unmarshal(body, &payload); err != nil {
			return nil, err
		}
		songs := arrayValue(payload["songs"])
		if len(songs) == 0 {
			songs = arrayValue(payload["data"])
		}
		for _, song := range songs {
			if track, ok := trackFromNeteaseItem(song); ok {
				result = append(result, track)
			}
		}
	}
	if len(result) > 0 {
		return result, nil
	}

	for start := 0; start < len(ids); start += 500 {
		end := start + 500
		if end > len(ids) {
			end = len(ids)
		}
		chunk := ids[start:end]
		var entries []string
		for _, id := range chunk {
			entries = append(entries, fmt.Sprintf(`{"id":%d}`, id))
		}
		form := url.Values{}
		form.Set("c", "["+strings.Join(entries, ",")+"]")
		request, err := http.NewRequest(http.MethodPost, "https://music.163.com/api/v3/song/detail", strings.NewReader(form.Encode()))
		if err != nil {
			return nil, err
		}
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		applyHeaders(request, neteaseHeaders(""))
		body, _, err := doRequest(client, request, 60*time.Second)
		if err != nil {
			return nil, err
		}
		payload := map[string]any{}
		if err := json.Unmarshal(body, &payload); err != nil {
			return nil, err
		}
		songs := arrayValue(payload["songs"])
		if len(songs) == 0 {
			songs = arrayValue(payload["data"])
		}
		for _, song := range songs {
			if track, ok := trackFromNeteaseItem(song); ok {
				result = append(result, track)
			}
		}
	}
	return result, nil
}

func trackFromNeteaseItem(item any) (importplaylist.ImportedTrackDTO, bool) {
	track := importplaylist.ImportedTrackDTO{}
	data := mapValue(item)
	name := strings.TrimSpace(stringValue(data["name"]))
	if name == "" {
		return track, false
	}
	track.Title = name
	var artists []string
	for _, artist := range arrayValue(data["ar"]) {
		name := strings.TrimSpace(stringValue(mapValue(artist)["name"]))
		if name != "" {
			artists = append(artists, name)
		}
	}
	track.Artist = strings.Join(artists, "/")
	album := mapValue(data["al"])
	track.Album = strings.TrimSpace(stringValue(album["name"]))
	if track.Album == "" {
		track.Album = strings.TrimSpace(stringValue(data["album"]))
	}
	return track, true
}

func collectTrackIDs(value any) []int64 {
	var result []int64
	for _, item := range arrayValue(value) {
		object := mapValue(item)
		for _, key := range []string{"id", "songId", "song_id"} {
			if id := intValue(object[key]); id > 0 {
				result = append(result, id)
				break
			}
		}
	}
	return result
}

func songFromQQ(item any) (importplaylist.ImportedTrackDTO, bool) {
	track := importplaylist.ImportedTrackDTO{}
	data := mapValue(item)
	title := strings.TrimSpace(stringValue(firstNonNil(data["songname"], data["title"])))
	if title == "" {
		return track, false
	}
	track.Title = title
	var artists []string
	for _, singer := range arrayValue(data["singer"]) {
		name := strings.TrimSpace(stringValue(mapValue(singer)["name"]))
		if name != "" {
			artists = append(artists, name)
		}
	}
	track.Artist = strings.Join(artists, "/")
	track.Album = strings.TrimSpace(stringValue(firstNonNil(data["albumname"], data["album_name"])))
	if track.Album == "" {
		album := mapValue(data["album"])
		track.Album = strings.TrimSpace(stringValue(firstNonNil(album["name"], album["title"])))
	}
	return track, true
}

func extractNeteasePlaylistID(raw string) string {
	value := ensureURL(raw)
	if parsed, err := url.Parse(value); err == nil {
		for key, values := range parsed.Query() {
			if key == "id" && len(values) > 0 && values[0] != "" {
				return values[0]
			}
		}
		if match := reNeteasePathID.FindStringSubmatch(parsed.Path); len(match) > 1 {
			return match[1]
		}
		if fragment := parsed.Fragment; fragment != "" {
			queryPart := fragment
			if index := strings.LastIndex(fragment, "?"); index >= 0 {
				queryPart = fragment[index+1:]
			}
			for _, pair := range strings.Split(queryPart, "&") {
				key, value, ok := strings.Cut(pair, "=")
				if ok && key == "id" && value != "" {
					return value
				}
			}
		}
	}
	match := reNeteaseQueryID.FindStringSubmatch(raw)
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

func extractQQDisstid(raw string) string {
	value := percentDecodeURL(strings.TrimSpace(raw))
	parsed, err := url.Parse(ensureURL(value))
	if err == nil {
		for _, key := range []string{"id", "disstid", "playlistId", "songlistid"} {
			if current := parsed.Query().Get(key); current != "" {
				return current
			}
		}
		for _, re := range []*regexp.Regexp{reQQPlaylistPath, reQQPlaylistPathAlt} {
			if match := re.FindStringSubmatch(parsed.Path); len(match) > 1 {
				return match[1]
			}
		}
	}
	match := reQQIDFallback.FindStringSubmatch(raw)
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

func parseJSONPOrJSON(text string) (map[string]any, error) {
	trimmed := strings.TrimSpace(text)
	switch {
	case strings.HasPrefix(trimmed, "MusicJsonCallback("):
		trimmed = strings.TrimPrefix(trimmed, "MusicJsonCallback(")
	case strings.HasPrefix(trimmed, "jsonCallback("):
		trimmed = strings.TrimPrefix(trimmed, "jsonCallback(")
	}
	trimmed = strings.TrimSuffix(trimmed, ");")
	trimmed = strings.TrimSuffix(trimmed, ")")
	result := map[string]any{}
	if err := json.Unmarshal([]byte(strings.TrimSpace(trimmed)), &result); err != nil {
		return nil, err
	}
	return result, nil
}

func neteaseHeaders(cookie string) map[string]string {
	headers := map[string]string{
		"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Referer":         neteaseReferer,
		"Accept":          "application/json, text/plain, */*",
		"Accept-Language": "zh-CN,zh;q=0.9",
	}
	if strings.TrimSpace(cookie) != "" {
		headers["Cookie"] = strings.TrimSpace(cookie)
	}
	return headers
}

func qqHeaders() map[string]string {
	return map[string]string{
		"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Referer":         qqReferer,
		"Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		"Accept-Language": "zh-CN,zh;q=0.9",
	}
}

func doRequest(client *http.Client, request *http.Request, timeout time.Duration) ([]byte, int, error) {
	ctx, cancel := withTimeout(request, timeout)
	defer cancel()
	response, err := client.Do(request.WithContext(ctx))
	if err != nil {
		return nil, 0, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(response.Body)
		if len(body) > 0 {
			return nil, response.StatusCode, fmt.Errorf("%s", strings.TrimSpace(string(body)))
		}
		return nil, response.StatusCode, fmt.Errorf("http %s", response.Status)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, response.StatusCode, err
	}
	return body, response.StatusCode, nil
}

func doRequestWithFinalURL(client *http.Client, request *http.Request, timeout time.Duration) ([]byte, string, error) {
	ctx, cancel := withTimeout(request, timeout)
	defer cancel()
	response, err := client.Do(request.WithContext(ctx))
	if err != nil {
		return nil, "", err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(response.Body)
		if len(body) > 0 {
			return nil, "", fmt.Errorf("%s", strings.TrimSpace(string(body)))
		}
		return nil, "", fmt.Errorf("http %s", response.Status)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, "", err
	}
	return body, response.Request.URL.String(), nil
}

func withTimeout(request *http.Request, timeout time.Duration) (context.Context, func()) {
	ctx, cancel := context.WithTimeout(request.Context(), timeout)
	return ctx, cancel
}

func applyHeaders(request *http.Request, headers map[string]string) {
	for key, value := range headers {
		if value != "" {
			request.Header.Set(key, value)
		}
	}
}

func ensureURL(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
		return value
	}
	return "https://" + value
}

func percentDecodeURL(value string) string {
	decoded, err := url.QueryUnescape(value)
	if err != nil {
		return value
	}
	return decoded
}

func mapValue(value any) map[string]any {
	if value == nil {
		return nil
	}
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	return nil
}

func arrayValue(value any) []any {
	if typed, ok := value.([]any); ok {
		return typed
	}
	return nil
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return fmt.Sprintf("%.0f", typed)
	case json.Number:
		return typed.String()
	case int64:
		return fmt.Sprintf("%d", typed)
	case int:
		return fmt.Sprintf("%d", typed)
	default:
		return ""
	}
}

func intValue(value any) int64 {
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case json.Number:
		result, _ := typed.Int64()
		return result
	case int64:
		return typed
	case int:
		return int64(typed)
	case string:
		if !allDigits(typed) {
			return 0
		}
		var result int64
		for _, r := range typed {
			result = result*10 + int64(r-'0')
		}
		return result
	default:
		return 0
	}
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

func firstAny(items []any) any {
	if len(items) == 0 {
		return nil
	}
	return items[0]
}

func firstNonNil(values ...any) any {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}
