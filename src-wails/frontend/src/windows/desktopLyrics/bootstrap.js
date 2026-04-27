// Desktop lyrics bootstrap wires runtime events, persistence and user controls.
import { invoke } from "../../wails/tauri-core.js";
import { emitTo } from "../../wails/tauri-event.js";
import { applyLyricColors } from "./colors.js";
import { schedulePersistBounds, persistScale, requestMainLyricsSync } from "./persistence.js";
import { animateLyrics } from "./render.js";
import { frameEl, MAIN_WW, desktopLyricsState, lyricsWin } from "./state.js";
import { applyLyricsLockUi, lyricsPreventDragMaximize } from "./ui.js";

async function initLyricsWindow() {
  try {
    const settings = await invoke("get_settings");
    if (settings && typeof settings.desktop_lyrics_scale === "number" && Number.isFinite(settings.desktop_lyrics_scale)) {
      desktopLyricsState.scale = Math.min(2.5, Math.max(0.5, settings.desktop_lyrics_scale));
      document.documentElement.style.setProperty("--ly-scale", String(desktopLyricsState.scale));
    }
    const locked = settings && typeof settings.desktop_lyrics_locked === "boolean" ? settings.desktop_lyrics_locked : true;
    applyLyricsLockUi(locked);
    applyLyricColors(
      settings?.desktop_lyrics_color_base ?? settings?.desktopLyricsColorBase ?? "#ffffff",
      settings?.desktop_lyrics_color_highlight ?? settings?.desktopLyricsColorHighlight ?? "#ffb7d4"
    );
  } catch (error) {
    console.warn("get_settings fail", error);
    applyLyricsLockUi(true);
    applyLyricColors("#ffffff", "#ffb7d4");
  }

  await lyricsWin.listen("desktop-lyrics-colors", (event) => {
    const payload = event?.payload ?? {};
    applyLyricColors(payload.base ?? "#ffffff", payload.highlight ?? "#ffb7d4");
  });

  await lyricsWin.listen("desktop-lyrics-lines", (event) => {
    const payload = event?.payload ?? {};
    const activeSlot = Number(payload.activeSlot ?? payload.active_slot);
    desktopLyricsState.lyAnchor = {
      line1: payload.line1 ?? "—",
      line2: payload.line2 ?? "—",
      activeSlot: activeSlot === 2 ? 2 : 1,
      line1StartT: Number(payload.line1StartT ?? payload.line1_start_t) || 0,
      line1EndT: Number(payload.line1EndT ?? payload.line1_end_t) || 0,
      line2StartT: Number(payload.line2StartT ?? payload.line2_start_t) || 0,
      line2EndT: Number(payload.line2EndT ?? payload.line2_end_t) || 0,
      line1Words: payload.line1Words ?? payload.line1_words ?? null,
      line2Words: payload.line2Words ?? payload.line2_words ?? null,
      audioNow: Number(payload.audioNow ?? payload.audio_now) || 0,
      receivedAtMs: Date.now(),
    };
  });

  await lyricsWin.listen("desktop-lyrics-lock", (event) => {
    const payload = event?.payload;
    const locked = payload && typeof payload === "object" && "locked" in payload ? !!payload.locked : true;
    applyLyricsLockUi(locked);
  });

  const unMove = await lyricsWin.onMoved(() => {
    schedulePersistBounds();
  });
  const unResize = await lyricsWin.onResized(() => {
    schedulePersistBounds();
  });
  window.addEventListener("beforeunload", () => {
    try { unMove(); } catch { /* ignore */ }
    try { unResize(); } catch { /* ignore */ }
  });

  void requestMainLyricsSync("init");
  window.setTimeout(() => {
    void requestMainLyricsSync("init-delay");
  }, 180);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void requestMainLyricsSync("visibility");
  });
  window.addEventListener("focus", () => {
    void requestMainLyricsSync("focus");
  });
}

function wireLyricsWindowControls() {
  frameEl?.addEventListener(
    "mousedown",
    (event) => {
      if (event.detail >= 2) lyricsPreventDragMaximize(event);
    },
    true
  );
  frameEl?.addEventListener("dblclick", lyricsPreventDragMaximize, true);

  const lockBtnEl = document.getElementById("btn-ly-lock");
  if (lockBtnEl) {
    lockBtnEl.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (desktopLyricsState.lyricsLocked) return;
      applyLyricsLockUi(true);
      try {
        await invoke("save_settings", { patch: { desktop_lyrics_locked: true } });
      } catch (error) {
        console.warn("save_settings fail", error);
      }
      try {
        await emitTo(MAIN_WW, "desktop-lyrics-lock-sync", { locked: true });
      } catch (error) {
        console.warn("emitTo main fail", error);
      }
    });
  }

  document.getElementById("ly-minus")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void persistScale(desktopLyricsState.scale - 0.08);
  });
  document.getElementById("ly-plus")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void persistScale(desktopLyricsState.scale + 0.08);
  });

  document.body.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.06 : 0.06;
      void persistScale(desktopLyricsState.scale + delta);
    },
    { passive: false }
  );
}

export function bootstrapDesktopLyricsWindow() {
  void initLyricsWindow();
  wireLyricsWindowControls();
  requestAnimationFrame(animateLyrics);
}
