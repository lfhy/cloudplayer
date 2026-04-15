package main

import (
	"embed"
	"log"
	"net/http"

	"cloudplayer/internal/cloudplayer/db"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	conn, err := db.OpenAndInit()
	if err != nil {
		log.Fatal(err)
	}
	state := NewAppState(conn)
	state.StartBackgroundWorkers()
	cloudPlayer := NewCloudPlayerService(state)
	desktop := &DesktopService{}

	baseAssets := application.BundledAssetFileServer(assets)
	app := application.New(application.Options{
		Name:        "CloudPlayer",
		Description: "CloudPlayer desktop rebuilt with Wails v3",
		Services: []application.Service{
			application.NewService(cloudPlayer),
			application.NewService(desktop),
		},
		Assets: application.AssetOptions{
			Handler: mediaHandler(baseAssets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "main",
		Title:            "CloudPlayer",
		Width:            1100,
		Height:           700,
		URL:              "/",
		BackgroundColour: application.NewRGB(245, 245, 247),
	})
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

func mediaHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/__media__" {
			path := request.URL.Query().Get("path")
			if path == "" {
				http.NotFound(writer, request)
				return
			}
			http.ServeFile(writer, request, path)
			return
		}
		next.ServeHTTP(writer, request)
	})
}
