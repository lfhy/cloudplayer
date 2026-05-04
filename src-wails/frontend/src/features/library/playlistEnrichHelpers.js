// Playlist enrich helpers centralize missing-data detection so single and batch actions share one rule.
export function hasMissingPlayableData(rows) {
  return (Array.isArray(rows) ? rows : []).some((row) => {
    const title = String(row?.title || "").trim();
    if (!title) return false;
    return !String(row?.pjmp3_source_id || "").trim() || !String(row?.cover_url || "").trim();
  });
}

export async function collectPlaylistsMissingPlayableData(invoke) {
  const playlists = await invoke("list_playlists");
  const missing = [];
  for (const playlist of Array.isArray(playlists) ? playlists : []) {
    const playlistID = Number(playlist?.id || 0);
    if (!Number.isFinite(playlistID) || playlistID <= 0) continue;
    const rows = await invoke("list_playlist_import_items", { playlistId: playlistID });
    if (!hasMissingPlayableData(rows || [])) continue;
    missing.push({
      id: playlistID,
      name: String(playlist?.name || "").trim() || `歌单 ${playlistID}`,
      rows: rows || [],
    });
  }
  return missing;
}
