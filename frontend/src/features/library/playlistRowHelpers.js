// Playlist row helpers keep queue building and local-song lookup out of the page controller.
function normalizeQueueItem(row) {
  return {
    source_id: (row.pjmp3_source_id || "").trim(),
    title: row.title,
    artist: row.artist || "",
    album: row.album || "",
    cover_url: (row.cover_url || "").trim() || null,
    duration_ms: Number(row.duration_ms || 0) || 0,
  };
}

export function buildPlayablePlaylistQueue(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => (row.pjmp3_source_id || "").trim())
    .map((row) => normalizeQueueItem(row));
}

export function playPlaylistRows(rows, rowIdx, deps) {
  const { alert, playFromQueueIndex, renderQueuePanel, setPlayQueue } = deps;
  const row = Array.isArray(rows) ? rows[rowIdx] : null;
  const sourceId = (row?.pjmp3_source_id || "").trim();
  if (!sourceId) return void alert("该条没有曲库 id，请使用顶栏搜索歌名后播放。");
  const queue = buildPlayablePlaylistQueue(rows);
  if (!queue.length) return void alert("没有可播放条目（导入条目需含 pjmp3 曲库 id）。");
  let startInQueue = 0;
  for (let index = 0; index < rowIdx; index += 1) {
    if ((rows[index].pjmp3_source_id || "").trim()) startInQueue += 1;
  }
  setPlayQueue(queue);
  void playFromQueueIndex(startInQueue);
  renderQueuePanel();
}

export async function searchLocalPlaylists(invoke, keyword) {
  const normalized = String(keyword || "").trim().toLowerCase();
  if (!normalized) return [];
  const playlists = await invoke("list_playlists");
  const results = [];
  for (const playlist of Array.isArray(playlists) ? playlists : []) {
    const playlistName = String(playlist.name || "").trim();
    const rows = await invoke("list_playlist_import_items", { playlistId: playlist.id });
    const matchedTracks = (Array.isArray(rows) ? rows : []).filter((row) => {
      const haystack = [playlistName, row.title || "", row.artist || "", row.album || ""].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
    const playlistMatched = playlistName.toLowerCase().includes(normalized);
    if (!playlistMatched && matchedTracks.length === 0) continue;
    results.push({
      id: playlist.id,
      name: playlistName || `歌单 ${playlist.id}`,
      trackCount: Array.isArray(rows) ? rows.length : 0,
      matchedTracks,
      coverUrl: matchedTracks.find((row) => (row.cover_url || "").trim())?.cover_url || rows?.find?.((row) => (row.cover_url || "").trim())?.cover_url || null,
    });
  }
  return results;
}
