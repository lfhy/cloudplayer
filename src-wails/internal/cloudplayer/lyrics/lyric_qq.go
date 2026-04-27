package lyrics

import (
	"bytes"
	"compress/zlib"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
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

func playLyricParamQRC(hit qqSearchHit) map[string]any {
	durationSeconds := hit.DurationMS / 1000
	if durationSeconds <= 0 {
		durationSeconds = 1
	}
	return map[string]any{
		"albumName":  base64.StdEncoding.EncodeToString([]byte(hit.Album)),
		"crypt":      1,
		"ct":         19,
		"cv":         2111,
		"interval":   durationSeconds,
		"lrc_t":      0,
		"qrc":        1,
		"qrc_t":      0,
		"roma":       1,
		"roma_t":     0,
		"singerName": base64.StdEncoding.EncodeToString([]byte(hit.Artist)),
		"songID":     hit.SongID,
		"songName":   base64.StdEncoding.EncodeToString([]byte(hit.Title)),
		"trans":      1,
		"trans_t":    0,
		"type":       0,
	}
}

func playLyricParamLineLRC(hit qqSearchHit) map[string]any {
	durationSeconds := hit.DurationMS / 1000
	if durationSeconds <= 0 {
		durationSeconds = 1
	}
	return map[string]any{
		"albumName":  base64.StdEncoding.EncodeToString([]byte(hit.Album)),
		"crypt":      0,
		"interval":   durationSeconds,
		"lrc_t":      1,
		"qrc":        0,
		"qrc_t":      0,
		"singerName": base64.StdEncoding.EncodeToString([]byte(hit.Artist)),
		"songID":     hit.SongID,
		"songName":   base64.StdEncoding.EncodeToString([]byte(hit.Title)),
		"trans":      0,
		"trans_t":    0,
		"type":       0,
	}
}

func looksLikeHexCiphertext(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || len(trimmed) < 16 || len(trimmed)%2 != 0 {
		return false
	}
	for _, ch := range trimmed {
		if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) {
			return false
		}
	}
	return true
}

func qrcDecryptHex(encryptedHex string) (string, error) {
	trimmed := strings.TrimSpace(encryptedHex)
	if trimmed == "" {
		return "", fmt.Errorf("empty qrc")
	}
	buf, err := hex.DecodeString(trimmed)
	if err != nil {
		return "", fmt.Errorf("hex decode: %w", err)
	}
	if len(buf)%8 != 0 {
		return "", fmt.Errorf("qrc len not multiple of 8: %d", len(buf))
	}

	des := newQRCTripleDESDecrypt(qqQRCKey)
	dec := make([]byte, 0, len(buf))
	for offset := 0; offset < len(buf); offset += 8 {
		block := des.decryptBlock(buf[offset : offset+8])
		dec = append(dec, block[:]...)
	}

	reader, err := zlib.NewReader(bytes.NewReader(dec))
	if err != nil {
		return "", fmt.Errorf("zlib: %w", err)
	}
	defer reader.Close()
	out, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("zlib read: %w", err)
	}
	return string(out), nil
}

func tryDecodeLyricContent(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	bytesValue, err := base64.StdEncoding.DecodeString(trimmed)
	if err == nil {
		decoded := string(bytesValue)
		if strings.Contains(decoded, "[") || strings.Contains(decoded, "<") {
			return decoded
		}
	}
	return trimmed
}

func extractYRCBody(value string) string {
	groups := qqYRCBodyRE.FindStringSubmatch(value)
	if len(groups) < 2 {
		return ""
	}
	return groups[1]
}

func qrcPlainToPayload(value string) *LyricsPayload {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	if payload := tryLDDCQQLyricsPlain(trimmed); payload != nil {
		return payload
	}
	if body := strings.TrimSpace(extractYRCBody(trimmed)); body != "" {
		if payload := tryLDDCQQLyricsPlain(body); payload != nil {
			return payload
		}
	}
	if groups := qqLyricContentAttrRE.FindStringSubmatch(trimmed); len(groups) >= 2 {
		decoded := tryDecodeLyricContent(groups[1])
		if payload := qrcPlainToPayload(decoded); payload != nil {
			return payload
		}
		if looksLikeLRC(decoded) {
			payload := lineOnlyPayload(decoded)
			return &payload
		}
	}
	if groups := qqCDATARE.FindStringSubmatch(trimmed); len(groups) >= 2 {
		inner := groups[1]
		if payload := qrcPlainToPayload(inner); payload != nil {
			return payload
		}
		if looksLikeLRC(inner) {
			payload := lineOnlyPayload(inner)
			return &payload
		}
	}
	return nil
}

func payloadFromPlayLyricData(data any) (LyricsPayload, error) {
	lyric := strings.TrimSpace(stringValue(pointerValue(data, "/lyric")))
	if lyric == "" {
		return LyricsPayload{}, fmt.Errorf("qq: empty lyric field")
	}

	if looksLikeHexCiphertext(lyric) {
		plain, err := qrcDecryptHex(lyric)
		if err == nil {
			if payload := qrcPlainToPayload(plain); payload != nil {
				if len(payload.WordLines) > 0 {
					return *payload, nil
				}
				if payload2 := tryParseQRCInnerBodyPub(plain); payload2 != nil && len(payload2.WordLines) > 0 {
					return *payload2, nil
				}
				return *payload, nil
			}
			packed := packLyricsForUI(plain)
			if looksLikeLRC(packed) {
				return lineOnlyPayload(packed), nil
			}
			return lineOnlyPayload(plain), nil
		}
	}

	decoded := tryDecodeLyricContent(lyric)
	if payload := tryLDDCQQLyricsPlain(decoded); payload != nil {
		return *payload, nil
	}
	packed := packLyricsForUI(decoded)
	if looksLikeLRC(packed) {
		return lineOnlyPayload(packed), nil
	}
	return LyricsPayload{}, fmt.Errorf("qq: could not parse lyric body")
}

func fetchQqLyrics(client *http.Client, hit qqSearchHit) (LyricsPayload, error) {
	comm, err := qqCommWithSession(client)
	if err != nil {
		return LyricsPayload{}, err
	}

	if data, err := qqMusicu(client, comm, "GetPlayLyricInfo", "music.musichallSong.PlayLyricInfo", playLyricParamQRC(hit)); err == nil {
		if payload, err := payloadFromPlayLyricData(data); err == nil {
			return payload, nil
		}
	}

	data, err := qqMusicu(client, comm, "GetPlayLyricInfo", "music.musichallSong.PlayLyricInfo", playLyricParamLineLRC(hit))
	if err != nil {
		return LyricsPayload{}, err
	}
	return payloadFromPlayLyricData(data)
}
