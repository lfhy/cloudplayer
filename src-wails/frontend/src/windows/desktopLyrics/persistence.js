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
  try {
    await lyricsWin.setIgnoreCursorEvents(!!locked, {
      forward: true,
    });
  } catch (error) {
    console.warn("setIgnoreCursorEvents", error);
  }
}
