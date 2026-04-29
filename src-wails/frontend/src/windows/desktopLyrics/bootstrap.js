// Desktop lyrics bootstrap wires runtime events, persistence and user controls.
import { invoke } from "../../wails/tauri-core.js";
import { emitTo } from "../../wails/tauri-event.js";
import { applyLyricColors } from "./colors.js";
import { schedulePersistBounds, persistScale, requestMainLyricsSync } from "./persistence.js";
import { animateLyrics } from "./render.js";
import { frameEl, MAIN_WW, desktopLyricsState, lyricsWin } from "./state.js";
import { applyLyricsLockUi, lyricsPreventDragMaximize } from "./ui.js";

const LYRICS_IDLE_LINE1 = "播放完成";
const LYRICS_IDLE_LINE2 = "选择下一首继续聆听";

async function initLyricsWindow() {
  try {
    const settings = await invoke("get_settings");
    if (settings && typeof settings.desktop_lyrics_scale === "number" && Number.isFinite(settings.desktop_lyrics_scale)) {
      desktopLyricsState.scale = Math.min(2.5, Math.max(0.5, settings.desktop_lyrics_scale));
      document.documentElement.style.setProperty("--ly-scale", String(desktopLyricsState.scale));
    }
    const idleLine1 = String(settings?.desktop_lyrics_idle_line1 ?? settings?.desktopLyricsIdleLine1 ?? LYRICS_IDLE_LINE1).trim();
    const idleLine2 = String(settings?.desktop_lyrics_idle_line2 ?? settings?.desktopLyricsIdleLine2 ?? LYRICS_IDLE_LINE2).trim();
    const line1El = document.getElementById("line1");
    const line2El = document.getElementById("line2");
    if (line1El) line1El.textContent = idleLine1 || LYRICS_IDLE_LINE1;
    if (line2El) line2El.textContent = idleLine2 || LYRICS_IDLE_LINE2;
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
    const line1 = String(payload.line1 ?? "").trim();
    const line2 = String(payload.line2 ?? "").trim();
    desktopLyricsState.lyAnchor = {
      line1: line1 || LYRICS_IDLE_LINE1,
      line2: line2 || LYRICS_IDLE_LINE2,
      activeSlot: activeSlot === 2 ? 2 : 1,
      line1StartT: Number(payload.line1StartT ?? payload.line1_start_t) || 0,
      line1EndT: Number(payload.line1EndT ?? payload.line1_end_t) || 0,
      line2StartT: Number(payload.line2StartT ?? payload.line2_start_t) || 0,
      line2EndT: Number(payload.line2EndT ?? payload.line2_end_t) || 0,
      line1Words: payload.line1Words ?? payload.line1_words ?? null,
      line2Words: payload.line2Words ?? payload.line2_words ?? null,
      audioNow: Number(payload.audioNow ?? payload.audio_now) || 0,
      audioPlaying: !!payload.audioPlaying,
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
  const contextMenuEl = document.getElementById("ly-context-menu");
  const replaceBtnEl = document.getElementById("ly-replace");

  function hideContextMenu() {
    if (contextMenuEl) contextMenuEl.hidden = true;
  }

  function showContextMenu(clientX, clientY) {
    if (!contextMenuEl) return;
    contextMenuEl.hidden = false;
    const maxX = Math.max(4, window.innerWidth - contextMenuEl.offsetWidth - 4);
    const maxY = Math.max(4, window.innerHeight - contextMenuEl.offsetHeight - 4);
    contextMenuEl.style.left = `${Math.max(4, Math.min(clientX, maxX))}px`;
    contextMenuEl.style.top = `${Math.max(4, Math.min(clientY, maxY))}px`;
  }

  async function requestOpenLyricsReplace() {
    try {
      await emitTo(MAIN_WW, "desktop-lyrics-open-replace", {});
    } catch (error) {
      console.warn("emit desktop-lyrics-open-replace fail", error);
    }
  }

  async function requestLockLyricsWindow() {
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
  }

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
      await requestLockLyricsWindow();
    });
  }

  replaceBtnEl?.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await requestOpenLyricsReplace();
  });

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

  frameEl?.addEventListener("contextmenu", (event) => {
    if (desktopLyricsState.lyricsLocked) return;
    event.preventDefault();
    event.stopPropagation();
    showContextMenu(event.clientX, event.clientY);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!contextMenuEl || contextMenuEl.hidden) return;
    if (event.target instanceof Node && contextMenuEl.contains(event.target)) return;
    hideContextMenu();
  });
  window.addEventListener("blur", hideContextMenu);
  window.addEventListener("resize", hideContextMenu);

  document.getElementById("ly-menu-replace")?.addEventListener("click", async () => {
    hideContextMenu();
    await requestOpenLyricsReplace();
  });
  document.getElementById("ly-menu-minus")?.addEventListener("click", () => {
    hideContextMenu();
    void persistScale(desktopLyricsState.scale - 0.08);
  });
  document.getElementById("ly-menu-plus")?.addEventListener("click", () => {
    hideContextMenu();
    void persistScale(desktopLyricsState.scale + 0.08);
  });
  document.getElementById("ly-menu-lock")?.addEventListener("click", async () => {
    hideContextMenu();
    await requestLockLyricsWindow();
  });
}

export function bootstrapDesktopLyricsWindow() {
  void initLyricsWindow();
  wireLyricsWindowControls();
  requestAnimationFrame(animateLyrics);
}
