import { currentPlayableKey } from "../lyrics/model.js";

// Playback state persistence keeps play mode and queue recoverable across app restarts.
const PROGRESS_SAVE_DELAY_MS = 3000;

function normalizePlayModeKey(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "one" || key === "shuffle" ? key : "loop_list";
}

function normalizeNonNegativeInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
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
  const {
    getAudioEl,
    getPlayIndex,
    getPlayQueue,
    getPlayModeIndex,
    invoke,
    playModeItems,
    refreshCurrentLyricsSnapshot,
    restorePlaybackUi,
    setPlayIndex,
    setPlayModeIndex,
    setPlayQueue,
    syncDesktopLyrics,
    syncSeekUi,
  } = deps;
  let restoring = false;
  let stateSaveTimer = 0;
  let progressSaveTimer = 0;
  let pendingResume = null;
  let lastProgressSignature = "";
  let lifecycleWired = false;

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

  function currentTrack() {
    return getPlayQueue()[getPlayIndex()] || null;
  }

  function currentProgressPatch() {
    const track = currentTrack();
    const trackKey = currentPlayableKey(track);
    if (!trackKey) {
      return { playback_track_key: "", playback_position_ms: 0, playback_duration_ms: 0 };
    }
    const audio = getAudioEl?.();
    const audioDurationMs = Number.isFinite(audio?.duration) && audio.duration > 0 ? Math.round(audio.duration * 1000) : 0;
    const queueDurationMs = normalizeNonNegativeInt(track?.duration_ms ?? track?.durationMs ?? 0);
    const durationMs = Math.max(audioDurationMs, queueDurationMs);
    const rawPositionMs = Number.isFinite(audio?.currentTime) && audio.currentTime > 0 ? Math.round(audio.currentTime * 1000) : 0;
    const positionMs = durationMs > 0 ? Math.min(rawPositionMs, durationMs) : rawPositionMs;
    return { playback_track_key: trackKey, playback_position_ms: positionMs, playback_duration_ms: durationMs };
  }

  function progressSignatureOf(patch) {
    return [patch.playback_track_key || "", patch.playback_position_ms || 0, patch.playback_duration_ms || 0].join("|");
  }

  function normalizePendingResume(settings) {
    const trackKey = String(settings?.playback_track_key ?? settings?.playbackTrackKey ?? "").trim();
    if (!trackKey) return null;
    const positionMs = normalizeNonNegativeInt(settings?.playback_position_ms ?? settings?.playbackPositionMS ?? settings?.playbackPositionMs ?? 0);
    const durationMs = normalizeNonNegativeInt(settings?.playback_duration_ms ?? settings?.playbackDurationMS ?? settings?.playbackDurationMs ?? 0);
    return {
      trackKey,
      positionMs: durationMs > 0 ? Math.min(positionMs, durationMs) : positionMs,
      durationMs,
    };
  }

  async function persistPatch(patch, scope) {
    try {
      await invoke("save_settings", { patch });
    } catch (error) {
      console.warn(`save_settings ${scope}`, error);
    }
  }

  async function savePlaybackStateNow() {
    stateSaveTimer = 0;
    if (restoring) return;
    await persistPatch({
      play_mode: playModeItems[getPlayModeIndex()]?.key || "loop_list",
      play_queue: serializedQueue(),
      play_queue_index: getPlayIndex(),
    }, "playback_state");
  }

  function scheduleSavePlaybackState() {
    if (restoring) return;
    if (stateSaveTimer) window.clearTimeout(stateSaveTimer);
    stateSaveTimer = window.setTimeout(() => {
      void savePlaybackStateNow();
    }, 160);
  }

  async function savePlaybackProgressNow(force = false) {
    progressSaveTimer = 0;
    if (restoring) return;
    const patch = currentProgressPatch();
    const signature = progressSignatureOf(patch);
    if (!force && signature === lastProgressSignature) return;
    lastProgressSignature = signature;
    await persistPatch(patch, "playback_progress");
  }

  function scheduleSavePlaybackProgress() {
    if (restoring || progressSaveTimer) return;
    progressSaveTimer = window.setTimeout(() => {
      void savePlaybackProgressNow();
    }, PROGRESS_SAVE_DELAY_MS);
  }

  async function flushPlaybackPersistenceNow() {
    await savePlaybackStateNow();
    await savePlaybackProgressNow(true);
  }

  function hasPendingPlaybackResume(track = currentTrack()) {
    return !!pendingResume && currentPlayableKey(track) === pendingResume.trackKey;
  }

  function applyPendingPlaybackResume(track = currentTrack()) {
    if (!hasPendingPlaybackResume(track)) return false;
    const audio = getAudioEl?.();
    if (!audio) return false;
    const audioDurationMs = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration * 1000) : 0;
    const trackDurationMs = normalizeNonNegativeInt(track?.duration_ms ?? track?.durationMs ?? 0);
    const durationMs = Math.max(audioDurationMs, trackDurationMs, pendingResume?.durationMs || 0);
    const positionMs = durationMs > 0 ? Math.min(pendingResume.positionMs, durationMs) : pendingResume.positionMs;
    audio.currentTime = Math.max(0, positionMs) / 1000;
    pendingResume = null;
    syncSeekUi?.();
    refreshCurrentLyricsSnapshot?.();
    void syncDesktopLyrics?.();
    return true;
  }

  function wirePersistenceLifecycle() {
    if (lifecycleWired || typeof window === "undefined") return;
    lifecycleWired = true;
    const flush = () => { void flushPlaybackPersistenceNow(); };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
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
      const nextResume = normalizePendingResume(settings);
      setPlayModeIndex(modeIndex);
      setPlayQueue(queue);
      setPlayIndex(nextIndex);
      pendingResume = nextResume && queue.some((item) => currentPlayableKey(item) === nextResume.trackKey) ? nextResume : null;
      lastProgressSignature = progressSignatureOf(currentProgressPatch());
      restorePlaybackUi();
    } catch (error) {
      console.warn("restore playback_state", error);
    } finally {
      restoring = false;
    }
  }

  return {
    applyPendingPlaybackResume,
    hasPendingPlaybackResume,
    restorePlaybackState,
    savePlaybackProgressNow,
    savePlaybackStateNow,
    scheduleSavePlaybackProgress,
    scheduleSavePlaybackState,
    wirePersistenceLifecycle,
  };
}
