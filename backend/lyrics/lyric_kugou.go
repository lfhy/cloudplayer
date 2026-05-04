package lyrics

import (
	"bytes"
	"compress/zlib"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	kgSignPrefix    = "LnT6xpN3khm36zse0QzvmgTZ3waWdRSA"
	kgComplexSearch = "https://complexsearch.kugou.com/v2/search/song"
)

// Kugou request helpers keep signature generation and shared transport details separate.
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
