package main

// Persistent lyric cache keeps fetched payloads and manual replacements available across app restarts.

import (
	"database/sql"
	"encoding/json"
	"time"

	"cloudplayer/internal/cloudplayer/lyrics"
)

const persistentLyricsTTL = 30 * 24 * time.Hour

func loadPersistentLyrics(db *sql.DB, cacheKey string) (lyrics.LyricsPayload, bool, bool, error) {
	var payloadJSON string
	var isOverride bool
	var updatedAt int64
	err := db.QueryRow(`
		SELECT payload_json, is_override, updated_at
		FROM lyrics_cache
		WHERE cache_key = ?
	`, cacheKey).Scan(&payloadJSON, &isOverride, &updatedAt)
	if err == sql.ErrNoRows {
		return lyrics.LyricsPayload{}, false, false, nil
	}
	if err != nil {
		return lyrics.LyricsPayload{}, false, false, err
	}
	if !isOverride && updatedAt > 0 && time.Since(time.Unix(updatedAt, 0)) > persistentLyricsTTL {
		_, _ = db.Exec(`DELETE FROM lyrics_cache WHERE cache_key = ?`, cacheKey)
		return lyrics.LyricsPayload{}, false, false, nil
	}

	var payload lyrics.LyricsPayload
	if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
		return lyrics.LyricsPayload{}, false, false, err
	}
	return cloneLyricsPayload(payload), isOverride, true, nil
}

func savePersistentLyrics(db *sql.DB, cacheKey string, payload lyrics.LyricsPayload, isOverride bool) error {
	encoded, err := json.Marshal(cloneLyricsPayload(payload))
	if err != nil {
		return err
	}
	_, err = db.Exec(`
		INSERT INTO lyrics_cache (cache_key, payload_json, is_override, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(cache_key) DO UPDATE SET
			payload_json = excluded.payload_json,
			is_override = excluded.is_override,
			updated_at = excluded.updated_at
	`, cacheKey, string(encoded), isOverride, time.Now().Unix())
	return err
}
