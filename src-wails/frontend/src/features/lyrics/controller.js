// Lyrics controller owns desktop-lyrics windows, lyrics cache, and replace-window state sync.
import { currentLyricsReplaceContext, currentPlayableKey, isSamePlayableIdentity, lyricDisplayForDesktop, parseLrc } from "./model.js";

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
  let lrcCacheKey = null;
  let lrcLoadInFlight = null;
  let lyricTraceLastTs = 0;

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
      await pushDesktopLyricsLines({ line1: "—", line2: "—", activeSlot: 1, line1StartT: 0, line1EndT: 1, line2StartT: 0, line2EndT: 0, audioNow: getAudioEl()?.currentTime ?? 0 });
      return;
    }
    const cacheKey = currentPlayableKey(current);
    if (lrcCacheKey === cacheKey) return;
    try {
      const audio = getAudioEl();
      const durationSeconds = audio?.duration && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
      const raw = await invoke("fetch_song_lrc_enriched", { req: { pjmp3SourceId: current.local_path ? null : (current.source_id || "").trim() || null, title: current.title || "", artist: current.artist || "", album: current.album || "", localPath: current.local_path || null, durationSeconds } });
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

  // Prevent duplicate lyric fetch calls during frequent audio timeupdate ticks.
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

  async function syncDesktopLyrics() {
    if (!getDesktopLyricsOpen()) return;
    await ensureLrcLoadedForCurrentTrackDedup(getPlayLoadGeneration());
    const current = getPlayQueue()[getPlayIndex()] || null;
    const audioNow = getAudioEl()?.currentTime ?? 0;
    const payload = lyricDisplayForDesktop({ currentTrack: current, currentTime: audioNow, lrcEntries, wordLines });
    await pushDesktopLyricsLines(payload);
    const nowMs = Date.now();
    if (nowMs-lyricTraceLastTs >= 1200) {
      lyricTraceLastTs = nowMs;
      const wordsCount = Array.isArray(wordLines) ? wordLines.length : 0;
      const entriesCount = Array.isArray(lrcEntries) ? lrcEntries.length : 0;
      const trace = {
        open: getDesktopLyricsOpen(),
        audioNow: Number(audioNow.toFixed(3)),
        cacheKey: lrcCacheKey || "",
        entriesCount,
        wordsCount,
        activeSlot: payload.activeSlot,
        line1: payload.line1,
        line2: payload.line2,
        line1StartT: payload.line1StartT,
        line1EndT: payload.line1EndT,
        line2StartT: payload.line2StartT,
        line2EndT: payload.line2EndT,
      };
      try {
        await invoke("log_play_event", { stage: "lyric_sync_tick", extra: JSON.stringify(trace) });
      } catch {
        /* ignore trace errors */
      }
    }
  }

  async function syncDesktopLyricsState() {
    if (!getDesktopLyricsOpen()) return;
    await syncDesktopLyrics();
    await broadcastDesktopLyricsLock();
    await broadcastDesktopLyricsColors();
  }

  async function centeredChildWindowBounds(width, height) {
    let x = Math.round((window.screen.availWidth - width) / 2);
    let y = Math.round((window.screen.availHeight - height) / 2);
    try {
      const currentWindow = WebviewWindow.getCurrent();
      const factor = await currentWindow.scaleFactor();
      const outerPos = await currentWindow.outerPosition();
      const outerSize = await currentWindow.outerSize();
      const logicalPos = outerPos.toLogical(factor);
      const logicalSize = outerSize.toLogical(factor);
      x = Math.round(logicalPos.x + (logicalSize.width - width) / 2);
      y = Math.round(logicalPos.y + (logicalSize.height - height) / 2);
    } catch (error) {
      console.warn("centeredChildWindowBounds", error);
    }
    return { x: Math.max(0, Math.min(x, Math.max(0, window.screen.availWidth - width))), y: Math.max(0, Math.min(y, Math.max(0, window.screen.availHeight - height))), width, height };
  }

  async function openLyricsReplaceWindow() {
    const current = getPlayQueue()[getPlayIndex()] || null;
    const ctx = currentLyricsReplaceContext(current, getAudioEl()?.duration);
    const keyword = `${ctx.artist || ""} ${ctx.title || ""}`.trim();
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    ["title", "artist", "album", "trackKey"].forEach((key) => ctx[key] && params.set(key, ctx[key]));
    if (Number.isFinite(ctx.durationMs) && ctx.durationMs > 0) params.set("durationMs", String(ctx.durationMs));
    const bounds = await centeredChildWindowBounds(860, 620);
    const win = new WebviewWindow("lyrics-replace", { url: `/lyrics_replace.html?${params.toString()}`, title: "替换歌词", width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y, resizable: true, alwaysOnTop: false, decorations: true, transparent: false, shadow: true, skipTaskbar: true, focus: true, macTitleBarStyle: "hiddenInset", invisibleTitleBarHeight: 54 });
    win.once("tauri://error", (error) => {
      console.error(error);
      alert("无法打开歌词替换窗口。");
    });
  }

  function scheduleDesktopLyricsStateSync(delays = [80, 260]) {
    if (!getDesktopLyricsOpen()) return;
    delays.forEach((delay) => window.setTimeout(() => getDesktopLyricsOpen() && void syncDesktopLyricsState(), delay));
  }

  async function setDockLyricsActive(on) {
    document.getElementById("btn-dock-lyrics")?.classList.toggle("is-on", on);
    refreshLyricsLockMenuLabel();
  }

  function desktopLyricsBoundsFromSettings(settings) {
    const width = Math.min(720, window.screen.availWidth - 40);
    const defaults = { x: Math.max(0, Math.floor((window.screen.availWidth - width) / 2)), y: 48, width, height: 132 };
    let x = typeof settings?.desktop_lyrics_x === "number" ? settings.desktop_lyrics_x : defaults.x;
    let y = typeof settings?.desktop_lyrics_y === "number" ? settings.desktop_lyrics_y : defaults.y;
    let nextWidth = typeof settings?.desktop_lyrics_width === "number" ? settings.desktop_lyrics_width : defaults.width;
    let nextHeight = typeof settings?.desktop_lyrics_height === "number" ? settings.desktop_lyrics_height : defaults.height;
    nextWidth = Math.max(320, Math.min(Math.round(nextWidth), Math.max(320, window.screen.availWidth - 8)));
    nextHeight = Math.max(88, Math.min(Math.round(nextHeight), Math.max(88, window.screen.availHeight - 8)));
    x = Math.min(Math.max(0, Math.round(x)), Math.max(0, window.screen.availWidth - 48));
    y = Math.min(Math.max(0, Math.round(y)), Math.max(0, window.screen.availHeight - 48));
    return { x, y, width: nextWidth, height: nextHeight };
  }

  async function persistDesktopLyricsVisible(visible) {
    try {
      await invoke("save_settings", { patch: { desktop_lyrics_visible: visible } });
    } catch (error) {
      console.warn("save_settings desktop_lyrics_visible", error);
    }
  }

  async function openDesktopLyricsFromSettingsIfNeeded(settings) {
    if (!settings?.desktop_lyrics_visible) return;
    const existing = await WebviewWindow.getByLabel("lyrics");
    if (existing) {
      setDesktopLyricsWindow(existing);
      if (!(await existing.isVisible())) await existing.show();
      setDesktopLyricsOpen(true);
      await setDockLyricsActive(true);
      await ensureLrcLoadedForCurrentTrack(getPlayLoadGeneration());
      await syncDesktopLyricsState();
      scheduleDesktopLyricsStateSync();
      return;
    }
    const bounds = desktopLyricsBoundsFromSettings(settings);
    const win = new WebviewWindow("lyrics", { url: "/desktop_lyrics.html", title: "桌面歌词", width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y, resizable: true, maximizable: false, alwaysOnTop: true, decorations: false, transparent: true, shadow: false, skipTaskbar: true, focus: false });
    win.once("tauri://error", (error) => console.error(error));
    win.once("tauri://created", async () => {
      setDesktopLyricsWindow(win);
      win.once("tauri://destroyed", async () => {
        setDesktopLyricsOpen(false);
        setDesktopLyricsWindow(null);
        await setDockLyricsActive(false);
        await persistDesktopLyricsVisible(false);
      });
      setDesktopLyricsOpen(true);
      await setDockLyricsActive(true);
      await ensureLrcLoadedForCurrentTrack(getPlayLoadGeneration());
      await syncDesktopLyricsState();
      scheduleDesktopLyricsStateSync();
    });
  }

  async function toggleDesktopLyrics() {
    const existing = getDesktopLyricsWindow() || (await WebviewWindow.getByLabel("lyrics"));
    if (existing) setDesktopLyricsWindow(existing);
    if (existing) {
      if (await existing.isVisible()) {
        await existing.hide();
        setDesktopLyricsOpen(false);
        await setDockLyricsActive(false);
        await persistDesktopLyricsVisible(false);
        return;
      }
      await existing.show();
      setDesktopLyricsOpen(true);
      await setDockLyricsActive(true);
      await persistDesktopLyricsVisible(true);
      await ensureLrcLoadedForCurrentTrack(getPlayLoadGeneration());
      await syncDesktopLyricsState();
      scheduleDesktopLyricsStateSync();
      return;
    }
    let bounds = desktopLyricsBoundsFromSettings({});
    try {
      bounds = desktopLyricsBoundsFromSettings(await invoke("get_settings"));
    } catch (error) {
      console.warn("get_settings for lyrics bounds", error);
    }
    const win = new WebviewWindow("lyrics", { url: "/desktop_lyrics.html", title: "桌面歌词", width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y, resizable: true, maximizable: false, alwaysOnTop: true, decorations: false, transparent: true, shadow: false, skipTaskbar: true, focus: false });
    win.once("tauri://error", (error) => {
      console.error(error);
      alert("无法创建桌面歌词窗口（请确认已授予 webview 创建权限）。");
    });
    win.once("tauri://created", async () => {
      setDesktopLyricsWindow(win);
      win.once("tauri://destroyed", async () => {
        setDesktopLyricsOpen(false);
        setDesktopLyricsWindow(null);
        await setDockLyricsActive(false);
        await persistDesktopLyricsVisible(false);
      });
      setDesktopLyricsOpen(true);
      await setDockLyricsActive(true);
      await persistDesktopLyricsVisible(true);
      await ensureLrcLoadedForCurrentTrack(getPlayLoadGeneration());
      await syncDesktopLyricsState();
      scheduleDesktopLyricsStateSync();
    });
  }

  function clearLyricsCache() {
    lrcCacheKey = null;
    wordLines = null;
  }

  async function applyLyricsPayload(raw) {
    const current = getPlayQueue()[getPlayIndex()] || null;
    const lrcText = String(raw?.lrcText || "");
    const parsedWordLines = Array.isArray(raw?.wordLines) ? raw.wordLines : null;
    const parsedLrcEntries = lrcText.trim() ? parseLrc(lrcText) : [];
    lrcEntries = parsedLrcEntries.length ? parsedLrcEntries : lrcEntriesFromWordLines(parsedWordLines);
    wordLines = parsedWordLines;
    lrcCacheKey = currentPlayableKey(current) || null;
    await syncDesktopLyrics();
  }

  return { applyLyricsPayload, broadcastDesktopLyricsColors, broadcastDesktopLyricsLock, clearLyricsCache, currentPlayableKey, ensureLrcLoadedForCurrentTrack, openDesktopLyricsFromSettingsIfNeeded, openLyricsReplaceWindow, refreshLyricsLockMenuLabel, scheduleDesktopLyricsStateSync, syncDesktopLyrics, syncDesktopLyricsState, toggleDesktopLyrics };
}
