package main

// Lyrics cache reuses the shared lfhy/cache store with a dedicated key prefix.

import (
	"strconv"
	"strings"
	"time"

	gcache "github.com/lfhy/cache"

	"cloudplayer/internal/cloudplayer/lyrics"
	"cloudplayer/internal/cloudplayer/musicsource"
)

const (
	lyricsCachePrefix      = "lyrics:v1:"
	lyricsCacheEntryPrefix = lyricsCachePrefix + "payload:"
)

func LyricsCacheKey(req lyrics.FetchRequest) string {
	if req.PJMP3SourceID != nil {
		if sourceID := musicsource.CanonicalSourceID(strings.TrimSpace(*req.PJMP3SourceID)); sourceID != "" {
			return lyricsCacheEntryPrefix + "source|" + sourceID
		}
	}
	if req.LocalPath != nil {
		if localPath := strings.TrimSpace(*req.LocalPath); localPath != "" {
			return lyricsCacheEntryPrefix + "local|" + strings.ToLower(localPath)
		}
	}
	parts := []string{
		normalizeLyricsCachePart(req.Artist),
		normalizeLyricsCachePart(req.Title),
		normalizeLyricsCachePart(req.Album),
		lyricsDurationKeyPart(req.DurationSeconds),
	}
	return lyricsCacheEntryPrefix + strings.Join(parts, "|")
}

func normalizeLyricsCachePart(value string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(value)), " "))
}

func lyricsDurationKeyPart(durationSeconds *float64) string {
	if durationSeconds == nil || *durationSeconds <= 0 {
		return "0"
	}
	return strconv.FormatInt(int64(*durationSeconds*1000+0.5), 10)
}

// LyricsCache keeps the service layer decoupled from the backing cache package.
type LyricsCache struct{}

func NewLyricsCache() *LyricsCache {
	return &LyricsCache{}
}

func (c *LyricsCache) Get(key string) (lyrics.LyricsPayload, bool) {
	payload, ok := gcache.Get[lyrics.LyricsPayload](key)
	if !ok {
		return lyrics.LyricsPayload{}, false
	}
	return cloneLyricsPayload(payload), true
}

func (c *LyricsCache) Set(key string, payload lyrics.LyricsPayload, ttl time.Duration) {
	seconds := int(ttl / time.Second)
	if seconds <= 0 {
		seconds = int((24 * time.Hour) / time.Second)
	}
	gcache.Set(key, cloneLyricsPayload(payload), seconds)
}

func cloneLyricsPayload(payload lyrics.LyricsPayload) lyrics.LyricsPayload {
	clonedLines := make([]lyrics.WordLine, 0, len(payload.WordLines))
	for _, line := range payload.WordLines {
		clonedWords := make([]lyrics.WordTiming, len(line.Words))
		copy(clonedWords, line.Words)
		clonedLines = append(clonedLines, lyrics.WordLine{
			StartMS: line.StartMS,
			EndMS:   line.EndMS,
			Words:   clonedWords,
		})
	}
	return lyrics.LyricsPayload{
		LRCText:   payload.LRCText,
		WordLines: clonedLines,
	}
}
