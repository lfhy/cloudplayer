package lyrics

import (
	"bytes"
	"compress/zlib"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// QQ lyric payload helpers decode QRC/YRC content after search hits are resolved.
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
