package cloudplayer

// Daily recommendation service fetches picks from Kugou, caches them in SQLite
// for cross-restart persistence, and keeps a short-lived in-memory layer for speed.

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"cloudplayer/backend/model"
	"cloudplayer/backend/musicsource"
)

var (
	dailyRecMu   sync.Mutex
	dailyRecDate string
	dailyRecRows []musicsource.SearchResult
	dailyRecSrc  string
)

// GetDailyRecommendation returns today's picks. It checks the in-memory cache
// first, then the SQLite table, and only calls Kugou when neither has data.
func (s *CloudPlayerService) GetDailyRecommendation() (model.DailyRecommendationResponse, error) {
	today := time.Now().Format("2006-01-02")

	dailyRecMu.Lock()
	if dailyRecDate == today && len(dailyRecRows) > 0 {
		rows := cloneSearchResults(dailyRecRows)
		src := dailyRecSrc
		dailyRecMu.Unlock()
		return model.DailyRecommendationResponse{Date: today, Rows: rows, Source: src}, nil
	}
	dailyRecMu.Unlock()

	dbRows, dbSrc, found, err := loadDailyRecommendation(s.state.DB, today)
	if err != nil {
		log.Printf("daily recommend: db load failed: %v", err)
	} else if found && len(dbRows) > 0 {
		dailyRecMu.Lock()
		dailyRecDate = today
		dailyRecRows = cloneSearchResults(dbRows)
		dailyRecSrc = dbSrc
		dailyRecMu.Unlock()
		return model.DailyRecommendationResponse{Date: today, Rows: dbRows, Source: dbSrc}, nil
	}

	rows, source, err := s.fetchKugouDailyRecommend()
	if err != nil {
		log.Printf("daily recommend: kugou fetch failed: %v", err)
		return model.DailyRecommendationResponse{Date: today, Rows: nil, Source: "none"}, nil
	}

	if saveErr := saveDailyRecommendation(s.state.DB, today, source, rows); saveErr != nil {
		log.Printf("daily recommend: db save failed: %v", saveErr)
	}

	dailyRecMu.Lock()
	dailyRecDate = today
	dailyRecRows = cloneSearchResults(rows)
	dailyRecSrc = source
	dailyRecMu.Unlock()

	return model.DailyRecommendationResponse{Date: today, Rows: rows, Source: source}, nil
}

// fetchKugouDailyRecommend calls the Kugou SDK daily recommend endpoint and maps results.
func (s *CloudPlayerService) fetchKugouDailyRecommend() ([]musicsource.SearchResult, string, error) {
	client, session, err := kugouClientFromSession()
	if err != nil {
		return nil, "", fmt.Errorf("init kugou client: %w", err)
	}
	cookie := session.Cookie
	if len(cookie) == 0 {
		cookie = map[string]string{}
	}

	resp, err := client.GetDailyRecommendGuest(context.Background(), cookie)
	if err != nil {
		return nil, "", fmt.Errorf("get daily recommend: %w", err)
	}
	if resp == nil || resp.Body == nil {
		return nil, "", fmt.Errorf("empty daily recommend response")
	}

	items := kugouFindTrackItems(resp.Body)
	if len(items) == 0 {
		return nil, "", fmt.Errorf("no tracks in daily recommend response")
	}

	results := make([]musicsource.SearchResult, 0, len(items))
	for _, item := range items {
		hash := strings.ToLower(strings.TrimSpace(kugouMapString(item, "hash", "audio_hash", "file_hash", "hash_128", "hash_320", "hash_flac")))
		title := kugouTrackTitle(item)
		if hash == "" || title == "" {
			continue
		}
		albumAudioID := kugouMapInt(item, "album_audio_id", "albumaudioid", "mixsongid", "mixsong_id")
		durationMS := kugouTrackDurationMS(item)
		cover := kugouMapCoverString(item)
		var coverPtr *string
		if cover != "" {
			coverPtr = &cover
		}
		sourceID := musicsource.EncodeSourceID(musicsource.ProviderKugou, encodeKugouImportRawID(hash, albumAudioID))
		if albumAudioID <= 0 {
			sourceID = musicsource.EncodeSourceID(musicsource.ProviderKugou, strings.ToLower(hash))
		}
		results = append(results, musicsource.SearchResult{
			SourceID:   sourceID,
			Title:      title,
			Artist:     kugouTrackArtist(item),
			Album:      kugouTrackAlbum(item),
			DurationMS: durationMS,
			CoverURL:   coverPtr,
		})
	}

	if len(results) == 0 {
		return nil, "", fmt.Errorf("no valid tracks parsed from daily recommend")
	}
	if len(results) > 50 {
		results = results[:50]
	}

	log.Printf("daily recommend: fetched %d tracks from kugou (userid=%s)", len(results), strings.TrimSpace(session.Cookie["userid"]))
	return results, "kugou", nil
}

func cloneSearchResults(rows []musicsource.SearchResult) []musicsource.SearchResult {
	if len(rows) == 0 {
		return nil
	}
	out := make([]musicsource.SearchResult, len(rows))
	copy(out, rows)
	return out
}
