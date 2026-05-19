// Tauri compatibility wrappers map the legacy invoke calls onto Wails service bindings.
import { CloudPlayerService } from "@bindings/cloudplayer/backend/app/index.js";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";

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

function pickPositiveNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }
  return 0;
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
    duration_ms: pickPositiveNumber(source.duration_ms, source.durationMs, source.DurationMS),
    cover_url: pickNullableString(source.cover_url, source.coverUrl, source.CoverURL),
  };
}

function normalizeSearchMetadataRow(row) {
  const source = row && typeof row === "object" ? row : {};
  return {
    source_id: pickFirstNonEmptyString(source.source_id, source.sourceId, source.SourceID),
    album: pickFirstNonEmptyString(source.album, source.Album),
    duration_ms: pickPositiveNumber(source.duration_ms, source.durationMs, source.DurationMS),
  };
}

function normalizeSearchResponse(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const rawResults = pickPreferredArray(source.results, source.Results);
  return {
    results: rawResults.map((row) => normalizeSearchRow(row)),
    has_next: [source.has_next, source.hasNext, source.HasNext].some((value) => value === true),
    provider_key: pickFirstNonEmptyString(source.provider_key, source.providerKey, source.ProviderKey),
    failed_provider_key: pickFirstNonEmptyString(source.failed_provider_key, source.failedProviderKey, source.FailedProviderKey),
    fallback_applied: [source.fallback_applied, source.fallbackApplied, source.FallbackApplied].some((value) => value === true),
    provider_persisted: [source.provider_persisted, source.providerPersisted, source.ProviderPersisted].some((value) => value === true),
  };
}

