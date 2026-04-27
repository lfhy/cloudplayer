package lyrics

import (
	"bytes"
	"compress/zlib"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	kgSignPrefix    = "LnT6xpN3khm36zse0QzvmgTZ3waWdRSA"
	kgComplexSearch = "https://complexsearch.kugou.com/v2/search/song"
)

var kgKRCKey = []byte("@Gaw^2tGQ61-\xce\xd2ni")

type kugouSearchHit struct {
	AlbumAudioID string
	FileHash     string
	Title        string
	Artist       string
	Album        string
	DurationMS   int64
}

func md5Hex(value string) string {
	sum := md5.Sum([]byte(value))
	return fmt.Sprintf("%x", sum)
}

func krcDecrypt(raw []byte) (string, error) {
	if len(raw) < 4 {
		return "", fmt.Errorf("krc too short")
	}
	dec := make([]byte, len(raw)-4)
	for idx, b := range raw[4:] {
		dec[idx] = b ^ kgKRCKey[idx%len(kgKRCKey)]
	}
	reader, err := zlib.NewReader(bytes.NewReader(dec))
	if err != nil {
		return "", err
	}
	defer reader.Close()
	out, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func kgMid() string {
	return md5Hex(strconv.FormatInt(time.Now().UnixMilli(), 10))
}

func kgHeaders(module string) http.Header {
	headers := make(http.Header)
	headers.Set("User-Agent", fmt.Sprintf("Android14-1070-11070-201-0-%s-wifi", module))
	headers.Set("KG-Rec", "1")
	headers.Set("KG-RC", "1")
	headers.Set("KG-CLIENTTIMEMS", strconv.FormatInt(time.Now().UnixMilli(), 10))
	return headers
}

func kgSignature(params map[string]string, body string) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var joined strings.Builder
	for _, key := range keys {
		joined.WriteString(key)
		joined.WriteByte('=')
		joined.WriteString(params[key])
	}
	return md5Hex(kgSignPrefix + joined.String() + body + kgSignPrefix)
}

func kgGet(client *http.Client, url string, extra map[string]string, module string, extraHeaderKey, extraHeaderValue string) (any, error) {
	mid := kgMid()
	params := map[string]string{
		"userid":       "0",
		"appid":        "3116",
		"token":        "",
		"clienttime":   strconv.FormatInt(time.Now().Unix(), 10),
		"iscorrection": "1",
		"uuid":         "-",
		"mid":          mid,
		"dfid":         "-",
		"clientver":    "11070",
		"platform":     "AndroidFilter",
	}
	for key, value := range extra {
		params[key] = value
	}
	params["signature"] = kgSignature(params, "")

	request, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	request.Header = kgHeaders(module)
	request.Header.Set("mid", mid)
	if extraHeaderKey != "" {
		request.Header.Set(extraHeaderKey, extraHeaderValue)
	}
	query := request.URL.Query()
	for key, value := range params {
		query.Set(key, value)
	}
	request.URL.RawQuery = query.Encode()

	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("kg http %d", response.StatusCode)
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	errorCode := int64Value(pointerValue(payload, "/error_code"))
	if errorCode != 0 && errorCode != 200 {
		message := stringValue(pointerValue(payload, "/error_msg"))
		if message == "" {
			message = "?"
		}
		return nil, fmt.Errorf("kg err %d: %s", errorCode, message)
	}
	return payload, nil
}

func kgLyricGet(client *http.Client, url string, extra map[string]string) (any, error) {
	mid := kgMid()
	params := map[string]string{
		"appid":     "3116",
		"clientver": "11070",
		"mid":       mid,
	}
	for key, value := range extra {
		params[key] = value
	}
	params["signature"] = kgSignature(params, "")

	request, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	request.Header = kgHeaders("Lyric")
	query := request.URL.Query()
	for key, value := range params {
		query.Set(key, value)
	}
	request.URL.RawQuery = query.Encode()

	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("kg lyric http %d", response.StatusCode)
	}

	var payload any
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}
	errorCode := int64Value(pointerValue(payload, "/error_code"))
	if errorCode != 0 && errorCode != 200 {
		return nil, fmt.Errorf("kg lyric err %d", errorCode)
	}
	return payload, nil
}

func albumAudioIDFromItem(item any) string {
	for _, key := range []string{"Scid", "ID", "AlbumAudioID"} {
		value := pointerValue(item, "/"+key)
		if number, ok := numberValue(value); ok && number != 0 {
			return strconv.FormatInt(number, 10)
		}
		text := strings.TrimSpace(stringValue(value))
		if text != "" && text != "0" {
			return text
		}
	}
	return ""
}

func fileHashFromItem(item any) string {
	for _, key := range []string{"FileHash", "HQFileHash", "SQFileHash"} {
		value := strings.TrimSpace(stringValue(pointerValue(item, "/"+key)))
		if value != "" {
			return value
		}
	}
	return ""
}

