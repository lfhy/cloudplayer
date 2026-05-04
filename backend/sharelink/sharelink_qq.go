package sharelink

import (
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"cloudplayer/backend/importplaylist"
)

// QQ helpers resolve mobile share links and convert playlist payloads into import tracks.
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

	tracks := make([]importplaylist.ImportedTrackDTO, 0, len(arrayValue(playlist["songlist"])))
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

func songFromQQ(item any) (importplaylist.ImportedTrackDTO, bool) {
	track := importplaylist.ImportedTrackDTO{}
	data := mapValue(item)
	title := strings.TrimSpace(stringValue(firstNonNil(data["songname"], data["title"])))
	if title == "" {
		return track, false
	}
	track.Title = title
	artists := make([]string, 0, len(arrayValue(data["singer"])))
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

func qqHeaders() map[string]string {
	return map[string]string{
		"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Referer":         qqReferer,
		"Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		"Accept-Language": "zh-CN,zh;q=0.9",
	}
}
