package cloudplayer

import (
	"database/sql"
	"testing"

	"cloudplayer/backend/config"
	"cloudplayer/backend/db"
	"cloudplayer/backend/importplaylist"
	"cloudplayer/backend/state"
)

// Database repair tests ensure broken hybrid cloud forks can be reset back to a purely local library snapshot.
func TestRepairMusicCollectionDatabaseClearsCloudForksAndForcesOffline(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicCollectionMode = config.MusicCollectionModeHybrid
	settings.MusicOnlineMode = false
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
		t.Fatalf("bind favorites cloud source error = %v", err)
	}
	cloudPlaylistID, err := service.createLocalPlaylist("云歌单副本", kugouSyncOrigin, 2002, true)
	if err != nil {
		t.Fatalf("createLocalPlaylist() cloud error = %v", err)
	}
	localPlaylistID, err := service.createLocalPlaylist("本地歌单", "", 0, false)
	if err != nil {
		t.Fatalf("createLocalPlaylist() local error = %v", err)
	}
	if err := service.appendLocalPlaylistItems(favorites.ID, favoriteRepairTrack().dto(), ""); err != nil {
		t.Fatalf("appendLocalPlaylistItems() favorites local error = %v", err)
	}
	if err := service.appendLocalPlaylistItems(cloudPlaylistID, cloudRepairTrack().dto(), ""); err != nil {
		t.Fatalf("appendLocalPlaylistItems() cloud local error = %v", err)
	}
	if err := service.appendLocalPlaylistItems(localPlaylistID, localRepairTrack().dto(), ""); err != nil {
		t.Fatalf("appendLocalPlaylistItems() local playlist error = %v", err)
	}
	if _, err := conn.Exec(`
		INSERT INTO playlist_import_items (
			playlist_id, sort_order, title, artist, album, pjmp3_source_id, kugou_file_id, sync_origin
		) VALUES
			(?, 10, '云端喜欢', 'Kugou', '', 'kugou:fav', 91001, 'kugou'),
			(?, 11, '云端副本', 'Kugou', '', 'kugou:copy', 91002, 'kugou')
	`, favorites.ID, cloudPlaylistID); err != nil {
		t.Fatalf("insert cloud repair rows error = %v", err)
	}
	if _, err := conn.Exec(`
		INSERT INTO playlist_songs (playlist_id, song_id, position)
		VALUES (?, 1, 0)
	`, cloudPlaylistID); err != nil {
		t.Fatalf("insert playlist_songs cloud row error = %v", err)
	}
	if _, err := conn.Exec(`
		INSERT INTO kugou_playlist_cache (user_id, playlist_id, sort_order, name, cover_url, track_count, fetched_at)
		VALUES ('123456', 2002, 0, '云歌单副本', '', 2, 123)
	`); err != nil {
		t.Fatalf("insert kugou playlist cache error = %v", err)
	}
	if _, err := conn.Exec(`
		INSERT INTO kugou_playlist_cache_items (user_id, playlist_id, sort_order, title, artist, album, pjmp3_source_id, fileid, cover_url, duration_ms, fetched_at)
		VALUES ('123456', 2002, 0, '缓存歌曲', 'Kugou', '', 'kugou:cache', 92001, '', 0, 123)
	`); err != nil {
		t.Fatalf("insert kugou playlist item cache error = %v", err)
	}

	result, err := service.RepairMusicCollectionDatabase()
	if err != nil {
		t.Fatalf("RepairMusicCollectionDatabase() error = %v", err)
	}
	if result.Mode != config.MusicCollectionModeOffline {
		t.Fatalf("RepairMusicCollectionDatabase() mode = %q want %q", result.Mode, config.MusicCollectionModeOffline)
	}
	if result.RemovedCloudPlaylists != 1 {
		t.Fatalf("RepairMusicCollectionDatabase() removed cloud playlists = %d want 1", result.RemovedCloudPlaylists)
	}
	if result.DetachedCloudBindings != 1 {
		t.Fatalf("RepairMusicCollectionDatabase() detached cloud bindings = %d want 1", result.DetachedCloudBindings)
	}
	if result.ClearedCloudPlaylistCache != 1 || result.ClearedCloudPlaylistItemCache != 1 {
		t.Fatalf("RepairMusicCollectionDatabase() cache cleanup = %#v", result)
	}

	latest := config.LoadSettings()
	if latest.MusicCollectionMode != config.MusicCollectionModeOffline || latest.MusicOnlineMode {
		t.Fatalf("settings after repair = %#v", latest)
	}

	playlists, err := service.listLocalPlaylists()
	if err != nil {
		t.Fatalf("listLocalPlaylists() error = %v", err)
	}
	if len(playlists) != 2 {
		t.Fatalf("listLocalPlaylists() len = %d want 2", len(playlists))
	}

	var favoritesChecked, localChecked bool
	for _, playlist := range playlists {
		switch playlist.Name {
		case builtinFavoritesName:
			favoritesChecked = true
			if playlist.IsCloud || playlist.CloudSource != "" || playlist.CloudListID != nil || playlist.CloudWritable {
				t.Fatalf("favorites should be local after repair: %#v", playlist)
			}
			rows, rowErr := service.listLocalPlaylistImportItems(playlist.ID)
			if rowErr != nil {
				t.Fatalf("listLocalPlaylistImportItems() favorites error = %v", rowErr)
			}
			if len(rows) != 1 || rows[0].Pjmp3SourceID != "local:favorites" {
				t.Fatalf("favorites rows after repair = %#v", rows)
			}
		case "本地歌单":
			localChecked = true
			rows, rowErr := service.listLocalPlaylistImportItems(playlist.ID)
			if rowErr != nil {
				t.Fatalf("listLocalPlaylistImportItems() local error = %v", rowErr)
			}
			if len(rows) != 1 || rows[0].Pjmp3SourceID != "local:playlist" {
				t.Fatalf("local playlist rows after repair = %#v", rows)
			}
		case "云歌单副本":
			t.Fatalf("cloud playlist should be removed after repair: %#v", playlist)
		}
	}
	if !favoritesChecked || !localChecked {
		t.Fatalf("repaired local playlists missing expected rows: %#v", playlists)
	}

	assertRepairCount(t, conn, `SELECT COUNT(*) FROM kugou_playlist_cache`, 0, "kugou playlist cache")
	assertRepairCount(t, conn, `SELECT COUNT(*) FROM kugou_playlist_cache_items`, 0, "kugou playlist item cache")
	assertRepairCount(t, conn, `SELECT COUNT(*) FROM playlists WHERE name = '云歌单副本'`, 0, "cloud playlists")
	assertRepairCount(t, conn, `SELECT COUNT(*) FROM playlist_import_items WHERE sync_origin = 'kugou'`, 0, "cloud import rows")
}

func favoriteRepairTrack() importTrackRepairInput {
	return importTrackRepairInput{Title: "本地喜欢", Artist: "Local", SourceID: "local:favorites"}
}

func cloudRepairTrack() importTrackRepairInput {
	return importTrackRepairInput{Title: "副本本地歌", Artist: "Local", SourceID: "local:cloud-fallback"}
}

func localRepairTrack() importTrackRepairInput {
	return importTrackRepairInput{Title: "本地歌单歌曲", Artist: "Local", SourceID: "local:playlist"}
}

type importTrackRepairInput struct {
	Title    string
	Artist   string
	SourceID string
}

func (row importTrackRepairInput) dto() []importplaylist.ImportedTrackDTO {
	return []importplaylist.ImportedTrackDTO{{
		Title:         row.Title,
		Artist:        row.Artist,
		Pjmp3SourceID: row.SourceID,
	}}
}

func assertRepairCount(t *testing.T, conn *sql.DB, query string, want int, label string) {
	t.Helper()
	var got int
	if err := conn.QueryRow(query).Scan(&got); err != nil {
		t.Fatalf("%s count query error = %v", label, err)
	}
	if got != want {
		t.Fatalf("%s count = %d want %d", label, got, want)
	}
}
