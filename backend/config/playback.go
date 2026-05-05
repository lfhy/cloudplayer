package config

import "strings"

const (
	PlayModeLoopList = "loop_list"
	PlayModeOne      = "one"
	PlayModeShuffle  = "shuffle"
)

type PlaybackQueueItem struct {
	SourceID  string `json:"source_id,omitempty"`
	Title     string `json:"title"`
	Artist    string `json:"artist,omitempty"`
	CoverURL  string `json:"cover_url,omitempty"`
	LocalPath string `json:"local_path,omitempty"`
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
			CoverURL:  strings.TrimSpace(item.CoverURL),
			LocalPath: strings.TrimSpace(item.LocalPath),
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
