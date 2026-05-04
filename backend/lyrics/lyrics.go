package lyrics

import (
	"net/http"

	"cloudplayer/backend/config"
)

// FetchRequest carries the song metadata used to resolve lyrics across providers.
type FetchRequest struct {
	PJMP3SourceID   *string  `json:"pjmp3SourceId,omitempty"`
	Title           string   `json:"title"`
	Artist          string   `json:"artist"`
	Album           string   `json:"album,omitempty"`
	LocalPath       *string  `json:"localPath,omitempty"`
	DurationSeconds *float64 `json:"durationSeconds,omitempty"`
}

// LyricsPayload is the frontend-facing payload for plain and word-timed lyrics.
type LyricsPayload struct {
	LRCText   string     `json:"lrcText"`
	WordLines []WordLine `json:"wordLines,omitempty"`
}

// WordLine groups word-level timing data into a rendered lyric row.
type WordLine struct {
	StartMS uint64       `json:"startMs"`
	EndMS   uint64       `json:"endMs"`
	Words   []WordTiming `json:"words"`
}

// WordTiming describes a single timed word inside a lyric line.
type WordTiming struct {
	StartMS uint64 `json:"startMs"`
	EndMS   uint64 `json:"endMs"`
	Text    string `json:"text"`
}

// LyricCandidate is the cross-provider search result consumed by the replacement flow.
type LyricCandidate struct {
	Source     string  `json:"source"`
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Artist     string  `json:"artist"`
	Album      string  `json:"album"`
	DurationMS *int64  `json:"durationMs,omitempty"`
	QQMid      *string `json:"qqMid,omitempty"`
	KugouHash  *string `json:"kugouHash,omitempty"`
	NeteaseID  *int64  `json:"neteaseId,omitempty"`
	LRCLibID   *int64  `json:"lrclibId,omitempty"`
}

// FetchSongLRCEnriched resolves the best lyric payload using the configured provider chain.
func FetchSongLRCEnriched(client *http.Client, settings config.Settings, req FetchRequest) (*LyricsPayload, error) {
	return fetchSongLDDCEnriched(client, settings, req)
}
