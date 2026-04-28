package main

// AppState owns the shared backend services that are wired into the Wails app lifecycle.

import (
	"database/sql"
	"net/http"
	"sync"
	"time"

	"cloudplayer/internal/cloudplayer/config"
	"cloudplayer/internal/cloudplayer/download"
	"cloudplayer/internal/cloudplayer/httpclient"
	"cloudplayer/internal/cloudplayer/ratelimiter"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type AppState struct {
	DB                   *sql.DB
	httpClientMu         sync.RWMutex
	HTTPClient           *http.Client
	HTTPJar              http.CookieJar
	SearchCache          *SearchCache
	SearchCacheTTL       time.Duration
	RateLimiter          *ratelimiter.Limiter
	DownloadCh           chan download.DownloadJob
	Hotkeys              *HotkeyManager
	SystemTray           *application.SystemTray
	AppTheme             string
	AppThemeCustomAccent string
}

func NewAppState(db *sql.DB) *AppState {
	jar := httpclient.NewJar()
	client, _ := httpclient.Build(config.DefaultSettings(), jar)
	return &AppState{
		DB:             db,
		HTTPClient:     client,
		HTTPJar:        jar,
		SearchCache:    NewSearchCache(),
		SearchCacheTTL: 24 * time.Hour,
		RateLimiter:    ratelimiter.New(45),
		DownloadCh:     make(chan download.DownloadJob, 64),
	}
}

func (s *AppState) SetSearchCacheTTLHours(hours int) {
	s.SearchCacheTTL = time.Duration(config.NormalizeSearchCacheTTLHours(hours)) * time.Hour
}

func (s *AppState) HTTP() *http.Client {
	s.httpClientMu.RLock()
	client := s.HTTPClient
	s.httpClientMu.RUnlock()
	return client
}

func (s *AppState) BuildHTTPClient(settings config.Settings) (*http.Client, error) {
	return httpclient.Build(settings, s.HTTPJar)
}

func (s *AppState) SwapHTTPClient(client *http.Client) {
	s.httpClientMu.Lock()
	previous := s.HTTPClient
	s.HTTPClient = client
	s.httpClientMu.Unlock()
	if previous != nil {
		previous.CloseIdleConnections()
	}
}

func (s *AppState) ApplyNetworkSettings(settings config.Settings) error {
	client, err := s.BuildHTTPClient(settings)
	if err != nil {
		return err
	}
	s.SwapHTTPClient(client)
	return nil
}

func (s *AppState) StartBackgroundWorkers() {
	go func() {
		for job := range s.DownloadCh {
			download.RunOneJob(s.HTTP(), job)
		}
	}()
}