func parseKugouSearchLists(root any) []kugouSearchHit {
	items := arrayAt(root, "/data/lists")
	out := make([]kugouSearchHit, 0, len(items))
	for _, item := range items {
		albumAudioID := albumAudioIDFromItem(item)
		if albumAudioID == "" {
			continue
		}
		artists := arrayAt(item, "/Singers")
		artistNames := make([]string, 0, len(artists))
		for _, artist := range artists {
			name := strings.TrimSpace(stringValue(pointerValue(artist, "/name")))
			if name != "" {
				artistNames = append(artistNames, name)
			}
		}
		artist := strings.Join(artistNames, "、")
		if artist == "" {
			artist = stringValue(pointerValue(item, "/SingerName"))
		}
		out = append(out, kugouSearchHit{
			AlbumAudioID: albumAudioID,
			FileHash:     fileHashFromItem(item),
			Title:        stringValue(pointerValue(item, "/SongName")),
			Artist:       artist,
			Album:        stringValue(pointerValue(item, "/AlbumName")),
			DurationMS:   int64Value(pointerValue(item, "/Duration")) * 1000,
		})
	}
	return out
}

func searchKugouSongs(client *http.Client, keyword string, page int) ([]kugouSearchHit, error) {
	trimmed := strings.TrimSpace(keyword)
	attempts := []string{trimmed}
	if lastParts := strings.Fields(trimmed); len(lastParts) > 0 {
		last := lastParts[len(lastParts)-1]
		if len([]rune(last)) >= 2 && last != trimmed {
			attempts = append(attempts, last)
		}
		if len(lastParts) >= 2 {
			reversed := append([]string(nil), lastParts...)
			for left, right := 0, len(reversed)-1; left < right; left, right = left+1, right-1 {
				reversed[left], reversed[right] = reversed[right], reversed[left]
			}
			reversedKeyword := strings.Join(reversed, " ")
			if reversedKeyword != trimmed {
				attempts = append(attempts, reversedKeyword)
			}
		}
	}

	var lastErr error
	sawOK := false
	for _, attempt := range attempts {
		payload, err := kgGet(client, kgComplexSearch, map[string]string{
			"sorttype": "0",
			"keyword":  attempt,
			"pagesize": "20",
			"page":     strconv.Itoa(page),
		}, "SearchSong", "x-router", "complexsearch.kugou.com")
		if err != nil {
			lastErr = err
			continue
		}
		sawOK = true
		out := parseKugouSearchLists(payload)
		if len(out) > 0 {
			return out, nil
		}
	}
	if !sawOK && lastErr != nil {
		return nil, lastErr
	}
	return []kugouSearchHit{}, nil
}

func kugouCandidatesArray(root any) []any {
	if items := arrayAt(root, "/candidates"); len(items) > 0 {
		return items
	}
	return arrayAt(root, "/data/candidates")
}

func jsonNumOrStrID(value any) string {
	if number, ok := numberValue(value); ok && number != 0 {
		return strconv.FormatInt(number, 10)
	}
	text := strings.TrimSpace(stringValue(value))
	if text == "" {
		return ""
	}
	return text
}

func kugouCandidateIDStr(candidate any) string {
	for _, key := range []string{"id", "Id", "ID"} {
		if value := jsonNumOrStrID(pointerValue(candidate, "/"+key)); value != "" {
			return value
		}
	}
	return ""
}

func kugouCandidateAccessKeyStr(candidate any) string {
	for _, key := range []string{"accesskey", "AccessKey", "access_key"} {
		value := strings.TrimSpace(stringValue(pointerValue(candidate, "/"+key)))
		if value != "" {
			return value
		}
	}
	return ""
}

func firstKugouLyricDownloadPair(root any) (string, string, bool) {
	for _, candidate := range kugouCandidatesArray(root) {
		id := kugouCandidateIDStr(candidate)
		accessKey := kugouCandidateAccessKeyStr(candidate)
		if id != "" && accessKey != "" {
			return id, accessKey, true
		}
	}
	return "", "", false
}

func kugouLyricSearchResponse(client *http.Client, baseURL string, params map[string]string) (any, error) {
	payload, err := kgLyricGet(client, baseURL, params)
	if err != nil {
		return nil, err
	}
	if len(kugouCandidatesArray(payload)) == 0 {
		return nil, nil
	}
	return payload, nil
}

