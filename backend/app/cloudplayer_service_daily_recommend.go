package cloudplayer

// Daily recommendation service delegates provider-specific fetching through the
// musicsource.Provider interface so adding new sources does not require changes here.

import (
	"log"
	"sync"
	"time"

	"cloudplayer/backend/model"
	"cloudplayer/backend/musicsource"
)

const dailyRecLimit = 50

var (
	dailyRecMu   sync.Mutex
	dailyRecDate string
	dailyRecRows []musicsource.SearchResult
	dailyRecSrc  string
)

// GetDailyRecommendation returns today's picks. It checks the in-memory cache
// first, then the SQLite table, and only calls the current provider when neither has data.
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

	provider := musicsource.Current()
	rows, err := provider.FetchDailyRecommendations(nil, dailyRecLimit)
	if err != nil {
		log.Printf("daily recommend: provider %q fetch failed: %v", provider.Key(), err)
		return model.DailyRecommendationResponse{Date: today, Rows: nil, Source: "none"}, nil
	}
	source := provider.Key()

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

func cloneSearchResults(rows []musicsource.SearchResult) []musicsource.SearchResult {
	if len(rows) == 0 {
		return nil
	}
	out := make([]musicsource.SearchResult, len(rows))
	copy(out, rows)
	return out
}
