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
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	IsBuiltin bool   `json:"is_builtin"`
	IsCloud   bool   `json:"is_cloud,omitempty"`
}

// FavoriteTrackIn represents one online track that can be stored in the built-in favorites playlist.
type FavoriteTrackIn struct {
	Title         string `json:"title"`
	Artist        string `json:"artist"`
	Album         string `json:"album"`
	Pjmp3SourceID string `json:"pjmp3_source_id"`
	CoverURL      string `json:"cover_url"`
	DurationMS    int64  `json:"duration_ms"`
}

type PlaylistImportItemRow struct {
	ID            int64  `json:"id"`
	SortOrder     int64  `json:"sort_order"`
	Title         string `json:"title"`
	Artist        string `json:"artist"`
	Album         string `json:"album"`
	Pjmp3SourceID string `json:"pjmp3_source_id"`
	KugouFileID   int64  `json:"kugou_file_id,omitempty"`
	CoverURL      string `json:"cover_url"`
	DurationMS    int64  `json:"duration_ms"`
}

type SharePlaylistResponse struct {
	PlaylistName string                            `json:"playlist_name"`
	Tracks       []importplaylist.ImportedTrackDTO `json:"tracks"`
	KugouFileIDs []int64                           `json:"kugou_file_ids,omitempty"`
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
	Album         string  `json:"album"`
	CoverURL      *string `json:"cover_url"`
	Pjmp3SourceID *string `json:"pjmp3_source_id"`
	FilePath      *string `json:"file_path"`
	DurationMS    int64   `json:"duration_ms"`
}

type RecentPlayRow struct {
	Kind          string  `json:"kind"`
	Title         string  `json:"title"`
	Artist        string  `json:"artist"`
	Album         string  `json:"album"`
	CoverURL      *string `json:"cover_url"`
	Pjmp3SourceID *string `json:"pjmp3_source_id"`
	FilePath      *string `json:"file_path"`
	DurationMS    int64   `json:"duration_ms"`
	PlayedAt      int64   `json:"played_at"`
}

type DailyRecommendationResponse struct {
	Date   string                     `json:"date"`
	Rows   []musicsource.SearchResult `json:"rows"`
	Source string                     `json:"source"`
}
