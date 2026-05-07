package config

import "strings"

// Playback config helpers normalize queue and resume snapshots shared by persisted settings.
const (
	PlayModeLoopList = "loop_list"
	PlayModeOne      = "one"
	PlayModeShuffle  = "shuffle"
)

type PlaybackQueueItem struct {
	SourceID   string `json:"source_id,omitempty"`
	Title      string `json:"title"`
	Artist     string `json:"artist,omitempty"`
	Album      string `json:"album,omitempty"`
	CoverURL   string `json:"cover_url,omitempty"`
	DurationMS int64  `json:"duration_ms,omitempty"`
	LocalPath  string `json:"local_path,omitempty"`
}

func NormalizePlayMode(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case PlayModeOne, PlayModeShuffle:
		return strings.ToLower(strings.TrimSpace(value))
	case "sequential", PlayModeLoopList:
		return PlayModeLoopList
	default:
		return PlayModeLoopList
	}
}

func NormalizePlaybackQueue(items []PlaybackQueueItem) []PlaybackQueueItem {
	if len(items) == 0 {
		return nil
	}
	rows := make([]PlaybackQueueItem, 0, len(items))
	for _, item := range items {
		row := PlaybackQueueItem{
			SourceID:  strings.TrimSpace(item.SourceID),
			Title:     strings.TrimSpace(item.Title),
			Artist:    strings.TrimSpace(item.Artist),
			Album:     strings.TrimSpace(item.Album),
			CoverURL:  strings.TrimSpace(item.CoverURL),
			LocalPath: strings.TrimSpace(item.LocalPath),
		}
		if item.DurationMS > 0 {
			row.DurationMS = item.DurationMS
		}
		if row.LocalPath == "" && row.SourceID == "" {
			continue
		}
		if row.Title == "" {
			row.Title = "未命名曲目"
		}
		rows = append(rows, row)
	}
	if len(rows) == 0 {
		return nil
	}
	return rows
}

func NormalizePlaybackSnapshot(trackKey string, positionMS int64, durationMS int64) (string, int64, int64) {
	if positionMS < 0 {
		positionMS = 0
	}
	if durationMS < 0 {
		durationMS = 0
	}
	if durationMS > 0 && positionMS > durationMS {
		positionMS = durationMS
	}
	trackKey = strings.TrimSpace(trackKey)
	if trackKey == "" {
		return "", 0, 0
	}
	return trackKey, positionMS, durationMS
}
