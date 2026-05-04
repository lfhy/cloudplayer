package model

// Shared DTO types live outside the Wails app package so cache and state helpers can depend on them directly.

import (
	"cloudplayer/backend/importplaylist"
	"cloudplayer/backend/musicsource"
)

type SearchResponse struct {
	Results []musicsource.SearchResult `json:"results"`
	HasNext bool                       `json:"has_next"`
}

type SearchSongMetadataRow struct {
	SourceID   string `json:"source_id"`
	Album      string `json:"album"`
	DurationMS int64  `json:"duration_ms"`
}

type ResolveOnlinePlayOut struct {
	Kind string `json:"kind"`
	Path string `json:"path,omitempty"`
	URL  string `json:"url,omitempty"`
	Via  string `json:"via"`
}

type PlaylistRow struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type PlaylistImportItemRow struct {
	ID            int64  `json:"id"`
	SortOrder     int64  `json:"sort_order"`
	Title         string `json:"title"`
	Artist        string `json:"artist"`
	Album         string `json:"album"`
	Pjmp3SourceID string `json:"pjmp3_source_id"`
	CoverURL      string `json:"cover_url"`
	DurationMS    int64  `json:"duration_ms"`
}

type SharePlaylistResponse struct {
	PlaylistName string                            `json:"playlist_name"`
	Tracks       []importplaylist.ImportedTrackDTO `json:"tracks"`
}

type LocalSongRow struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	FilePath string `json:"file_path"`
}

type ScanMusicFolderResult struct {
	AudioFilesSeen int `json:"audio_files_seen"`
	RowsWritten    int `json:"rows_written"`
}

type RecentPlayIn struct {
	Kind          string  `json:"kind"`
	Title         string  `json:"title"`
	Artist        string  `json:"artist"`
	CoverURL      *string `json:"cover_url"`
	Pjmp3SourceID *string `json:"pjmp3_source_id"`
	FilePath      *string `json:"file_path"`
}

type RecentPlayRow struct {
	Kind          string  `json:"kind"`
	Title         string  `json:"title"`
	Artist        string  `json:"artist"`
	CoverURL      *string `json:"cover_url"`
	Pjmp3SourceID *string `json:"pjmp3_source_id"`
	FilePath      *string `json:"file_path"`
	PlayedAt      int64   `json:"played_at"`
}
