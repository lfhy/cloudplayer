// Tauri compatibility wrappers map the legacy invoke calls onto Wails service bindings.
import { CloudPlayerService } from "../../bindings/cloudplayer/index.js";

function pickFirstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

function pickNullableString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  for (const value of values) {
    if (value === null) {
      return null;
    }
  }
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }
  return null;
}

function pickPreferredArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) {
      return value;
    }
  }
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function normalizeSearchRow(row) {
  const source = row && typeof row === "object" ? row : {};
  return {
    source_id: pickFirstNonEmptyString(
      source.source_id,
      source.sourceId,
      source.SourceID,
      source.pjmp3_source_id,
      source.pjmp3SourceId,
      source.Pjmp3SourceID,
    ),
    title: pickFirstNonEmptyString(source.title, source.Title),
    artist: pickFirstNonEmptyString(source.artist, source.Artist),
    album: pickFirstNonEmptyString(source.album, source.Album),
    cover_url: pickNullableString(source.cover_url, source.coverUrl, source.CoverURL),
  };
}

function normalizeSearchResponse(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const rawResults = pickPreferredArray(source.results, source.Results);
  return {
    results: rawResults.map((row) => normalizeSearchRow(row)),
    has_next: [source.has_next, source.hasNext, source.HasNext].some((value) => value === true),
  };
}

const invokeMap = {
  apply_global_hotkeys: (args) => CloudPlayerService.ApplyGlobalHotkeys(args.cfg),
  append_playlist_import_items: (args) =>
    CloudPlayerService.AppendPlaylistImportItems(args.playlistId, args.items),
  create_playlist: (args) => CloudPlayerService.CreatePlaylist(args.name),
  db_status: () => CloudPlayerService.DBStatus(),
  delete_playlist: (args) => CloudPlayerService.DeletePlaylist(args.playlistId),
  delete_playlist_import_item: (args) =>
    CloudPlayerService.DeletePlaylistImportItem(args.playlistId, args.itemId),
  enqueue_download: (args) => CloudPlayerService.EnqueueDownload(args),
  fetch_share_playlist: (args) => CloudPlayerService.FetchSharePlaylist(args.url),
  fetch_song_lrc_enriched: (args) => CloudPlayerService.FetchSongLRCEnriched(args.req),
  get_app_log_path: () => CloudPlayerService.GetAppLogPath(),
  get_global_hotkeys: () => CloudPlayerService.GetGlobalHotkeys(),
  get_preview_url: (args) => CloudPlayerService.GetPreviewURL(args.songId),
  get_settings: () => CloudPlayerService.GetSettings(),
  hide_main_window: () => CloudPlayerService.HideMainWindow(),
  list_local_songs: () => CloudPlayerService.ListLocalSongs(),
  list_playlist_import_items: (args) =>
    CloudPlayerService.ListPlaylistImportItems(args.playlistId),
  list_playlists: () => CloudPlayerService.ListPlaylists(),
  list_recent_plays: () => CloudPlayerService.ListRecentPlays(),
  local_path_accessible: (args) => CloudPlayerService.LocalPathAccessible(args.path),
  log_play_event: (args) =>
    CloudPlayerService.LogPlayEvent(args.stage, args.url ?? null, args.error_code ?? null, args.message ?? null, args.extra ?? null),
  lyrics_fetch_candidate: (args) => CloudPlayerService.LyricsFetchCandidate(args.candidate),
  lyrics_search_candidates: (args) =>
    CloudPlayerService.LyricsSearchCandidates(args.keyword, args.durationMs ?? null, args.sources ?? []),
  parse_import_text: (args) => CloudPlayerService.ParseImportText(args.text, args.fmt),
  cache_preview_for_play: (args) => CloudPlayerService.CachePreviewForPlay(args.songId),
  quit_app: () => CloudPlayerService.QuitApp(),
  record_recent_play: (args) => CloudPlayerService.RecordRecentPlay(args.row),
  rename_playlist: (args) => CloudPlayerService.RenamePlaylist(args.playlistId, args.name),
  replace_playlist_import_items: (args) =>
    CloudPlayerService.ReplacePlaylistImportItems(args.playlistId, args.items),
  resolve_online_play: (args) =>
    CloudPlayerService.ResolveOnlinePlay(args.songId, args.title, args.artist),
  save_settings: (args) => CloudPlayerService.SaveSettings(args.patch),
  scan_music_folder: (args) => CloudPlayerService.ScanMusicFolder(args.path),
  // Wails alpha bindings can surface either json-tag keys or exported Go field names.
  search_songs: async (args) =>
    normalizeSearchResponse(await CloudPlayerService.SearchSongs(args.keyword, args.page)),
  set_desktop_lyrics_click_through: (args) =>
    CloudPlayerService.SetDesktopLyricsClickThrough(args.ignoreCursorEvents),
  show_main_window: () => CloudPlayerService.ShowMainWindow(),
  start_import_enrich: (args) => CloudPlayerService.StartImportEnrich(args.playlistId),
  validate_accelerator: (args) => CloudPlayerService.ValidateAccelerator(args.s),
};

export function convertFileSrc(path) {
  if (!path) {
    return "";
  }
  return `/__media__?path=${encodeURIComponent(path)}`;
}

export async function invoke(command, args = {}) {
  const handler = invokeMap[command];
  if (!handler) {
    throw new Error(`Unsupported invoke command: ${command}`);
  }
  if (command === "search_songs") {
    console.info("[invoke] search_songs", args);
  }
  const result = await handler(args);
  if (command === "search_songs") {
    console.info("[invoke] search_songs result", {
      resultCount: Array.isArray(result?.results) ? result.results.length : 0,
      hasNext: result?.has_next === true,
      first: Array.isArray(result?.results) ? result.results[0] || null : null,
    });
  }
  return result;
}
