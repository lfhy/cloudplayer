package cloudplayer

import (
	"log"
	"strings"
	"sync"

	"cloudplayer/backend/core/cloudplayer/musicsource"
)

const (
	searchMetadataBatchLimit = 8
	searchMetadataWorkers    = 4
)

type searchMetadataJob struct {
	Index    int
	SourceID string
}

// Search metadata is fetched lazily because PJMP3 list pages only expose title, artist and cover.
func (s *CloudPlayerService) GetSearchSongMetadata(songIDs []string) ([]SearchSongMetadataRow, error) {
	normalized := normalizeSearchMetadataIDs(songIDs)
	if len(normalized) == 0 {
		return []SearchSongMetadataRow{}, nil
	}

	rows := make([]SearchSongMetadataRow, len(normalized))
	jobs := make([]searchMetadataJob, 0, len(normalized))
	for index, sourceID := range normalized {
		cacheKey := SearchSongMetadataCacheKey(sourceID)
		if cached, ok := s.state.SearchCache.GetSongMetadata(cacheKey); ok {
			rows[index] = ensureSearchMetadataSourceID(sourceID, cached)
			continue
		}
		jobs = append(jobs, searchMetadataJob{Index: index, SourceID: sourceID})
	}
	s.runSearchMetadataJobs(rows, jobs)
	return compactSearchMetadataRows(rows), nil
}

func (s *CloudPlayerService) runSearchMetadataJobs(rows []SearchSongMetadataRow, jobs []searchMetadataJob) {
	if len(jobs) == 0 {
		return
	}
	jobCh := make(chan searchMetadataJob)
	var wait sync.WaitGroup
	for worker := 0; worker < minInt(searchMetadataWorkers, len(jobs)); worker++ {
		wait.Add(1)
		go func() {
			defer wait.Done()
			for job := range jobCh {
				rows[job.Index] = s.fetchSearchMetadataRow(job.SourceID)
			}
		}()
	}
	for _, job := range jobs {
		jobCh <- job
	}
	close(jobCh)
	wait.Wait()
}

func (s *CloudPlayerService) fetchSearchMetadataRow(sourceID string) SearchSongMetadataRow {
	cacheKey := SearchSongMetadataCacheKey(sourceID)
	if cached, ok := s.state.SearchCache.GetSongMetadata(cacheKey); ok {
		return ensureSearchMetadataSourceID(sourceID, cached)
	}

	s.state.RateLimiter.AcquireSlot()
	metadata, err := musicsource.FetchSearchMetadata(s.state.HTTP(), sourceID)
	if err != nil {
		log.Printf("GetSearchSongMetadata failed: sourceID=%q err=%v", sourceID, err)
		return SearchSongMetadataRow{SourceID: musicsource.CanonicalSourceID(sourceID)}
	}

	row := SearchSongMetadataRow{
		SourceID:   metadata.SourceID,
		Album:      metadata.Album,
		DurationMS: metadata.DurationMS,
	}
	s.state.SearchCache.SetSongMetadata(cacheKey, row, s.state.SearchCacheTTL)
	return ensureSearchMetadataSourceID(sourceID, row)
}

func normalizeSearchMetadataIDs(songIDs []string) []string {
	seen := make(map[string]struct{}, len(songIDs))
	result := make([]string, 0, minInt(len(songIDs), searchMetadataBatchLimit))
	for _, raw := range songIDs {
		canonical := musicsource.CanonicalSourceID(strings.TrimSpace(raw))
		if canonical == "" {
			continue
		}
		if _, ok := seen[canonical]; ok {
			continue
		}
		seen[canonical] = struct{}{}
		result = append(result, canonical)
		if len(result) >= searchMetadataBatchLimit {
			break
		}
	}
	return result
}

func ensureSearchMetadataSourceID(sourceID string, row SearchSongMetadataRow) SearchSongMetadataRow {
	if strings.TrimSpace(row.SourceID) != "" {
		return row
	}
	row.SourceID = musicsource.CanonicalSourceID(sourceID)
	return row
}

func compactSearchMetadataRows(rows []SearchSongMetadataRow) []SearchSongMetadataRow {
	result := make([]SearchSongMetadataRow, 0, len(rows))
	for _, row := range rows {
		if strings.TrimSpace(row.SourceID) == "" {
			continue
		}
		result = append(result, row)
	}
	return result
}

func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}
