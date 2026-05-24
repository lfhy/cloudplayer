package model

// Shared DTO types live outside the Wails app package so cache and state helpers can depend on them directly.

import (
	"cloudplayer/backend/importplaylist"
	"cloudplayer/backend/musicsource"
)

type SearchResponse struct {
	Results           []musicsource.SearchResult `json:"results"`
	HasNext           bool                       `json:"has_next"`
	ProviderKey       string                     `json:"provider_key,omitempty"`
	FailedProviderKey string                     `json:"failed_provider_key,omitempty"`
	FallbackApplied   bool                       `json:"fallback_applied,omitempty"`
	ProviderPersisted bool                       `json:"provider_persisted,omitempty"`
}

type SearchSongMetadataRow struct {
	SourceID   string `json:"source_id"`
	Album      string `json:"album"`
	DurationMS int64  `json:"duration_ms"`
}

type ResolveOnlinePlayOut struct {
	Kind             string `json:"kind"`
	Path             string `json:"path,omitempty"`
	URL              string `json:"url,omitempty"`
	Via              string `json:"via"`
	ResolvedSourceID string `json:"resolved_source_id,omitempty"`
}

type PlaylistRow struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	IsBuiltin     bool   `json:"is_builtin"`
	IsCloud       bool   `json:"is_cloud,omitempty"`
	IsFavorites   bool   `json:"is_favorites,omitempty"`
	CloudListID   *int64 `json:"cloud_list_id,omitempty"`
	CloudSource   string `json:"cloud_source,omitempty"`
	CloudWritable bool   `json:"cloud_writable,omitempty"`
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
	ID             int64  `json:"id"`
	SortOrder      int64  `json:"sort_order"`
	Title          string `json:"title"`
	Artist         string `json:"artist"`
	Album          string `json:"album"`
	Pjmp3SourceID  string `json:"pjmp3_source_id"`
	KugouFileID    int64  `json:"kugou_file_id,omitempty"`
	SyncOrigin     string `json:"sync_origin,omitempty"`
	CoverURL       string `json:"cover_url"`
	CoverCachePath string `json:"cover_cache_path,omitempty"`
	DurationMS     int64  `json:"duration_ms"`
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
	Kind           string  `json:"kind"`
	Title          string  `json:"title"`
	Artist         string  `json:"artist"`
	Album          string  `json:"album"`
	CoverURL       *string `json:"cover_url"`
	CoverCachePath *string `json:"cover_cache_path,omitempty"`
	Pjmp3SourceID  *string `json:"pjmp3_source_id"`
	FilePath       *string `json:"file_path"`
	DurationMS     int64   `json:"duration_ms"`
	PlayedAt       int64   `json:"played_at"`
}

type DailyRecommendationResponse struct {
	Date   string                     `json:"date"`
	Rows   []musicsource.SearchResult `json:"rows"`
	Source string                     `json:"source"`
}
