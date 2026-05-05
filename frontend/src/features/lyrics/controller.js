// Lyrics controller composes sync, idle-state and window lifecycle for desktop lyrics.
import { currentPlayableKey, isSamePlayableIdentity, lyricDisplayForDesktop, parseLrc } from "./model.js";
import { createTrayLabelSync } from "./trayLabelSync.js";
import { createLyricsWindowController } from "./windowController.js";
import {
  DESKTOP_LYRICS_IDLE_LINE1,
  DESKTOP_LYRICS_IDLE_LINE2,
  idleDesktopLyricsPayload,
  normalizeDesktopLyricsIdleText,
} from "./idleText.js";

export function createLyricsController(deps) {
  const {
    dockLyricsLockIcon,
    emitTo,
    getAudioEl,
    getDesktopLyricsLocked,
    getDesktopLyricsOpen,
    getDesktopLyricsWindow,
    getPlayIndex,
    getPlayLoadGeneration,
    getPlayQueue,
    invoke,
    setDesktopLyricsLocked,
    setDesktopLyricsOpen,
    setDesktopLyricsWindow,
    WebviewWindow,
  } = deps;

  let lrcEntries = [];
  let wordLines = null;
  const trayLabel = createTrayLabelSync({ invoke });
  let lrcCacheKey = null;
  let lrcLoadInFlight = null;
  let lyricTraceLastTs = 0;
  let idleText = normalizeDesktopLyricsIdleText(DESKTOP_LYRICS_IDLE_LINE1, DESKTOP_LYRICS_IDLE_LINE2);
  let lastSnapshot = null;

  function lrcEntriesFromWordLines(lines) {
    if (!Array.isArray(lines) || !lines.length) return [];
    const entries = [];
    for (const line of lines) {
      const startMS = Number(line?.startMs);
      const words = Array.isArray(line?.words) ? line.words : [];
      const text = words.map((word) => String(word?.text ?? "")).join("").trim();
      if (!Number.isFinite(startMS) || startMS < 0 || !text) continue;
      entries.push({ t: startMS / 1000, text });
    }
    entries.sort((left, right) => left.t - right.t);
    return entries;
  }

  function refreshLyricsLockMenuLabel() {
    const button = document.getElementById("btn-dock-lyrics-lock");
    if (!button) return;
    const open = getDesktopLyricsOpen();
    const locked = getDesktopLyricsLocked();
    button.disabled = !open;
    button.classList.toggle("is-on", open && locked);
    button.innerHTML = dockLyricsLockIcon(open && locked);
    const title = !open ? "先打开桌面歌词" : locked ? "解锁桌面歌词" : "锁定桌面歌词";
    button.title = title;
    button.setAttribute("aria-label", title);
  }

  async function setDockLyricsActive(on) {
    document.getElementById("btn-dock-lyrics")?.classList.toggle("is-on", on);
    refreshLyricsLockMenuLabel();
  }

  async function broadcastDesktopLyricsLock() {
    if (!getDesktopLyricsOpen()) return;
    try {
      await emitTo({ kind: "WebviewWindow", label: "lyrics" }, "desktop-lyrics-lock", { locked: getDesktopLyricsLocked() });
    } catch (error) {
      console.warn("emit desktop-lyrics-lock", error);
    }
  }

  async function broadcastDesktopLyricsColors() {
    if (!getDesktopLyricsOpen()) return;
    try {
      const settings = await invoke("get_settings");
      await emitTo({ kind: "WebviewWindow", label: "lyrics" }, "desktop-lyrics-colors", {
        base: settings.desktop_lyrics_color_base || settings.desktopLyricsColorBase || "#ffffff",
        highlight: settings.desktop_lyrics_color_highlight || settings.desktopLyricsColorHighlight || "#ffb7d4",
      });
    } catch (error) {
      console.warn("emit desktop-lyrics-colors", error);
    }
  }

  async function pushDesktopLyricsLines(payload) {
    if (!getDesktopLyricsOpen()) return;
    try {
      const win = getDesktopLyricsWindow() || (await WebviewWindow.getByLabel("lyrics"));
      if (win) setDesktopLyricsWindow(win);
      await emitTo({ kind: "WebviewWindow", label: "lyrics" }, "desktop-lyrics-lines", payload);
    } catch (error) {
      console.warn("emit lyrics", error);
      setDesktopLyricsOpen(false);
      setDesktopLyricsWindow(null);
      document.getElementById("btn-dock-lyrics")?.classList.remove("is-on");
    }
  }

  async function ensureLrcLoadedForCurrentTrack(loadGen) {
    const current = getPlayQueue()[getPlayIndex()];
    if (!current) {
      await pushDesktopLyricsLines(idleDesktopLyricsPayload(idleText.line1, idleText.line2, getAudioEl()?.currentTime ?? 0));
      return;
    }
    const cacheKey = currentPlayableKey(current);
    if (lrcCacheKey === cacheKey) return;
    await pushDesktopLyricsLines({
      line1: "歌词加载中...",
      line2: current.artist ? `${current.title || "当前歌曲"} · ${current.artist}` : current.title || "正在获取歌词",
      activeSlot: 1,
      line1StartT: 0,
      line1EndT: 1,
      line2StartT: 0,
      line2EndT: 0,
      audioNow: getAudioEl()?.currentTime ?? 0,
    });

    try {
      const audio = getAudioEl();
      const durationSeconds = audio?.duration && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
      const raw = await invoke("fetch_song_lrc_enriched", {
        req: {
          pjmp3SourceId: current.local_path ? null : (current.source_id || "").trim() || null,
          title: current.title || "",
          artist: current.artist || "",
          album: current.album || "",
          localPath: current.local_path || null,
          durationSeconds,
        },
      });
      if (loadGen !== undefined && loadGen !== getPlayLoadGeneration()) return;
      if (!isSamePlayableIdentity(getPlayQueue()[getPlayIndex()], current)) return;

      if (raw?.lrcText != null) {
        const parsedWordLines = Array.isArray(raw.wordLines) ? raw.wordLines : null;
        const parsedLrcEntries = parseLrc(String(raw.lrcText));
        lrcEntries = parsedLrcEntries.length ? parsedLrcEntries : lrcEntriesFromWordLines(parsedWordLines);
        wordLines = parsedWordLines;
      } else if (typeof raw === "string") {
        lrcEntries = parseLrc(raw);
        wordLines = null;
      } else {
        lrcEntries = [];
        wordLines = null;
      }
      lrcCacheKey = cacheKey;
    } catch (error) {
      console.warn("fetch_song_lrc_enriched", error);
      if (loadGen !== undefined && loadGen !== getPlayLoadGeneration()) return;
      if (!isSamePlayableIdentity(getPlayQueue()[getPlayIndex()], current)) return;
      lrcCacheKey = cacheKey;
      lrcEntries = [];
      wordLines = null;
    }
  }

  async function ensureLrcLoadedForCurrentTrackDedup(loadGen) {
    const current = getPlayQueue()[getPlayIndex()] || null;
    const cacheKey = currentPlayableKey(current);
    if (!cacheKey) return;
    if (lrcCacheKey === cacheKey) return;
    if (lrcLoadInFlight && lrcLoadInFlight.key === cacheKey) {
      await lrcLoadInFlight.promise;
      return;
    }
    const promise = ensureLrcLoadedForCurrentTrack(loadGen).finally(() => {
      if (lrcLoadInFlight?.promise === promise) lrcLoadInFlight = null;
    });
    lrcLoadInFlight = { key: cacheKey, promise };
    await promise;
  }

  function buildCurrentLyricsSnapshot() {
    const currentTrack = getPlayQueue()[getPlayIndex()] || null;
    const audioEl = getAudioEl();
    const audioNow = audioEl?.currentTime ?? 0;
    const payload = lyricDisplayForDesktop({ currentTrack, currentTime: audioNow, lrcEntries, wordLines, idleLine1: idleText.line1, idleLine2: idleText.line2 });
    payload.audioPlaying = !!audioEl && !audioEl.paused;
    lastSnapshot = { currentTrack, lrcEntries, payload, wordLines };
    return lastSnapshot;
  }

  async function syncDesktopLyrics() {
    if (!getDesktopLyricsOpen() && !trayLabel.isEnabled()) return;
    await ensureLrcLoadedForCurrentTrackDedup(getPlayLoadGeneration());
    const { currentTrack: current, payload } = buildCurrentLyricsSnapshot();
    const audioNow = Number(payload.audioNow) || 0;
    await pushDesktopLyricsLines(payload);
    await trayLabel.sync(payload, current, payload.audioPlaying);

    const nowMs = Date.now();
    if (!getDesktopLyricsOpen() || nowMs - lyricTraceLastTs < 1200) return;
    lyricTraceLastTs = nowMs;
    try {
      await invoke("log_play_event", {
        stage: "lyric_sync_tick",
        extra: JSON.stringify({
          open: getDesktopLyricsOpen(),
          audioNow: Number(audioNow.toFixed(3)),
          cacheKey: lrcCacheKey || "",
          entriesCount: Array.isArray(lrcEntries) ? lrcEntries.length : 0,
          wordsCount: Array.isArray(wordLines) ? wordLines.length : 0,
          activeSlot: payload.activeSlot,
          line1: payload.line1,
          line2: payload.line2,
          line1StartT: payload.line1StartT,
          line1EndT: payload.line1EndT,
          line2StartT: payload.line2StartT,
          line2EndT: payload.line2EndT,
        }),
      });
    } catch {
      // ignore trace errors
    }
  }

  async function syncDesktopLyricsState() {
    if (!getDesktopLyricsOpen()) return;
    await syncDesktopLyrics();
    await broadcastDesktopLyricsLock();
    await broadcastDesktopLyricsColors();
  }

  function clearLyricsCache() {
    lrcCacheKey = null;
    wordLines = null;
    lastSnapshot = null;
  }

  function setDesktopLyricsIdleText(line1, line2) {
    idleText = normalizeDesktopLyricsIdleText(line1, line2);
    if (getDesktopLyricsOpen() && !getPlayQueue()[getPlayIndex()]) {
      void pushDesktopLyricsLines(idleDesktopLyricsPayload(idleText.line1, idleText.line2, getAudioEl()?.currentTime ?? 0));
    }
  }

  async function applyLyricsPayload(raw) {
    const current = getPlayQueue()[getPlayIndex()] || null;
    const lrcText = String(raw?.lrcText || "");
    const parsedWordLines = Array.isArray(raw?.wordLines) ? raw.wordLines : null;
    const parsedLrcEntries = lrcText.trim() ? parseLrc(lrcText) : [];
    lrcEntries = parsedLrcEntries.length ? parsedLrcEntries : lrcEntriesFromWordLines(parsedWordLines);
    wordLines = parsedWordLines;
    lrcCacheKey = currentPlayableKey(current) || null;
    buildCurrentLyricsSnapshot();
    await syncDesktopLyrics();
  }

  function refreshCurrentLyricsSnapshot() { buildCurrentLyricsSnapshot(); }
  function readCurrentLyricsSnapshot() { return lastSnapshot; }
  async function getCurrentLyricsSnapshot() {
    await ensureLrcLoadedForCurrentTrackDedup(getPlayLoadGeneration());
    return buildCurrentLyricsSnapshot();
  }
  const windows = createLyricsWindowController({
    WebviewWindow,
    getAudioEl,
    getDesktopLyricsWindow,
    getDesktopLyricsOpen,
    getPlayIndex,
    getPlayLoadGeneration,
    getPlayQueue,
    invoke,
    setDesktopLyricsOpen,
    setDesktopLyricsWindow,
    setDockLyricsActive,
    ensureLrcLoadedForCurrentTrack,
    getCurrentLyricsSnapshot,
    syncDesktopLyricsState,
  });

  return {
    applyLyricsPayload,
    broadcastDesktopLyricsColors,
    broadcastDesktopLyricsLock,
    clearLyricsCache,
    currentPlayableKey,
    ensureLrcLoadedForCurrentTrack,
    getCurrentLyricsSnapshot,
    openDesktopLyricsFromSettingsIfNeeded: windows.openDesktopLyricsFromSettingsIfNeeded,
    closeDesktopLyrics: windows.closeDesktopLyrics,
    openLyricsReplaceWindow: windows.openLyricsReplaceWindow,
    refreshLyricsLockMenuLabel,
    refreshCurrentLyricsSnapshot,
    scheduleDesktopLyricsStateSync: windows.scheduleDesktopLyricsStateSync,
    readCurrentLyricsSnapshot,
    setDesktopLyricsIdleText,
    syncDesktopLyrics,
    syncDesktopLyricsState,
    toggleDesktopLyrics: windows.toggleDesktopLyrics,
  };
}
