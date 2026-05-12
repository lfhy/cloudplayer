import { currentPlayableKey } from "../lyrics/model.js";
import { getPlaybackSeekDisplay } from "./pendingPlaybackUi.js";
import { createMiniModeWindowController, MINI_PLAYER_TARGET } from "./miniModeWindow.js";

const MINI_SYNC_MS = 240;

// Mini-mode controller now owns a dedicated child window instead of shrinking the main shell in place.
export function createMiniModeController(deps) {
  const { WebviewWindow, emitTo, formatTime, getAudioEl, getCurrentLyricsSnapshot, getPlayIndex, getPlayQueue, invoke, readCurrentLyricsSnapshot } = deps;
  const windows = createMiniModeWindowController({ WebviewWindow });
  let boundsCleanup = null;
  let boundsPersistTimer = 0;
  let open = false;
  let settingsState = { visible: false, alwaysOnTop: true, translucent: false, x: null, y: null, width: null, height: null };
  let syncTimer = 0;

  function setMiniToggleUi() { document.getElementById("btn-dock-mini")?.classList.toggle("is-on", open); }

  function applySettingsState(settings = {}) {
    settingsState = {
      visible: !!(settings.mini_player_visible ?? settings.miniPlayerVisible),
      alwaysOnTop: (settings.mini_player_always_on_top ?? settings.miniPlayerAlwaysOnTop) !== false,
      translucent: !!(settings.mini_player_translucent ?? settings.miniPlayerTranslucent),
      x: settings.mini_player_x ?? settings.miniPlayerX ?? null,
      y: settings.mini_player_y ?? settings.miniPlayerY ?? null,
      width: settings.mini_player_width ?? settings.miniPlayerWidth ?? null,
      height: settings.mini_player_height ?? settings.miniPlayerHeight ?? null,
    };
  }

  async function persistSettings(patch) {
    await invoke("save_settings", { patch });
    settingsState = {
      ...settingsState,
      visible: patch.mini_player_visible ?? settingsState.visible,
      alwaysOnTop: patch.mini_player_always_on_top ?? settingsState.alwaysOnTop,
      translucent: patch.mini_player_translucent ?? settingsState.translucent,
      x: patch.mini_player_x ?? settingsState.x,
      y: patch.mini_player_y ?? settingsState.y,
      width: patch.mini_player_width ?? settingsState.width,
      height: patch.mini_player_height ?? settingsState.height,
    };
  }

  async function hydrateFromBackend() {
    try {
      applySettingsState(await invoke("get_settings"));
    } catch (error) {
      console.warn("mini mode get_settings", error);
    }
    open = settingsState.visible;
    setMiniToggleUi();
    if (settingsState.visible) await openMiniWindow({ restoreOnly: true });
  }

  async function currentSnapshotFor(track) {
    const trackKey = currentPlayableKey(track);
    if (!trackKey) return null;
    const snapshot = readCurrentLyricsSnapshot?.() || null;
    if (currentPlayableKey(snapshot?.currentTrack) === trackKey) return snapshot;
    try {
      return await getCurrentLyricsSnapshot?.();
    } catch (error) {
      console.warn("mini mode getCurrentLyricsSnapshot", error);
      return snapshot;
    }
  }

  async function buildMiniState() {
    const track = getPlayQueue()[getPlayIndex()] || null;
    const snapshot = await currentSnapshotFor(track);
    const audio = getAudioEl();
    const { currentTimeMs, durationMs } = getPlaybackSeekDisplay(audio, track);
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      hasTrack: !!track,
      title: track?.title || "未播放",
      sub: track?.artist || (track ? "未知艺术家" : "选择曲目后可进入歌词 Mini 模式"),
      coverUrl: track?.cover_url || "",
      playing: !!audio && !!audio.src && !audio.paused,
      hasPrev: getPlayQueue().length > 0,
      hasNext: getPlayQueue().length > 0,
      progressValue: durationMs > 0 ? Math.min(1000, Math.floor((currentTimeMs / durationMs) * 1000)) : 0,
      currentText: formatTime(currentTimeMs / 1000),
      totalText: durationMs > 0 ? formatTime(durationMs / 1000) : "0:00",
      entries: Array.isArray(snapshot?.lrcEntries) ? snapshot.lrcEntries : [],
      wordLines: Array.isArray(snapshot?.wordLines) ? snapshot.wordLines : [],
      lyricPayload: snapshot?.payload || null,
      theme: document.documentElement.dataset.appTheme || "coral",
      themeMode: document.documentElement.dataset.themeMode || "system",
      customAccent: rootStyle.getPropertyValue("--accent").trim() || "#c62f2f",
      alwaysOnTop: settingsState.alwaysOnTop,
      translucent: settingsState.translucent,
    };
  }

  async function broadcastState() {
    if (!open) return;
    try {
      await emitTo(MINI_PLAYER_TARGET, "mini-player-state", await buildMiniState());
    } catch (error) {
      console.warn("emit mini-player-state", error);
    }
  }

  function stopSyncLoop() {
    if (!syncTimer) return;
    window.clearInterval(syncTimer);
    syncTimer = 0;
  }

  function startSyncLoop() {
    stopSyncLoop();
    if (!open) return;
    void broadcastState();
    syncTimer = window.setInterval(() => { void broadcastState(); }, MINI_SYNC_MS);
  }

  async function persistBounds() {
    const win = await windows.currentWindowRef();
    if (!win) return;
    try {
      const factor = await win.scaleFactor();
      const outerPos = await win.outerPosition();
      const outerSize = await win.outerSize();
      const logicalPos = outerPos.toLogical(factor);
      const logicalSize = outerSize.toLogical(factor);
      await persistSettings({
        mini_player_x: Math.round(logicalPos.x),
        mini_player_y: Math.round(logicalPos.y),
        mini_player_width: Math.round(logicalSize.width),
        mini_player_height: Math.round(logicalSize.height),
      });
    } catch (error) {
      console.warn("mini mode persist bounds", error);
    }
  }

  async function bindWindowHooks(win) {
    if (boundsCleanup) return;
    const [offMove, offResize] = await Promise.all([
      win.onMoved(() => schedulePersistBounds()),
      win.onResized(() => schedulePersistBounds()),
    ]);
    boundsCleanup = () => {
      try { offMove?.(); } catch {}
      try { offResize?.(); } catch {}
      if (boundsPersistTimer) window.clearTimeout(boundsPersistTimer);
      boundsPersistTimer = 0;
      boundsCleanup = null;
    };
  }

  function schedulePersistBounds() {
    if (boundsPersistTimer) window.clearTimeout(boundsPersistTimer);
    boundsPersistTimer = window.setTimeout(() => {
      boundsPersistTimer = 0;
      void persistBounds();
    }, 180);
  }

  async function syncWindowRuntimeState(win) {
    if (!win) return;
    try {
      const runtime = await win.getRuntimeWindow();
      await runtime.SetAlwaysOnTop(settingsState.alwaysOnTop);
      await runtime.SetBackgroundColour(0, 0, 0, 0);
    } catch (error) {
      console.warn("mini mode sync window runtime", error);
    }
  }

  async function openMiniWindow({ restoreOnly = false } = {}) {
    const win = await windows.ensureWindow(settingsState);
    await bindWindowHooks(win);
    await syncWindowRuntimeState(win);
    open = true;
    setMiniToggleUi();
    startSyncLoop();
    if (!restoreOnly) await persistSettings({ mini_player_visible: true });
    try {
      await invoke("hide_main_window");
    } catch (error) {
      console.warn("hide_main_window for mini mode", error);
    }
  }

  async function closeMiniWindow({ showMain = true } = {}) {
    stopSyncLoop();
    const win = await windows.currentWindowRef();
    if (win) await win.hide().catch((error) => console.warn("mini mode hide", error));
    open = false;
    setMiniToggleUi();
    await persistSettings({ mini_player_visible: false });
    if (showMain) {
      await invoke("show_main_window").catch((error) => console.warn("show_main_window from mini mode", error));
    }
  }

  async function toggle() {
    if (open) return closeMiniWindow();
    return openMiniWindow();
  }

  async function handleCommand(action, payload = {}) {
    if (action === "prev") return document.getElementById("btn-player-prev")?.click();
    if (action === "toggle") return document.getElementById("btn-player-play")?.click();
    if (action === "next") return document.getElementById("btn-player-next")?.click();
    if (action === "exit") return closeMiniWindow();
    if (action === "open-main") return closeMiniWindow({ showMain: true });
    if (action === "seek") {
      const audio = getAudioEl();
      const duration = audio?.duration;
      const value = Number(payload?.value);
      if (audio && duration && Number.isFinite(duration) && duration > 0 && Number.isFinite(value)) {
        audio.currentTime = (Math.max(0, Math.min(1000, value)) / 1000) * duration;
      }
      return broadcastState();
    }
    if (action === "toggle-pin") {
      settingsState.alwaysOnTop = !settingsState.alwaysOnTop;
      await persistSettings({ mini_player_always_on_top: settingsState.alwaysOnTop });
      const win = await windows.currentWindowRef();
      await syncWindowRuntimeState(win);
      return broadcastState();
    }
    if (action === "toggle-translucent") {
      settingsState.translucent = !settingsState.translucent;
      await persistSettings({ mini_player_translucent: settingsState.translucent });
      await syncWindowRuntimeState(await windows.currentWindowRef());
      return broadcastState();
    }
  }

  function wire() {
    document.getElementById("btn-dock-mini")?.addEventListener("click", () => { void toggle(); });
    setMiniToggleUi();
    void hydrateFromBackend();
  }

  return { broadcastState, handleCommand, isOpen: () => open, wire };
}
