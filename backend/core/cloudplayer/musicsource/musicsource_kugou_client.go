package musicsource

import (
	"cloudplayer/backend/core/cloudplayer/config"

	kg "github.com/lfhy/kugou-music-api"
)

// newKugouClient reuses persisted Lite cookies so playback URLs resolve like the logged-in app.
func newKugouClient() (*kg.Client, error) {
	session := config.LoadKugouSession()
	return kg.New(kg.WithLite(true), kg.WithCookie(session.Cookie))
}
