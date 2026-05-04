// Lyrics window controller encapsulates desktop lyrics and replace-window lifecycle.
import { currentLyricsReplaceContext } from "./model.js";

export function createLyricsWindowController(deps) {
  const {
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
    syncDesktopLyricsState,
  } = deps;

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
    return {
      x: Math.max(0, Math.min(x, Math.max(0, window.screen.availWidth - width))),
      y: Math.max(0, Math.min(y, Math.max(0, window.screen.availHeight - height))),
      width,
      height,
    };
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

  async function openLyricsReplaceWindow() {
    const current = getPlayQueue()[getPlayIndex()] || null;
    const ctx = currentLyricsReplaceContext(current, getAudioEl()?.duration);
    const keyword = `${ctx.artist || ""} ${ctx.title || ""}`.trim();
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    ["title", "artist", "album", "trackKey"].forEach((key) => ctx[key] && params.set(key, ctx[key]));
    if (Number.isFinite(ctx.durationMs) && ctx.durationMs > 0) params.set("durationMs", String(ctx.durationMs));
    const bounds = await centeredChildWindowBounds(860, 620);
    const win = new WebviewWindow("lyrics-replace", {
      url: `/lyrics_replace.html?${params.toString()}`,
      title: "替换歌词",
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      resizable: true,
      alwaysOnTop: false,
      decorations: true,
      transparent: false,
      shadow: true,
      skipTaskbar: true,
      focus: true,
      macTitleBarStyle: "hiddenInset",
      invisibleTitleBarHeight: 54,
    });
    win.once("tauri://error", (error) => {
      console.error(error);
      alert("无法打开歌词替换窗口。");
    });
  }

  function scheduleDesktopLyricsStateSync(delays = [80, 260]) {
    if (!getDesktopLyricsOpen()) return;
    delays.forEach((delay) => window.setTimeout(() => getDesktopLyricsOpen() && void syncDesktopLyricsState(), delay));
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
    const win = new WebviewWindow("lyrics", {
      url: "/desktop_lyrics.html",
      title: "桌面歌词",
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      resizable: true,
      maximizable: false,
      alwaysOnTop: true,
      decorations: false,
      transparent: true,
      shadow: false,
      skipTaskbar: true,
      focus: false,
    });
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
        try {
          await invoke("persist_desktop_lyrics_bounds");
        } catch (error) {
          console.warn("persist_desktop_lyrics_bounds before hide", error);
        }
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
    const win = new WebviewWindow("lyrics", {
      url: "/desktop_lyrics.html",
      title: "桌面歌词",
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      resizable: true,
      maximizable: false,
      alwaysOnTop: true,
      decorations: false,
      transparent: true,
      shadow: false,
      skipTaskbar: true,
      focus: false,
    });
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

  async function closeDesktopLyrics() {
    const existing = getDesktopLyricsWindow() || (await WebviewWindow.getByLabel("lyrics"));
    if (existing) setDesktopLyricsWindow(existing);
    try {
      await invoke("persist_desktop_lyrics_bounds");
    } catch (error) {
      console.warn("persist_desktop_lyrics_bounds before close", error);
    }
    if (existing && (await existing.isVisible())) {
      await existing.hide();
    }
    setDesktopLyricsOpen(false);
    await setDockLyricsActive(false);
    await persistDesktopLyricsVisible(false);
  }

  return {
    openDesktopLyricsFromSettingsIfNeeded,
    openLyricsReplaceWindow,
    closeDesktopLyrics,
    scheduleDesktopLyricsStateSync,
    toggleDesktopLyrics,
  };
}
