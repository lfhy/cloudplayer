// Desktop lyric persistence isolates settings writes and window geometry sync.
import { invoke } from "../../wails/tauri-core.js";
import { emitTo } from "../../wails/tauri-event.js";
import { MAIN_WW, desktopLyricsState, lyricsWin } from "./state.js";

export async function requestMainLyricsSync(reason = "manual") {
  try {
    await emitTo(MAIN_WW, "desktop-lyrics-request-sync", { reason });
  } catch (error) {
    console.warn("desktop-lyrics-request-sync", error);
  }
}

export function schedulePersistBounds() {
  if (desktopLyricsState.persistTimer) clearTimeout(desktopLyricsState.persistTimer);
  desktopLyricsState.persistTimer = setTimeout(() => {
    desktopLyricsState.persistTimer = null;
    void persistWindowBounds();
  }, 420);
}

export async function persistWindowBounds() {
  try {
    const factor = await lyricsWin.scaleFactor();
    const op = await lyricsWin.outerPosition();
    const os = await lyricsWin.outerSize();
    const lp = op.toLogical(factor);
    const ls = os.toLogical(factor);
    await invoke("save_settings", {
      patch: {
        desktop_lyrics_x: Math.round(lp.x),
        desktop_lyrics_y: Math.round(lp.y),
        desktop_lyrics_width: Math.round(ls.width),
        desktop_lyrics_height: Math.round(ls.height),
      },
    });
  } catch (error) {
    console.warn("persistWindowBounds", error);
  }
}

export async function persistScale(next) {
  const value = Math.min(2.5, Math.max(0.5, next));
  desktopLyricsState.scale = value;
  document.documentElement.style.setProperty("--ly-scale", String(value));
  try {
    await invoke("save_settings", { patch: { desktop_lyrics_scale: value } });
  } catch (error) {
    console.warn("save_settings scale", error);
  }
}

export async function applyCursorPassthrough(locked) {
  const seq = ++desktopLyricsState.cursorPassthroughSeq;
  try {
    if (locked) {
      await lyricsWin.setIgnoreCursorEvents(true, { forward: true });
      return;
    }
    await lyricsWin.setIgnoreCursorEvents(false);
  } catch (error) {
    console.warn("setIgnoreCursorEvents", error);
  }
  if (locked) return;
  // Wails/macOS occasionally needs a second pass before the webview starts
  // receiving hover events again after being click-through.
  for (const delayMs of [50, 180]) {
    window.setTimeout(() => {
      if (desktopLyricsState.lyricsLocked || desktopLyricsState.cursorPassthroughSeq !== seq) return;
      void lyricsWin.setIgnoreCursorEvents(false).catch((error) => {
        console.warn("setIgnoreCursorEvents retry", error);
      });
    }, delayMs);
  }
}
