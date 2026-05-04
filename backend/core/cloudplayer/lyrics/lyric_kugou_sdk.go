package lyrics

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	kg "github.com/lfhy/kugou-music-api"
)

// fetchKugouLyricsViaSDK resolves lyrics through the official Kugou SDK.
// It first searches for a candidate, then fetches the lyric payload and converts it to LRC.
func fetchKugouLyricsViaSDK(hit kugouSearchHit) (LyricsPayload, error) {
	client, err := kg.New()
	if err != nil {
		return LyricsPayload{}, fmt.Errorf("kg sdk init: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	// Search for lyric candidates using the same identifiers we already have from search results.
	searchReq := kg.SearchLyricRequest{
		Keywords:     fmt.Sprintf("%s - %s", hit.Artist, hit.Title),
		Hash:         hit.FileHash,
		AlbumAudioId: toInt(hit.AlbumAudioID, 0),
	}
	searchResp, err := client.SearchLyric(ctx, searchReq)
	if err != nil {
		return LyricsPayload{}, fmt.Errorf("kg sdk search lyric: %w", err)
	}
	if searchResp == nil || searchResp.Body == nil {
		return LyricsPayload{}, fmt.Errorf("kg sdk search lyric empty body")
	}

	candidates, _ := searchResp.Body["candidates"].([]any)
	if len(candidates) == 0 {
		return LyricsPayload{}, fmt.Errorf("kg sdk search lyric no candidates")
	}
	first, ok := candidates[0].(map[string]any)
	if !ok {
		return LyricsPayload{}, fmt.Errorf("kg sdk search lyric bad candidate")
	}
	id := fmt.Sprintf("%v", first["id"])
	accesskey := fmt.Sprintf("%v", first["accesskey"])
	if strings.TrimSpace(id) == "" || strings.TrimSpace(accesskey) == "" {
		return LyricsPayload{}, fmt.Errorf("kg sdk search lyric missing id/accesskey")
	}

	// Fetch the actual lyric content.
	lyricResp, err := client.Lyric(ctx, kg.LyricRequest{
		Id:        id,
		Accesskey: accesskey,
		Fmt:       "krc",
		Decode:    true,
	})
	if err != nil {
		return LyricsPayload{}, fmt.Errorf("kg sdk lyric fetch: %w", err)
	}
	if lyricResp == nil {
		return LyricsPayload{}, fmt.Errorf("kg sdk lyric empty response")
	}

	if decoded := strings.TrimSpace(lyricResp.DecodedContent()); decoded != "" {
		if payload, err := krcPlainToPayload(decoded); err == nil && strings.TrimSpace(payload.LRCText) != "" {
			if looksLikeUnavailableLyric(payload.LRCText) {
				return LyricsPayload{}, fmt.Errorf("kg sdk lyric unavailable")
			}
			return payload, nil
		}
	}

	lrcText := lyricResp.ToLrc()
	if strings.TrimSpace(lrcText) == "" {
		return LyricsPayload{}, fmt.Errorf("kg sdk lyric empty lrc")
	}
	if looksLikeUnavailableLyric(lrcText) {
		return LyricsPayload{}, fmt.Errorf("kg sdk lyric unavailable")
	}

	return lineOnlyPayload(lrcText), nil
}

func toInt(value string, fallback int) int {
	n, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return fallback
	}
	return n
}
