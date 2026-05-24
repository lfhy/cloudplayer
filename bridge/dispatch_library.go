package main

// Library dispatch exposes playlist, local-library, favorites, and recent-history operations.

import (
	"encoding/json"

	cloudplayer "cloudplayer/backend/app"
	"cloudplayer/backend/importplaylist"
)

type playlistIDArgs struct {
	PlaylistID int64 `json:"playlist_id"`
}

type playlistItemArgs struct {
	PlaylistID int64 `json:"playlist_id"`
	ItemID     int64 `json:"item_id"`
}

type playlistNameArgs struct {
	PlaylistID int64  `json:"playlist_id,omitempty"`
	Name       string `json:"name"`
}

type playlistItemsArgs struct {
	PlaylistID int64                             `json:"playlist_id"`
	Items      []importplaylist.ImportedTrackDTO `json:"items"`
}

type favoriteTrackArgs struct {
	Track cloudplayer.FavoriteTrackIn `json:"track"`
}

type sourceIDArgs struct {
	SourceID string `json:"source_id"`
}

type scanFolderArgs struct {
	Path string `json:"path"`
}

type recentPlayArgs struct {
	Row cloudplayer.RecentPlayIn `json:"row"`
}

func invokeLibraryMethod(runtime *bridgeRuntime, method string, args json.RawMessage) (any, bool, error) {
	switch method {
	case "list_playlists":
		rows, callErr := runtime.service.ListPlaylists()
		return rows, true, callErr
	case "list_playlist_import_items":
		payload, err := decodeArgs[playlistIDArgs](args)
		if err != nil {
			return nil, true, err
		}
		rows, callErr := runtime.service.ListPlaylistImportItems(payload.PlaylistID)
		return rows, true, callErr
	case "create_playlist":
		payload, err := decodeArgs[playlistNameArgs](args)
		if err != nil {
			return nil, true, err
		}
		id, callErr := runtime.service.CreatePlaylist(payload.Name)
		return id, true, callErr
	case "rename_playlist":
		payload, err := decodeArgs[playlistNameArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.RenamePlaylist(payload.PlaylistID, payload.Name)
	case "delete_playlist":
		payload, err := decodeArgs[playlistIDArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.DeletePlaylist(payload.PlaylistID)
	case "delete_playlist_import_item":
		payload, err := decodeArgs[playlistItemArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.DeletePlaylistImportItem(payload.PlaylistID, payload.ItemID)
	case "replace_playlist_import_items":
		payload, err := decodeArgs[playlistItemsArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.ReplacePlaylistImportItems(payload.PlaylistID, payload.Items)
	case "append_playlist_import_items":
		payload, err := decodeArgs[playlistItemsArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.AppendPlaylistImportItems(payload.PlaylistID, payload.Items)
	case "start_import_enrich":
		payload, err := decodeArgs[playlistIDArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.StartImportEnrich(payload.PlaylistID)
	case "ensure_favorites_playlist":
		row, callErr := runtime.service.EnsureFavoritesPlaylist()
		return row, true, callErr
	case "list_favorite_source_ids":
		rows, callErr := runtime.service.ListFavoriteSourceIDs()
		return rows, true, callErr
	case "add_favorite_track":
		payload, err := decodeArgs[favoriteTrackArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.AddFavoriteTrack(payload.Track)
	case "remove_favorite_track":
		payload, err := decodeArgs[sourceIDArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.RemoveFavoriteTrack(payload.SourceID)
	case "list_local_songs":
		rows, callErr := runtime.service.ListLocalSongs()
		return rows, true, callErr
	case "scan_music_folder":
		payload, err := decodeArgs[scanFolderArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.ScanMusicFolder(payload.Path)
		return result, true, callErr
	case "list_recent_plays":
		rows, callErr := runtime.service.ListRecentPlays()
		return rows, true, callErr
	case "record_recent_play":
		payload, err := decodeArgs[recentPlayArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.RecordRecentPlay(payload.Row)
	case "clear_recent_plays":
		return nil, true, runtime.service.ClearRecentPlays()
	case "repair_music_collection_database":
		result, callErr := runtime.service.RepairMusicCollectionDatabase()
		return result, true, callErr
	case "refresh_playlists":
		rows, callErr := runtime.service.RefreshPlaylists()
		return rows, true, callErr
	case "refresh_playlist_import_items":
		payload, err := decodeArgs[playlistIDArgs](args)
		if err != nil {
			return nil, true, err
		}
		rows, callErr := runtime.service.RefreshPlaylistImportItems(payload.PlaylistID)
		return rows, true, callErr
	default:
		return nil, false, nil
	}
}