func fetchKugouLyrics(client *http.Client, hit kugouSearchHit) (LyricsPayload, error) {
	durationMS := hit.DurationMS
	if durationMS <= 0 {
		durationMS = 999_000
	}
	keywordDash := fmt.Sprintf("%s - %s", hit.Artist, hit.Title)
	keywordSpace := fmt.Sprintf("%s %s", hit.Artist, hit.Title)

	attempts := make([]map[string]string, 0, 5)
	attempts = append(attempts, map[string]string{
		"album_audio_id": hit.AlbumAudioID,
		"duration":       strconv.FormatInt(durationMS, 10),
		"keyword":        keywordDash,
		"lrctxt":         "1",
		"man":            "yes",
	})
	if hit.FileHash != "" {
		attempts[0]["hash"] = hit.FileHash
		attempts = append(attempts, map[string]string{
			"duration": strconv.FormatInt(durationMS, 10),
			"hash":     hit.FileHash,
			"keyword":  keywordDash,
			"lrctxt":   "1",
			"man":      "yes",
		})
	}
	for _, keyword := range []string{keywordDash, keywordSpace, hit.Title} {
		attempts = append(attempts, map[string]string{
			"keyword":  keyword,
			"duration": strconv.FormatInt(durationMS, 10),
			"client":   "pc",
			"ver":      "1",
			"man":      "yes",
		})
	}

	urls := []string{"https://lyrics.kugou.com/v1/search", "http://lyrics.kugou.com/search"}
	var pairID, pairAccessKey string
	var lastErr error
	found := false
	for _, attempt := range attempts {
		for _, baseURL := range urls {
			payload, err := kugouLyricSearchResponse(client, baseURL, attempt)
			if err != nil {
				lastErr = err
				continue
			}
			if payload == nil {
				continue
			}
			if id, accessKey, ok := firstKugouLyricDownloadPair(payload); ok {
				pairID, pairAccessKey, found = id, accessKey, true
				break
			}
		}
		if found {
			break
		}
	}
	if !found {
		if lastErr != nil {
			return LyricsPayload{}, lastErr
		}
		return LyricsPayload{}, fmt.Errorf("kg: no lyric candidates after all search attempts")
	}

	download, err := kgLyricGet(client, "http://lyrics.kugou.com/download", map[string]string{
		"accesskey": pairAccessKey,
		"charset":   "utf8",
		"client":    "mobi",
		"fmt":       "krc",
		"id":        pairID,
		"ver":       "1",
	})
	if err != nil {
		return LyricsPayload{}, err
	}
	content := stringValue(pointerValue(download, "/content"))
	if content == "" {
		return LyricsPayload{}, fmt.Errorf("kg: no content")
	}
	contentType := int64Value(pointerValue(download, "/contenttype"))
	if contentType == 2 {
		decoded, err := base64.StdEncoding.DecodeString(content)
		if err != nil {
			return LyricsPayload{}, err
		}
		return lineOnlyPayload(string(decoded)), nil
	}

	raw, err := base64.StdEncoding.DecodeString(content)
	if err != nil {
		return LyricsPayload{}, err
	}
	plain, err := krcDecrypt(raw)
	if err != nil {
		return LyricsPayload{}, err
	}
	return krcPlainToPayload(plain)
}

var (
	krcLineRE = regexp.MustCompile(`(?m)^\[(\d+),(\d+)\](.*)$`)
	krcWordRE = regexp.MustCompile(`<((\d+),(\d+),\d+)>`)
)

func krcPlainToPayload(value string) (LyricsPayload, error) {
	wordLines := make([]WordLine, 0)
	for _, line := range strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n") {
		groups := krcLineRE.FindStringSubmatch(line)
		if len(groups) < 4 {
			continue
		}
		lineStart, errStart := strconvParseUint(groups[1])
		lineDur, errDur := strconvParseUint(groups[2])
		if errStart != nil || errDur != nil {
			continue
		}
		lineEnd := lineStart + lineDur
		rest := strings.TrimRight(groups[3], "\r")
		matches := krcWordRE.FindAllStringSubmatchIndex(rest, -1)
		if len(matches) == 0 {
			text := strings.TrimSpace(rest)
			if text == "" {
				continue
			}
			wordLines = append(wordLines, WordLine{
				StartMS: lineStart,
				EndMS:   lineEnd,
				Words:   []WordTiming{{StartMS: lineStart, EndMS: lineEnd, Text: text}},
			})
			continue
		}
		words := make([]WordTiming, 0, len(matches))
		for index, match := range matches {
			groups := krcWordRE.FindStringSubmatch(rest[match[0]:match[1]])
			if len(groups) < 4 {
				continue
			}
			offsetMS, _ := strconvParseUint(groups[2])
			durationMS, _ := strconvParseUint(groups[3])
			textStart := match[1]
			textEnd := len(rest)
			if index+1 < len(matches) {
				textEnd = matches[index+1][0]
			}
			text := rest[textStart:textEnd]
			words = append(words, WordTiming{
				StartMS: lineStart + offsetMS,
				EndMS:   lineStart + offsetMS + durationMS,
				Text:    text,
			})
		}
		if len(words) == 0 {
			continue
		}
		wordLines = append(wordLines, WordLine{StartMS: lineStart, EndMS: lineEnd, Words: words})
	}
	if payload := payloadFromWordLines(wordLines); payload != nil {
		return *payload, nil
	}
	return lineOnlyPayload(value), nil
}
