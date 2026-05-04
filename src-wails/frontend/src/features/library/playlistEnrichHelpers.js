// Playlist enrich helpers own missing-data detection and visible action feedback for single and batch repair.
export function createPlaylistEnrichHelpers(deps) {
  const { invoke, warnRequestFailed } = deps;
  const enrichPending = new Set();

  function statusEl() {
    return document.getElementById("playlist-enrich-status");
  }

  function setStatus(message = "", tone = "muted") {
    const element = statusEl();
    if (!element) return;
    element.textContent = String(message || "");
    element.dataset.tone = tone;
  }

  function setButtonState(id, busy, busyText, idleText) {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = !!busy;
    button.textContent = busy ? busyText : idleText;
  }

  function hasMissingPlayableData(rows) {
    return (Array.isArray(rows) ? rows : []).some((row) => {
      const title = String(row?.title || "").trim();
      if (!title) return false;
      return !String(row?.pjmp3_source_id || "").trim() || !String(row?.cover_url || "").trim();
    });
  }

  async function maybeEnrichPlaylist(playlistID, rows, { force = false } = {}) {
    const normalizedID = Number(playlistID || 0);
    if (!Number.isFinite(normalizedID) || normalizedID <= 0) return false;
    if (!force && !hasMissingPlayableData(rows)) return false;
    if (enrichPending.has(normalizedID)) return false;
    enrichPending.add(normalizedID);
    setButtonState("btn-playlist-enrich", true, "补全中…", "补全播放信息");
    setStatus("已触发当前歌单补全，正在后台刷新播放源与封面。");
    try {
      await invoke("start_import_enrich", { playlistId: normalizedID });
      return true
    } catch (error) {
      warnRequestFailed(error, "start_import_enrich");
      setStatus("补全失败，请稍后重试。", "error");
      return false
    } finally {
      enrichPending.delete(normalizedID);
      setButtonState("btn-playlist-enrich", false, "补全中…", "补全播放信息");
    }
  }

  async function collectPlaylistsMissingPlayableData() {
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

  async function runBatchEnrich(onReloadCurrent = async () => {}) {
    setButtonState("btn-playlist-enrich-all", true, "批量补全中…", "批量补全缺失歌单");
    try {
      const missingPlaylists = await collectPlaylistsMissingPlayableData();
      if (!missingPlaylists.length) {
        setStatus("当前没有检测到缺失播放信息的歌单。");
        return 0;
      }
      setStatus(`正在批量补全 ${missingPlaylists.length} 个歌单…`);
      let repaired = 0;
      for (const playlist of missingPlaylists) {
        const started = await maybeEnrichPlaylist(playlist.id, playlist.rows, { force: true });
        if (started) repaired += 1;
      }
      await onReloadCurrent();
      setStatus(`已触发 ${repaired} 个歌单的后台补全任务。`);
      return repaired;
    } catch (error) {
      warnRequestFailed(error, "batch playlist enrich");
      setStatus("批量补全失败，请稍后重试。", "error");
      return 0;
    } finally {
      setButtonState("btn-playlist-enrich-all", false, "批量补全中…", "批量补全缺失歌单");
    }
  }

  return {
    hasMissingPlayableData,
    maybeEnrichPlaylist,
    runBatchEnrich,
    setStatus,
  };
}
