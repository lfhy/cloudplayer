package cloudplayer

import (
	"testing"

	"cloudplayer/backend/config"
	"cloudplayer/backend/db"
	"cloudplayer/backend/state"
)

// Offline playlist projection tests guard against hybrid cloud forks leaking into the pure local mode sidebar.
func TestListPlaylistsOfflineHidesHybridCloudForks(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicCollectionMode = config.MusicCollectionModeOffline
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}

	conn, err := db.OpenAndInit()
	if err != nil {
		t.Fatalf("OpenAndInit() error = %v", err)
	}
	t.Cleanup(func() {
		_ = conn.Close()
	})

	service := &CloudPlayerService{state: state.NewAppState(conn)}
	favorites, err := service.ensureFavoritesPlaylist()
	if err != nil {
		t.Fatalf("ensureFavoritesPlaylist() error = %v", err)
	}
	if _, err := conn.Exec(`
		UPDATE playlists
		SET cloud_source = 'kugou', cloud_list_id = 1001, cloud_writable = 1
		WHERE id = ?
	`, favorites.ID); err != nil {
		t.Fatalf("update favorites cloud binding error = %v", err)
	}
	if _, err := conn.Exec(`
		INSERT INTO playlists (name, is_builtin, cloud_source, cloud_list_id, cloud_writable)
		VALUES ('云歌单', 0, 'kugou', 2002, 1)
	`); err != nil {
		t.Fatalf("insert hybrid cloud fork error = %v", err)
	}
	if _, err := conn.Exec(`
		INSERT INTO playlists (name, is_builtin, cloud_source, cloud_list_id, cloud_writable)
		VALUES ('本地歌单', 0, '', 0, 0)
	`); err != nil {
		t.Fatalf("insert local playlist error = %v", err)
	}

	playlists, err := service.ListPlaylists()
	if err != nil {
		t.Fatalf("ListPlaylists() error = %v", err)
	}
	if len(playlists) != 2 {
		t.Fatalf("ListPlaylists() len = %d want 2", len(playlists))
	}

	foundFavorites := false
	foundLocal := false
	for _, playlist := range playlists {
		switch playlist.Name {
		case builtinFavoritesName:
			foundFavorites = true
			if playlist.IsCloud {
				t.Fatalf("favorites should appear local in offline mode: %#v", playlist)
			}
		case "本地歌单":
			foundLocal = true
		case "云歌单":
			t.Fatalf("hybrid cloud fork leaked into offline list: %#v", playlist)
		}
	}
	if !foundFavorites || !foundLocal {
		t.Fatalf("offline playlists missing expected rows: %#v", playlists)
	}
}
