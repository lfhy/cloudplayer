package sharelink

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"cloudplayer/backend/importplaylist"
)

// Netease helpers handle share-link expansion and playlist fetch sequencing.
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

	tracks, err := neteasePlaylistTracks(client, playlist)
	if err != nil {
		return "", nil, err
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
