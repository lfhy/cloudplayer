// Playlist enrich helpers own missing-data detection and visible action feedback for current-playlist repair.
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

  return {
    hasMissingPlayableData,
    maybeEnrichPlaylist,
    setStatus,
  };
}
