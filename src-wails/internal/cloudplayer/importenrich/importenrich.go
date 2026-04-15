package importenrich

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloudplayer/internal/cloudplayer/config"
	"cloudplayer/internal/cloudplayer/pjmp3"
	"cloudplayer/internal/cloudplayer/ratelimiter"
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

func coverCacheDir() string {
	return filepath.Join(config.ConfigDir(), "cover_cache")
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
	results, _, err := pjmp3.SearchPjmp3(client, query, 1)
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

func cacheSearchCover(client *http.Client, limiter *ratelimiter.Limiter, first pjmp3.SearchResult) (string, error) {
	if first.CoverURL == nil || strings.TrimSpace(*first.CoverURL) == "" {
		return "", nil
	}
	if err := os.MkdirAll(coverCacheDir(), 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(coverCacheDir(), "cov_"+strings.TrimSpace(first.SourceID)+".jpg")
	limiter.AcquireSlot()
	if err := downloadCover(client, *first.CoverURL, path); err != nil {
		return "", err
	}
	return path, nil
}

func ensureCoverFile(client *http.Client, limiter *ratelimiter.Limiter, row importRow) (string, error) {
	if strings.TrimSpace(row.PJMP3SourceID) == "" || strings.TrimSpace(row.CoverURL) == "" {
		return "", nil
	}
	if strings.TrimSpace(row.CoverCachePath) != "" && fileExists(row.CoverCachePath) {
		return "", nil
	}
	if err := os.MkdirAll(coverCacheDir(), 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(coverCacheDir(), "cov_"+strings.TrimSpace(row.PJMP3SourceID)+".jpg")
	limiter.AcquireSlot()
	if err := downloadCover(client, row.CoverURL, path); err != nil {
		return "", err
	}
	return path, nil
}

func downloadCover(client *http.Client, rawURL, dest string) error {
	request, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	request.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	request.Header.Set("Accept", "image/*,*/*;q=0.8")
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("http %s", response.Status)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return err
	}
	if len(body) < 32 {
		return fmt.Errorf("cover too small")
	}
	return os.WriteFile(dest, body, 0o644)
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

	limiter.AcquireSlot()
	html, _ := pjmp3.FetchSongPageHTML(client, row.PJMP3SourceID)
	album := row.Album
	durationMS := row.DurationMS
	if needAlbum {
		if value := pjmp3.ExtractAlbumFromSongHTML(html); strings.TrimSpace(value) != "" {
			album = value
		}
	}
	if needDuration {
		if value := pjmp3.ExtractDurationMSFromSongHTML(html); value > 0 {
			durationMS = value
		}
	}
	if needAlbum && strings.TrimSpace(album) == "" {
		query := strings.TrimSpace(strings.TrimSpace(row.Title) + " " + strings.TrimSpace(row.Artist))
		if query != "" {
			limiter.AcquireSlot()
			results, _, err := pjmp3.SearchPjmp3(client, query, 1)
			if err == nil && len(results) > 0 {
				first := results[0]
				if strings.TrimSpace(first.SourceID) == strings.TrimSpace(row.PJMP3SourceID) && strings.TrimSpace(first.Album) != "" {
					album = first.Album
				}
			}
		}
	}
	_, err := db.Exec(`
		UPDATE playlist_import_items
		SET album = ?, duration_ms = ?
		WHERE id = ? AND playlist_id = ?
	`, album, durationMS, row.ID, playlistID)
	return err
}

func emitEvent(name string, payload any) {
	_ = application.Get().Event.Emit(name, payload)
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
