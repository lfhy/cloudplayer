package cloudplayer

// Persistent daily recommendation cache stores today's picks in SQLite so they survive app restarts.

import (
	"database/sql"
	"encoding/json"
	"time"

	"cloudplayer/backend/musicsource"
)

const dailyRecKeepDays = 7

func loadDailyRecommendation(db *sql.DB, date string) ([]musicsource.SearchResult, string, bool, error) {
	var payloadJSON, source string
	err := db.QueryRow(`
		SELECT source, payload_json
		FROM daily_recommendations
		WHERE rec_date = ?
	`, date).Scan(&source, &payloadJSON)
	if err == sql.ErrNoRows {
		return nil, "", false, nil
	}
	if err != nil {
		return nil, "", false, err
	}

	var rows []musicsource.SearchResult
	if err := json.Unmarshal([]byte(payloadJSON), &rows); err != nil {
		return nil, "", false, err
	}
	return rows, source, true, nil
}

func saveDailyRecommendation(db *sql.DB, date, source string, rows []musicsource.SearchResult) error {
	encoded, err := json.Marshal(rows)
	if err != nil {
		return err
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO daily_recommendations (rec_date, source, payload_json, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(rec_date) DO UPDATE SET
			source = excluded.source,
			payload_json = excluded.payload_json,
			updated_at = excluded.updated_at
	`, date, source, string(encoded), time.Now().Unix())
	if err != nil {
		return err
	}

	cutoff := time.Now().AddDate(0, 0, -dailyRecKeepDays).Format("2006-01-02")
	_, _ = tx.Exec(`DELETE FROM daily_recommendations WHERE rec_date < ?`, cutoff)

	return tx.Commit()
}
