package main

import "github.com/wailsapp/wails/v3/pkg/application"

func EmitImportEnrichFinished(playlistID int64) {
	_ = application.Get().Event.Emit("import-enrich-finished", map[string]any{
		"playlistId": playlistID,
	})
}
