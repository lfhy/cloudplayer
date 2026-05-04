package lyrics

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const qqMusicuURL = "https://u.y.qq.com/cgi-bin/musicu.fcg"

var (
	qqQRCKey             = []byte("!@#)(*$%123ZXC!@!@#)(NHL")
	qqYRCBodyRE          = regexp.MustCompile(`(?s)<Lyric[^>]*>(.*)</Lyric>`)
	qqCDATARE            = regexp.MustCompile(`(?s)<!\[CDATA\[(.*?)\]\]>`)
	qqLyricContentAttrRE = regexp.MustCompile(`LyricContent\s*=\s*"([^"]*)"`)
)

// QQ musicu client helpers keep request/session behavior separate from lyric decoding.
type qqSearchHit struct {
	SongID     int64
	SongMid    string
	Title      string
	Artist     string
	Album      string
	DurationMS int64
}

func qqHeaders() http.Header {
	headers := make(http.Header)
	headers.Set("Cookie", "tmeLoginType=-1;")
	headers.Set("Content-Type", "application/json")
	headers.Set("User-Agent", "okhttp/3.14.9")
	return headers
}

func qqCommBase() map[string]any {
	return map[string]any{
		"ct":        11,
		"cv":        "1003006",
		"v":         "1003006",
		"os_ver":    "15",
		"phonetype": "24122RKC7C",
		"rom":       "Redmi/miro/miro:15/AE3A.240806.005/OS2.0.105.0.VOMCNXM:user/release-keys",
		"tmeAppID":  "qqmusiclight",
		"nettype":   "NETWORK_WIFI",
		"udid":      "0",
	}
}

func qqMusicu(client *http.Client, comm map[string]any, method, module string, param any) (any, error) {
	body, err := json.Marshal(map[string]any{
		"comm": comm,
		"request": map[string]any{
			"method": method,
			"module": module,
			"param":  param,
		},
	})
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequest(http.MethodPost, qqMusicuURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header = qqHeaders()

	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("qq http %d", response.StatusCode)
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	code, _ := numberValue(pointerValue(payload, "/code"))
	reqCode, _ := numberValue(pointerValue(payload, "/request/code"))
	if code != 0 || reqCode != 0 {
		return nil, fmt.Errorf("qq api code %d request %d", code, reqCode)
	}
	data := pointerValue(payload, "/request/data")
	if data == nil {
		return nil, fmt.Errorf("qq: missing request.data")
	}
	return data, nil
}

func qqCommWithSession(client *http.Client) (map[string]any, error) {
	data, err := qqMusicu(client, qqCommBase(), "GetSession", "music.getSession.session", map[string]any{
		"caller": 0,
		"uid":    "0",
		"vkey":   0,
	})
	if err != nil {
		return nil, err
	}
	session, ok := pointerValue(data, "/session").(map[string]any)
	if !ok {
		return nil, fmt.Errorf("qq: no session")
	}
	comm := qqCommBase()
	comm["uid"] = session["uid"]
	comm["sid"] = session["sid"]
	comm["userip"] = session["userip"]
	return comm, nil
}

func searchQqSongs(client *http.Client, keyword string, page int) ([]qqSearchHit, error) {
	comm, err := qqCommWithSession(client)
	if err != nil {
		return nil, err
	}
	ts := time.Now().UnixMilli()
	searchID := strconv.FormatInt(rand.New(rand.NewSource(time.Now().UnixNano())).Int63n(1_000_000_000_000_000_000)+(ts%86_400_000)*1_000_000, 10)
	param := map[string]any{
		"search_id":    searchID,
		"remoteplace":  "search.android.keyboard",
		"query":        strings.TrimSpace(keyword),
		"search_type":  0,
		"num_per_page": 20,
		"page_num":     page,
		"highlight":    0,
		"nqc_flag":     0,
		"page_id":      1,
		"grp":          1,
	}
	data, err := qqMusicu(client, comm, "DoSearchForQQMusicLite", "music.search.SearchCgiService", param)
	if err != nil {
		return nil, err
	}

	items := arrayAt(data, "/body/item_song")
	out := make([]qqSearchHit, 0, len(items))
	for _, item := range items {
		id := int64Value(pointerValue(item, "/id"))
		if id <= 0 {
			continue
		}
		artists := arrayAt(item, "/singer")
		artistNames := make([]string, 0, len(artists))
		for _, artist := range artists {
			name := strings.TrimSpace(stringValue(pointerValue(artist, "/name")))
			if name != "" {
				artistNames = append(artistNames, name)
			}
		}
		out = append(out, qqSearchHit{
			SongID:     id,
			SongMid:    stringValue(pointerValue(item, "/mid")),
			Title:      stringValue(pointerValue(item, "/title")),
			Artist:     strings.Join(artistNames, " / "),
			Album:      stringValue(pointerValue(item, "/album/name")),
			DurationMS: int64Value(pointerValue(item, "/interval")) * 1000,
		})
	}
	return out, nil
}
