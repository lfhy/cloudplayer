package cloudplayer

import (
	"fmt"
	"strings"
	"time"
)

// Recent-play methods keep dedupe and retention rules away from unrelated service concerns.
func (s *CloudPlayerService) ListRecentPlays() ([]RecentPlayRow, error) {
	rows, err := s.state.DB.Query(`
		SELECT kind, title, artist, album, cover_url, pjmp3_source_id, file_path, duration_ms, played_at
		FROM recent_plays
		ORDER BY played_at DESC
		LIMIT ?
	`, recentPlaysMax)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []RecentPlayRow
	for rows.Next() {
		var row RecentPlayRow
		if err := rows.Scan(&row.Kind, &row.Title, &row.Artist, &row.Album, &row.CoverURL, &row.Pjmp3SourceID, &row.FilePath, &row.DurationMS, &row.PlayedAt); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func (s *CloudPlayerService) RecordRecentPlay(row RecentPlayIn) error {
	kind := strings.TrimSpace(row.Kind)
	if kind != "online" && kind != "local" {
		return fmt.Errorf("kind 须为 online 或 local")
	}
	if kind == "online" && strings.TrimSpace(valueOrEmpty(row.Pjmp3SourceID)) == "" {
		return fmt.Errorf("online 须含 pjmp3_source_id")
	}
	if kind == "local" && strings.TrimSpace(valueOrEmpty(row.FilePath)) == "" {
		return fmt.Errorf("local 须含 file_path")
	}

	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)

	if kind == "online" {
		if _, err := tx.Exec(`DELETE FROM recent_plays WHERE kind = 'online' AND pjmp3_source_id = ?`, strings.TrimSpace(valueOrEmpty(row.Pjmp3SourceID))); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(`DELETE FROM recent_plays WHERE kind = 'local' AND file_path = ?`, strings.TrimSpace(valueOrEmpty(row.FilePath))); err != nil {
			return err
		}
	}

	now := time.Now().UnixMilli()
	if _, err := tx.Exec(`
		INSERT INTO recent_plays (kind, title, artist, album, cover_url, pjmp3_source_id, file_path, duration_ms, played_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, kind, row.Title, row.Artist, row.Album, row.CoverURL, row.Pjmp3SourceID, row.FilePath, row.DurationMS, now); err != nil {
		return err
	}
	if _, err := tx.Exec(`
		DELETE FROM recent_plays
		WHERE id NOT IN (
			SELECT id FROM recent_plays ORDER BY played_at DESC LIMIT ?
		)
	`, recentPlaysMax); err != nil {
		return err
	}
	return tx.Commit()
}
