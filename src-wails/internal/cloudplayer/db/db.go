package db

import (
	"database/sql"
	"path/filepath"
	"strings"

	_ "github.com/mattn/go-sqlite3"

	"cloudplayer/internal/cloudplayer/config"
)

// Path returns the SQLite database file path inside the app config directory.
func Path() string {
	return filepath.Join(config.ConfigDir(), "library.db")
}

func OpenAndInit() (*sql.DB, error) {
	conn, err := sql.Open("sqlite3", Path())
	if err != nil {
		return nil, err
	}
	if _, err := conn.Exec(`
		PRAGMA journal_mode=WAL;
		PRAGMA foreign_keys=ON;

		CREATE TABLE IF NOT EXISTS songs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL DEFAULT '',
			artist TEXT NOT NULL DEFAULT '',
			album TEXT NOT NULL DEFAULT '',
			file_path TEXT NOT NULL UNIQUE,
			cover TEXT,
			source_id TEXT,
			quality TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_songs_source ON songs(source_id);
		CREATE INDEX IF NOT EXISTS idx_songs_title_artist ON songs(title, artist);

		CREATE TABLE IF NOT EXISTS playlists (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS playlist_songs (
			playlist_id INTEGER NOT NULL,
			song_id INTEGER NOT NULL,
			position INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY (playlist_id, song_id)
		);
		CREATE INDEX IF NOT EXISTS idx_ps_playlist ON playlist_songs(playlist_id);

		CREATE TABLE IF NOT EXISTS playlist_import_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			playlist_id INTEGER NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			title TEXT NOT NULL DEFAULT '',
			artist TEXT NOT NULL DEFAULT '',
			album TEXT NOT NULL DEFAULT '',
			play_url TEXT NOT NULL DEFAULT '',
			pjmp3_source_id TEXT NOT NULL DEFAULT '',
			cover_url TEXT NOT NULL DEFAULT '',
			cover_cache_path TEXT NOT NULL DEFAULT '',
			duration_ms INTEGER NOT NULL DEFAULT 0,
			audio_cache_path TEXT NOT NULL DEFAULT ''
		);
		CREATE INDEX IF NOT EXISTS idx_pii_playlist ON playlist_import_items(playlist_id);

		CREATE TABLE IF NOT EXISTS liked_tracks (
			key TEXT PRIMARY KEY NOT NULL,
			title TEXT NOT NULL DEFAULT '',
			artist TEXT NOT NULL DEFAULT '',
			album TEXT NOT NULL DEFAULT '',
			pjmp3_source_id TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE IF NOT EXISTS recent_plays (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			kind TEXT NOT NULL,
			title TEXT NOT NULL DEFAULT '',
			artist TEXT NOT NULL DEFAULT '',
			cover_url TEXT,
			pjmp3_source_id TEXT,
			file_path TEXT,
			played_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_recent_played_at ON recent_plays(played_at DESC);
	`); err != nil {
		return nil, err
	}

	for _, statement := range []string{
		"ALTER TABLE playlist_import_items ADD COLUMN album TEXT NOT NULL DEFAULT ''",
		"ALTER TABLE playlist_import_items ADD COLUMN play_url TEXT NOT NULL DEFAULT ''",
		"ALTER TABLE playlist_import_items ADD COLUMN pjmp3_source_id TEXT NOT NULL DEFAULT ''",
		"ALTER TABLE playlist_import_items ADD COLUMN cover_url TEXT NOT NULL DEFAULT ''",
		"ALTER TABLE playlist_import_items ADD COLUMN cover_cache_path TEXT NOT NULL DEFAULT ''",
		"ALTER TABLE playlist_import_items ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0",
		"ALTER TABLE playlist_import_items ADD COLUMN audio_cache_path TEXT NOT NULL DEFAULT ''",
	} {
		if _, err := conn.Exec(statement); err != nil && !isDuplicateColumnError(err) {
			return nil, err
		}
	}
	return conn, nil
}

func isDuplicateColumnError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "duplicate column name")
}
