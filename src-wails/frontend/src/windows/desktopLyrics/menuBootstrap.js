// Desktop lyrics context menu window forwards actions back to the main app.
import { emitTo } from "../../wails/tauri-event.js";
import { WebviewWindow } from "../../wails/tauri-webviewWindow.js";

const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const LYRICS_WW = { kind: "WebviewWindow", label: "lyrics" };

export function bootstrapDesktopLyricsContextMenuWindow() {
  const menuWin = WebviewWindow.getCurrent();
  const closeSelf = async () => {
    try {
      await menuWin.hide();
    } catch (error) {
      console.warn("hide lyrics context menu", error);
    }
  };

  async function trigger(action) {
    await closeSelf();
    if (action === "replace") {
      await emitTo(MAIN_WW, "desktop-lyrics-open-replace", {});
      return;
    }
    if (action === "close") {
      await emitTo(MAIN_WW, "desktop-lyrics-close-request", {});
      return;
    }
    if (action === "lock") {
      await emitTo(MAIN_WW, "desktop-lyrics-request-lock", { locked: true });
      return;
    }
    if (action === "smaller") {
      await emitTo(LYRICS_WW, "desktop-lyrics-scale-step", { delta: -0.08 });
      return;
    }
    if (action === "larger") {
      await emitTo(LYRICS_WW, "desktop-lyrics-scale-step", { delta: 0.08 });
    }
  }

  const wire = () => {
    document.getElementById("ly-menu-close")?.addEventListener("click", () => void trigger("close"));
    document.getElementById("ly-menu-replace")?.addEventListener("click", () => void trigger("replace"));
    document.getElementById("ly-menu-minus")?.addEventListener("click", () => void trigger("smaller"));
    document.getElementById("ly-menu-plus")?.addEventListener("click", () => void trigger("larger"));
    document.getElementById("ly-menu-lock")?.addEventListener("click", () => void trigger("lock"));
    window.addEventListener("blur", () => void closeSelf());
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") void closeSelf();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire, { once: true });
  } else {
    wire();
  }
}
