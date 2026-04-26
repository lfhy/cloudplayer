package main

import (
	"database/sql"
	"net/http"
	"net/http/cookiejar"
	"time"

	"cloudplayer/internal/cloudplayer/download"
	"cloudplayer/internal/cloudplayer/ratelimiter"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type AppState struct {
	DB                   *sql.DB
	HTTPClient           *http.Client
	RateLimiter          *ratelimiter.Limiter
	DownloadCh           chan download.DownloadJob
	Hotkeys              *HotkeyManager
	SystemTray           *application.SystemTray
	AppTheme             string
	AppThemeCustomAccent string
}

func NewAppState(db *sql.DB) *AppState {
	jar, _ := cookiejar.New(nil)
	return &AppState{
		DB: db,
		HTTPClient: &http.Client{
			Timeout: 45 * time.Second,
			Jar:     jar,
		},
		RateLimiter: ratelimiter.New(45),
		DownloadCh:  make(chan download.DownloadJob, 64),
	}
}

func (s *AppState) StartBackgroundWorkers() {
	go func() {
		for job := range s.DownloadCh {
			download.RunOneJob(s.HTTPClient, job)
		}
	}()
}
