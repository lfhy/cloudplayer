package importenrich

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"cloudplayer/backend/core/cloudplayer/musicsource"
	"cloudplayer/backend/core/cloudplayer/ratelimiter"
	"github.com/wailsapp/wails/v3/pkg/application"
)

const enrichDelay = 120 * time.Millisecond

type importRow struct {
	ID             int64
	Title          string
	Artist         string
	Album          string
	PJMP3SourceID  string
	CoverURL       string
	CoverCachePath string
	DurationMS     int64
}

// SpawnPlaylistEnrich refreshes imported tracks in the background without blocking the UI thread.
func SpawnPlaylistEnrich(db *sql.DB, client *http.Client, limiter *ratelimiter.Limiter, playlistID int64) {
	if playlistID <= 0 {
		return
	}
	go runEnrich(db, client, limiter, playlistID)
}

func runEnrich(db *sql.DB, client *http.Client, limiter *ratelimiter.Limiter, playlistID int64) {
	rows, err := loadAllRows(db, playlistID)
	if err != nil {
		return
	}
	for _, current := range rows {
		time.Sleep(enrichDelay)

		row, err := loadRow(db, playlistID, current.ID)
		if err != nil || row == nil || !needsEnrichment(*row) {
			continue
		}

		if strings.TrimSpace(row.PJMP3SourceID) == "" {
			if err := applySearchMetadata(db, client, limiter, playlistID, *row); err == nil {
				emitEvent("import-enrich-item-done", map[string]any{"playlistId": playlistID, "rowId": row.ID})
				row, _ = loadRow(db, playlistID, row.ID)
				if row == nil {
					continue
				}
			}
		}

		if strings.TrimSpace(row.PJMP3SourceID) == "" {
			continue
		}

		if path, err := ensureCoverFile(client, limiter, *row); err == nil && path != "" {
			_, _ = db.Exec(`UPDATE playlist_import_items SET cover_cache_path = ? WHERE id = ? AND playlist_id = ?`, path, row.ID, playlistID)
			emitEvent("import-enrich-item-done", map[string]any{"playlistId": playlistID, "rowId": row.ID})
		}

		row, _ = loadRow(db, playlistID, row.ID)
		if row == nil {
			continue
		}
		if strings.TrimSpace(row.Album) == "" || row.DurationMS <= 0 {
			if err := enrichSongPageAndAlbumSearch(db, client, limiter, playlistID, *row); err == nil {
				emitEvent("import-enrich-item-done", map[string]any{"playlistId": playlistID, "rowId": row.ID})
			}
		}
	}
	emitEvent("import-enrich-finished", map[string]any{"playlistId": playlistID})
}

func loadRow(db *sql.DB, playlistID, rowID int64) (*importRow, error) {
	row := importRow{}
	err := db.QueryRow(`
		SELECT id, title, artist, album, pjmp3_source_id, cover_url, cover_cache_path, duration_ms
		FROM playlist_import_items
		WHERE id = ? AND playlist_id = ?
	`, rowID, playlistID).Scan(
		&row.ID,
		&row.Title,
		&row.Artist,
		&row.Album,
		&row.PJMP3SourceID,
		&row.CoverURL,
		&row.CoverCachePath,
		&row.DurationMS,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func loadAllRows(db *sql.DB, playlistID int64) ([]importRow, error) {
	rows, err := db.Query(`
		SELECT id, title, artist, album, pjmp3_source_id, cover_url, cover_cache_path, duration_ms
		FROM playlist_import_items
		WHERE playlist_id = ?
		ORDER BY sort_order ASC, id ASC
	`, playlistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []importRow
	for rows.Next() {
		var row importRow
		if err := rows.Scan(
			&row.ID,
			&row.Title,
			&row.Artist,
			&row.Album,
			&row.PJMP3SourceID,
			&row.CoverURL,
			&row.CoverCachePath,
			&row.DurationMS,
		); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func needsEnrichment(row importRow) bool {
	if strings.TrimSpace(row.Title) == "" {
		return false
	}
	if strings.TrimSpace(row.PJMP3SourceID) == "" {
		return true
	}
	if strings.TrimSpace(row.CoverURL) != "" && (strings.TrimSpace(row.CoverCachePath) == "" || !fileExists(row.CoverCachePath)) {
		return true
	}
	return strings.TrimSpace(row.Album) == "" || row.DurationMS <= 0
}

func applySearchMetadata(db *sql.DB, client *http.Client, limiter *ratelimiter.Limiter, playlistID int64, row importRow) error {
	query := strings.TrimSpace(strings.TrimSpace(row.Title) + " " + strings.TrimSpace(row.Artist))
	if query == "" {
		query = strings.TrimSpace(row.Title)
	}
	if query == "" {
		return nil
	}
	limiter.AcquireSlot()
	results, _, err := musicsource.Current().Search(client, query, 1)
	if err != nil || len(results) == 0 {
		return err
	}
	first := results[0]
	if strings.TrimSpace(first.SourceID) == "" {
		return nil
	}
	coverPath := ""
	if first.CoverURL != nil {
		if path, err := cacheSearchCover(client, limiter, first); err == nil {
			coverPath = path
		}
	}
	coverURL := ""
	if first.CoverURL != nil {
		coverURL = *first.CoverURL
	}
	_, err = db.Exec(`
		UPDATE playlist_import_items
		SET title = ?, artist = ?, album = ?, pjmp3_source_id = ?, cover_url = ?, cover_cache_path = ?
		WHERE id = ? AND playlist_id = ?
	`, first.Title, first.Artist, first.Album, first.SourceID, coverURL, coverPath, row.ID, playlistID)
	return err
}

func enrichSongPageAndAlbumSearch(db *sql.DB, client *http.Client, limiter *ratelimiter.Limiter, playlistID int64, row importRow) error {
	if strings.TrimSpace(row.PJMP3SourceID) == "" {
		return nil
	}
	needAlbum := strings.TrimSpace(row.Album) == ""
	needDuration := row.DurationMS <= 0
	if !needAlbum && !needDuration {
		return nil
	}

	ref, err := musicsource.ParseSourceID(row.PJMP3SourceID)
	if err != nil {
		return err
	}

	limiter.AcquireSlot()
	html, _ := ref.Provider.FetchSongPageHTML(client, ref.RawID)
	album := row.Album
	durationMS := row.DurationMS
	if needAlbum {
		if value := ref.Provider.ExtractAlbumFromSongHTML(html); strings.TrimSpace(value) != "" {
			album = value
		}
	}
	if needDuration {
		if value := ref.Provider.ExtractDurationMSFromSongHTML(html); value > 0 {
			durationMS = value
		}
	}
	if needAlbum && strings.TrimSpace(album) == "" {
		query := strings.TrimSpace(strings.TrimSpace(row.Title) + " " + strings.TrimSpace(row.Artist))
		if query != "" {
			limiter.AcquireSlot()
			results, _, err := musicsource.Current().Search(client, query, 1)
			if err == nil && len(results) > 0 {
				first := results[0]
				if musicsource.SameSourceID(first.SourceID, row.PJMP3SourceID) && strings.TrimSpace(first.Album) != "" {
					album = first.Album
				}
			}
		}
	}
	_, execErr := db.Exec(`
		UPDATE playlist_import_items
		SET album = ?, duration_ms = ?
		WHERE id = ? AND playlist_id = ?
	`, album, durationMS, row.ID, playlistID)
	return execErr
}

func emitEvent(name string, payload any) {
	_ = application.Get().Event.Emit(name, payload)
}
