package main

// Playback dispatch owns search, import parsing, download, playback, and lyrics bridge methods.

import (
	"encoding/json"

	"cloudplayer/backend/download"
	"cloudplayer/backend/lyrics"
)

type searchSongsArgs struct {
	Keyword string `json:"keyword"`
	Page    uint32 `json:"page"`
}

type songIDsArgs struct {
	SongIDs []string `json:"song_ids"`
}

type songIDArgs struct {
	SongID string `json:"song_id"`
}

type resolveOnlinePlayArgs struct {
	SongID string `json:"song_id"`
	Title  string `json:"title"`
	Artist string `json:"artist"`
}

type parseImportTextArgs struct {
	Text   string `json:"text"`
	Format string `json:"format"`
}

type fetchSharePlaylistArgs struct {
	RawURL string `json:"raw_url"`
}

type dailyRecommendationArgs struct {
	Force bool `json:"force"`
}

type enqueueDownloadArgs struct {
	Job download.DownloadJob `json:"job"`
}

type fetchLyricsArgs struct {
	Request lyrics.FetchRequest `json:"request"`
}

type saveLyricsOverrideArgs struct {
	Request lyrics.FetchRequest  `json:"request"`
	Payload lyrics.LyricsPayload `json:"payload"`
}

type lyricsSearchArgs struct {
	Keyword    string   `json:"keyword"`
	DurationMS *int64   `json:"duration_ms,omitempty"`
	Sources    []string `json:"sources"`
}

type lyricsCandidateArgs struct {
	Candidate lyrics.LyricCandidate `json:"candidate"`
}

func invokePlaybackMethod(runtime *bridgeRuntime, method string, args json.RawMessage) (any, bool, error) {
	switch method {
	case "search_songs":
		payload, err := decodeArgs[searchSongsArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.SearchSongs(payload.Keyword, payload.Page)
		return result, true, callErr
	case "get_search_song_metadata":
		payload, err := decodeArgs[songIDsArgs](args)
		if err != nil {
			return nil, true, err
		}
		rows, callErr := runtime.service.GetSearchSongMetadata(payload.SongIDs)
		return rows, true, callErr
	case "get_preview_url":
		payload, err := decodeArgs[songIDArgs](args)
		if err != nil {
			return nil, true, err
		}
		url, callErr := runtime.service.GetPreviewURL(payload.SongID)
		return url, true, callErr
	case "cache_preview_for_play":
		payload, err := decodeArgs[songIDArgs](args)
		if err != nil {
			return nil, true, err
		}
		path, callErr := runtime.service.CachePreviewForPlay(payload.SongID)
		return path, true, callErr
	case "resolve_online_play":
		payload, err := decodeArgs[resolveOnlinePlayArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.ResolveOnlinePlay(payload.SongID, payload.Title, payload.Artist)
		return result, true, callErr
	case "parse_import_text":
		payload, err := decodeArgs[parseImportTextArgs](args)
		if err != nil {
			return nil, true, err
		}
		rows, callErr := runtime.service.ParseImportText(payload.Text, payload.Format)
		return rows, true, callErr
	case "fetch_share_playlist":
		payload, err := decodeArgs[fetchSharePlaylistArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.FetchSharePlaylist(payload.RawURL)
		return result, true, callErr
	case "get_daily_recommendation":
		payload, err := decodeArgs[dailyRecommendationArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.GetDailyRecommendation(payload.Force)
		return result, true, callErr
	case "enqueue_download":
		payload, err := decodeArgs[enqueueDownloadArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.EnqueueDownload(payload.Job)
	case "fetch_song_lrc_enriched":
		payload, err := decodeArgs[fetchLyricsArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.FetchSongLRCEnriched(payload.Request)
		return result, true, callErr
	case "save_lyrics_override":
		payload, err := decodeArgs[saveLyricsOverrideArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.SaveLyricsOverride(payload.Request, payload.Payload)
	case "lyrics_search_candidates":
		payload, err := decodeArgs[lyricsSearchArgs](args)
		if err != nil {
			return nil, true, err
		}
		rows, callErr := runtime.service.LyricsSearchCandidates(payload.Keyword, payload.DurationMS, payload.Sources)
		return rows, true, callErr
	case "lyrics_fetch_candidate":
		payload, err := decodeArgs[lyricsCandidateArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.LyricsFetchCandidate(payload.Candidate)
		return result, true, callErr
	default:
		return nil, false, nil
	}
}
