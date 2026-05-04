package importenrich

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"cloudplayer/backend/core/cloudplayer/config"
	"cloudplayer/backend/core/cloudplayer/musicsource"
	"cloudplayer/backend/core/cloudplayer/ratelimiter"
)

// Cover helpers keep enrichment network fetches and cache paths separate from DB traversal.
func coverCacheDir() string {
	return filepath.Join(config.ConfigDir(), "cover_cache")
}

func cacheSearchCover(client *http.Client, limiter *ratelimiter.Limiter, first musicsource.SearchResult) (string, error) {
	if first.CoverURL == nil || strings.TrimSpace(*first.CoverURL) == "" {
		return "", nil
	}
	if err := os.MkdirAll(coverCacheDir(), 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(coverCacheDir(), "cov_"+musicsource.SafeCacheKey(first.SourceID)+".jpg")
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
	path := filepath.Join(coverCacheDir(), "cov_"+musicsource.SafeCacheKey(row.PJMP3SourceID)+".jpg")
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

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
