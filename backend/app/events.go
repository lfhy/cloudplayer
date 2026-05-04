package cloudplayer

import "github.com/wailsapp/wails/v3/pkg/application"

// EmitImportEnrichFinished notifies the frontend that playlist enrichment has completed.
func EmitImportEnrichFinished(playlistID int64) {
	_ = application.Get().Event.Emit("import-enrich-finished", map[string]any{
		"playlistId": playlistID,
	})
}
