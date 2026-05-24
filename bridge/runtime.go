package main

// Runtime bootstrap creates one reusable CloudPlayer service instance for the Flutter bridge.

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"

	cloudplayer "cloudplayer/backend/app"
	"cloudplayer/backend/config"
	"cloudplayer/backend/db"
	"cloudplayer/backend/state"
)

type bridgeRuntime struct {
	service        *cloudplayer.CloudPlayerService
	mediaProxyBase string
}

var (
	runtimeOnce sync.Once
	runtimeInst *bridgeRuntime
	runtimeErr  error
)

func ensureRuntime() (*bridgeRuntime, error) {
	runtimeOnce.Do(func() {
		if err := cloudplayer.InitAppLogging(); err != nil {
			log.Printf("bridge logging init failed: %v", err)
		}

		conn, err := db.OpenAndInit()
		if err != nil {
			runtimeErr = fmt.Errorf("open database: %w", err)
			return
		}

		appState := state.NewAppState(conn)
		settings := config.LoadSettings()
		if err := appState.ApplyNetworkSettings(settings); err != nil {
			log.Printf("bridge network settings fallback to direct client: %v", err)
		}
		appState.AppTheme = settings.AppTheme
		appState.AppThemeCustomAccent = settings.AppThemeCustomAccent
		appState.StartBackgroundWorkers()
		mediaProxyBase, err := startMediaProxyServer(appState)
		if err != nil {
			runtimeErr = fmt.Errorf("start media proxy: %w", err)
			return
		}
		runtimeInst = &bridgeRuntime{
			service:        cloudplayer.NewCloudPlayerService(appState),
			mediaProxyBase: mediaProxyBase,
		}
	})
	return runtimeInst, runtimeErr
}

func startMediaProxyServer(appState *state.AppState) (string, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	handler := cloudplayer.NewRemoteMediaHandler(appState, http.NotFoundHandler())
	server := &http.Server{Handler: handler}
	go func() {
		if serveErr := server.Serve(listener); serveErr != nil &&
			serveErr != http.ErrServerClosed {
			log.Printf("bridge media proxy stopped: %v", serveErr)
		}
	}()
	return "http://" + listener.Addr().String(), nil
}
