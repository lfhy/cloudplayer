package cloudplayer

// Hybrid favorites tests guard against duplicate built-in "我喜欢" playlists when cloud forks attach.

import (
	"testing"

	"cloudplayer/backend/config"
	"cloudplayer/backend/db"
	"cloudplayer/backend/state"
)

func TestEnsureFavoritesPlaylistHybridReusesExistingBuiltinFavorites(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicCollectionMode = config.MusicCollectionModeOffline
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}
	if err := config.SaveKugouSession(config.KugouSession{
		Cookie: map[string]string{"userid": "123456"},
	}); err != nil {
		t.Fatalf("SaveKugouSession() error = %v", err)
	}

	conn, err := db.OpenAndInit()
	if err != nil {
		t.Fatalf("OpenAndInit() error = %v", err)
	}
	t.Cleanup(func() {
		_ = conn.Close()
	})

	service := &CloudPlayerService{state: state.NewAppState(conn)}
	localFavorites, err := service.ensureFavoritesPlaylist()
	if err != nil {
		t.Fatalf("ensureFavoritesPlaylist() offline error = %v", err)
	}

	settings.MusicCollectionMode = config.MusicCollectionModeHybrid
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() hybrid error = %v", err)
	}
	if err := service.saveKugouPlaylistCache("123456", []KugouPlaylistRow{{
		ID:          987654,
		Name:        builtinFavoritesName,
		TrackCount:  5,
		IsFavorites: true,
	}}); err != nil {
		t.Fatalf("saveKugouPlaylistCache() error = %v", err)
	}

	playlist, err := service.EnsureFavoritesPlaylist()
	if err != nil {
		t.Fatalf("EnsureFavoritesPlaylist() hybrid error = %v", err)
	}
	if playlist.ID != localFavorites.ID {
		t.Fatalf("EnsureFavoritesPlaylist() reused id = %d want %d", playlist.ID, localFavorites.ID)
	}
	if playlist.CloudSource != kugouSyncOrigin {
		t.Fatalf("EnsureFavoritesPlaylist() cloud source = %q", playlist.CloudSource)
	}
	if playlist.CloudListID == nil || *playlist.CloudListID != 987654 {
		t.Fatalf("EnsureFavoritesPlaylist() cloud list id = %#v", playlist.CloudListID)
	}

	var favoritesCount int
	if err := conn.QueryRow(`
		SELECT COUNT(*)
		FROM playlists
		WHERE TRIM(name) = ?
	`, builtinFavoritesName).Scan(&favoritesCount); err != nil {
		t.Fatalf("count favorites playlists error = %v", err)
	}
	if favoritesCount != 1 {
		t.Fatalf("favorites playlist count = %d want 1", favoritesCount)
	}
}

func TestHybridFavoritesKeepLocalFallbackItemsWhenCloudFavoritesMerge(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)
	t.Setenv("USERPROFILE", tempHome)

	settings := config.DefaultSettings()
	settings.MusicCollectionMode = config.MusicCollectionModeOffline
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}
	if err := config.SaveKugouSession(config.KugouSession{
		Cookie: map[string]string{"userid": "123456"},
	}); err != nil {
		t.Fatalf("SaveKugouSession() error = %v", err)
	}

	conn, err := db.OpenAndInit()
	if err != nil {
		t.Fatalf("OpenAndInit() error = %v", err)
	}
	t.Cleanup(func() {
		_ = conn.Close()
	})

	service := &CloudPlayerService{state: state.NewAppState(conn)}
	playlist, err := service.ensureFavoritesPlaylist()
	if err != nil {
		t.Fatalf("ensureFavoritesPlaylist() error = %v", err)
	}
	if err := service.addLocalFavoriteTrack(FavoriteTrackIn{
		Title:         "Local Only",
		Artist:        "Fallback Artist",
		Pjmp3SourceID: "netease:local-only",
	}); err != nil {
		t.Fatalf("addLocalFavoriteTrack() error = %v", err)
	}

	settings.MusicCollectionMode = config.MusicCollectionModeHybrid
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings() hybrid error = %v", err)
	}
	if err := service.saveKugouPlaylistCache("123456", []KugouPlaylistRow{{
		ID:          987654,
		Name:        builtinFavoritesName,
		TrackCount:  1,
		IsFavorites: true,
	}}); err != nil {
		t.Fatalf("saveKugouPlaylistCache() error = %v", err)
	}
	playlist, err = service.EnsureFavoritesPlaylist()
	if err != nil {
		t.Fatalf("EnsureFavoritesPlaylist() error = %v", err)
	}
	if err := service.mergeHybridCloudItems(playlist.ID, []PlaylistImportItemRow{{
		Title:         "Cloud Favorite",
		Artist:        "Kugou Artist",
		Pjmp3SourceID: "kugou:cloud-favorite",
		KugouFileID:   7654321,
		SyncOrigin:    kugouSyncOrigin,
	}}); err != nil {
		t.Fatalf("mergeHybridCloudItems() error = %v", err)
	}

	rows, err := service.listLocalPlaylistImportItems(playlist.ID)
	if err != nil {
		t.Fatalf("listLocalPlaylistImportItems() error = %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("favorites rows len = %d want 2", len(rows))
	}
	foundLocal := false
	foundCloud := false
	for _, row := range rows {
		if row.Pjmp3SourceID == "netease:local-only" && row.SyncOrigin != kugouSyncOrigin {
			foundLocal = true
		}
		if row.Pjmp3SourceID == "kugou:cloud-favorite" && row.SyncOrigin == kugouSyncOrigin {
			foundCloud = true
		}
	}
	if !foundLocal || !foundCloud {
		t.Fatalf("favorites rows = %#v", rows)
	}
}