const invokeMap = {
  apply_global_hotkeys: (args) => CloudPlayerService.ApplyGlobalHotkeys(args.cfg),
  append_playlist_import_items: (args) =>
    CloudPlayerService.AppendPlaylistImportItems(args.playlistId, args.items),
  clear_search_cache: () => CloudPlayerService.ClearSearchCache(),
  clear_recent_plays: () => CloudPlayerService.ClearRecentPlays(),
  create_kugou_login_qr_code: () => CloudPlayerService.CreateKugouLoginQRCode(),
  create_playlist: (args) => CloudPlayerService.CreatePlaylist(args.name),
  db_status: () => CloudPlayerService.DBStatus(),
  delete_playlist: (args) => CloudPlayerService.DeletePlaylist(args.playlistId),
  delete_playlist_import_item: (args) =>
    CloudPlayerService.DeletePlaylistImportItem(args.playlistId, args.itemId),
  enqueue_download: (args) => CloudPlayerService.EnqueueDownload(args),
  ensure_favorites_playlist: () => CloudPlayerService.EnsureFavoritesPlaylist(),
  add_favorite_track: (args) => CloudPlayerService.AddFavoriteTrack(args.track),
  remove_favorite_track: (args) => CloudPlayerService.RemoveFavoriteTrack(args.sourceId),
  list_favorite_source_ids: () => CloudPlayerService.ListFavoriteSourceIDs(),
  fetch_share_playlist: (args) => CloudPlayerService.FetchSharePlaylist(args.url),
  fetch_song_lrc_enriched: (args) => CloudPlayerService.FetchSongLRCEnriched(args.req),
  get_search_song_metadata: async (args) =>
    (await CloudPlayerService.GetSearchSongMetadata(args.songIds ?? [])).map((row) => normalizeSearchMetadataRow(row)),
  get_app_log_path: () => CloudPlayerService.GetAppLogPath(),
  open_app_log_location: () => CloudPlayerService.OpenAppLogLocation(),
  get_global_hotkeys: () => CloudPlayerService.GetGlobalHotkeys(),
  get_daily_recommendation: (args) => CloudPlayerService.GetDailyRecommendation(!!args.force),
  get_kugou_login_status: () => CloudPlayerService.GetKugouLoginStatus(),
  get_preview_url: (args) => CloudPlayerService.GetPreviewURL(args.songId),
  get_settings: () => CloudPlayerService.GetSettings(),
  hide_main_window: () => CloudPlayerService.HideMainWindow(),
  list_kugou_playlists: () => CloudPlayerService.ListKugouPlaylists(),
  list_local_songs: () => CloudPlayerService.ListLocalSongs(),
  list_playlist_import_items: (args) =>
    CloudPlayerService.ListPlaylistImportItems(args.playlistId),
  list_playlists: () => CloudPlayerService.ListPlaylists(),
  list_recent_plays: () => CloudPlayerService.ListRecentPlays(),
  local_path_accessible: (args) => CloudPlayerService.LocalPathAccessible(args.path),
  log_play_event: (args) =>
    CloudPlayerService.LogPlayEvent(args.stage, args.url ?? null, args.error_code ?? null, args.message ?? null, args.extra ?? null),
  log_frontend_debug: (args) => CloudPlayerService.LogFrontendDebug(args.scope, args.stage, args.detail),
  login_kugou_by_cellphone: (args) => CloudPlayerService.LoginKugouByCellphone(args.mobile, args.code),
  logout_kugou: () => CloudPlayerService.LogoutKugou(),
  lyrics_fetch_candidate: (args) => CloudPlayerService.LyricsFetchCandidate(args.candidate),
  lyrics_search_candidates: (args) =>
    CloudPlayerService.LyricsSearchCandidates(args.keyword, args.durationMs ?? null, args.sources ?? []),
  open_window_context_menu: (args) => DesktopService.OpenWindowContextMenu(args.req),
  parse_import_text: (args) => CloudPlayerService.ParseImportText(args.text, args.fmt),
  cache_preview_for_play: (args) => CloudPlayerService.CachePreviewForPlay(args.songId),
  persist_desktop_lyrics_bounds: () => CloudPlayerService.PersistDesktopLyricsBounds(),
  poll_kugou_login_qr_code: (args) => CloudPlayerService.PollKugouLoginQRCode(args.key),
  quit_app: () => CloudPlayerService.QuitApp(),
  record_recent_play: (args) => CloudPlayerService.RecordRecentPlay(args.row),
  repair_music_collection_database: () => CloudPlayerService.RepairMusicCollectionDatabase(),
  reset_desktop_lyrics_bounds: () => CloudPlayerService.ResetDesktopLyricsBounds(),
  rename_playlist: (args) => CloudPlayerService.RenamePlaylist(args.playlistId, args.name),
  replace_playlist_import_items: (args) =>
    CloudPlayerService.ReplacePlaylistImportItems(args.playlistId, args.items),
  save_lyrics_override: (args) => CloudPlayerService.SaveLyricsOverride(args.req, args.payload),
  resolve_online_play: (args) =>
    CloudPlayerService.ResolveOnlinePlay(args.songId, args.title, args.artist),
  save_settings: (args) => CloudPlayerService.SaveSettings(args.patch),
  scan_music_folder: (args) => CloudPlayerService.ScanMusicFolder(args.path),
  send_kugou_login_captcha: (args) => CloudPlayerService.SendKugouLoginCaptcha(args.mobile),
  // Wails alpha bindings can surface either json-tag keys or exported Go field names.
  search_songs: async (args) =>
    normalizeSearchResponse(await CloudPlayerService.SearchSongs(args.keyword, args.page)),
  set_desktop_lyrics_click_through: (args) =>
    CloudPlayerService.SetDesktopLyricsClickThrough(args.ignoreCursorEvents),
  set_tray_label: (args) => CloudPlayerService.SetTrayLabel(args.text ?? ""),
  show_main_window: () => CloudPlayerService.ShowMainWindow(),
  refresh_playlist_import_items: (args) => CloudPlayerService.RefreshPlaylistImportItems(args.playlistId),
  refresh_playlists: () => CloudPlayerService.RefreshPlaylists(),
  start_import_enrich: (args) => CloudPlayerService.StartImportEnrich(args.playlistId),
  sync_kugou_playlist: (args) => CloudPlayerService.SyncKugouPlaylist(args.listId),
  sync_kugou_playlists: (args) => CloudPlayerService.SyncKugouPlaylists(args.listIds ?? []),
  validate_accelerator: (args) => CloudPlayerService.ValidateAccelerator(args.s),
};

export function convertFileSrc(path) {
  if (!path) {
    return "";
  }
  return `/__media__?path=${encodeURIComponent(path)}`;
}

export function proxyRemoteAssetSrc(url) {
  const resolved = String(url || "").trim();
  if (!resolved) {
    return "";
  }
  if (resolved.startsWith("data:") || resolved.startsWith("blob:") || resolved.startsWith("/")) {
    return resolved;
  }
  if (!/^https?:\/\//i.test(resolved)) {
    return resolved;
  }
  return `/__remote_media__?url=${encodeURIComponent(resolved)}`;
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
