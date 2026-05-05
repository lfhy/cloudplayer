// Playback state persistence keeps play mode and queue recoverable across app restarts.
function normalizePlayModeKey(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "one" || key === "shuffle" ? key : "loop_list";
}

function normalizeQueueItem(item) {
  const localPath = String(item?.local_path ?? item?.localPath ?? "").trim();
  const sourceId = String(item?.source_id ?? item?.sourceId ?? "").trim();
  if (!localPath && !sourceId) return null;
  return {
    source_id: sourceId,
    title: String(item?.title || "").trim() || "未命名曲目",
    artist: String(item?.artist || "").trim(),
    album: String(item?.album || "").trim(),
    cover_url: String(item?.cover_url ?? item?.coverUrl ?? "").trim() || null,
    duration_ms: Number(item?.duration_ms ?? item?.durationMs ?? 0) || 0,
    local_path: localPath,
  };
}

export function createPlaybackStatePersistence(deps) {
  const { getPlayIndex, getPlayQueue, getPlayModeIndex, invoke, playModeItems, restorePlaybackUi, setPlayIndex, setPlayModeIndex, setPlayQueue } = deps;
  let restoring = false;
  let saveTimer = 0;

  function serializedQueue() {
    return getPlayQueue().map((item) => ({
      source_id: String(item?.source_id || "").trim() || undefined,
      title: String(item?.title || "").trim() || "未命名曲目",
      artist: String(item?.artist || "").trim() || undefined,
      album: String(item?.album || "").trim() || undefined,
      cover_url: String(item?.cover_url || "").trim() || undefined,
      duration_ms: Number(item?.duration_ms || 0) || undefined,
      local_path: String(item?.local_path || "").trim() || undefined,
    }));
  }

  async function savePlaybackStateNow() {
    saveTimer = 0;
    if (restoring) return;
    try {
      await invoke("save_settings", {
        patch: {
          play_mode: playModeItems[getPlayModeIndex()]?.key || "loop_list",
          play_queue: serializedQueue(),
          play_queue_index: getPlayIndex(),
        },
      });
    } catch (error) {
      console.warn("save_settings playback_state", error);
    }
  }

  function scheduleSavePlaybackState() {
    if (restoring) return;
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void savePlaybackStateNow();
    }, 160);
  }

  async function restorePlaybackState() {
    restoring = true;
    try {
      const settings = await invoke("get_settings");
      const modeKey = normalizePlayModeKey(settings?.play_mode ?? settings?.playMode);
      const modeIndex = Math.max(0, playModeItems.findIndex((item) => item.key === modeKey));
      const queue = Array.isArray(settings?.play_queue ?? settings?.playQueue)
        ? (settings.play_queue ?? settings.playQueue).map(normalizeQueueItem).filter(Boolean)
        : [];
      const rawIndex = Number(settings?.play_queue_index ?? settings?.playQueueIndex ?? 0);
      const nextIndex = queue.length ? Math.max(0, Math.min(queue.length - 1, Number.isFinite(rawIndex) ? rawIndex : 0)) : 0;
      setPlayModeIndex(modeIndex);
      setPlayQueue(queue);
      setPlayIndex(nextIndex);
      restorePlaybackUi();
    } catch (error) {
      console.warn("restore playback_state", error);
    } finally {
      restoring = false;
    }
  }

  return { restorePlaybackState, scheduleSavePlaybackState, savePlaybackStateNow };
}
