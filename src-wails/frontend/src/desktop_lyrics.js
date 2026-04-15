import { invoke } from "./wails/tauri-core.js";
import { emitTo } from "./wails/tauri-event.js";
import { WebviewWindow } from "./wails/tauri-webviewWindow.js";

const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const lyricsWin = WebviewWindow.getCurrent();
const frameEl = document.getElementById("ly-frame");

let scale = 1;
let lyricsLocked = true;
let persistTimer = null;

/** @type {{ line1: string, line2: string, line1StartT: number, line1EndT: number, audioNow: number, receivedAtMs: number } | null} */
let lyAnchor = null;
let builtLine = "";

let baseRgb = { r: 255, g: 255, b: 255 };
let hiRgb = { r: 255, g: 183, b: 212 };

function lerp255(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex) {
  const value = (hex || "").trim();
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (!match) return null;
  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
}

function applyLyricColors(baseHex, highlightHex) {
  const base = hexToRgb(baseHex);
  const highlight = hexToRgb(highlightHex);
  if (base) baseRgb = base;
  if (highlight) hiRgb = highlight;
  document.documentElement.style.setProperty(
    "--ly-text",
    `rgb(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b})`
  );
}

function charColor(progress) {
  return `rgb(${lerp255(baseRgb.r, hiRgb.r, progress)}, ${lerp255(baseRgb.g, hiRgb.g, progress)}, ${lerp255(baseRgb.b, hiRgb.b, progress)})`;
}

function rebuildLine1Spans(text) {
  const line1El = document.getElementById("line1");
  if (!line1El || builtLine === text) return;
  builtLine = text;
  line1El.replaceChildren();
  for (const ch of Array.from(text)) {
    const span = document.createElement("span");
    span.className = "ly-char";
    span.textContent = ch;
    line1El.appendChild(span);
  }
}

function animateLyrics() {
  if (lyAnchor) {
    const { line1StartT, line1EndT, audioNow, receivedAtMs, line1 } = lyAnchor;
    rebuildLine1Spans(line1);
    const spans = document.getElementById("line1")?.children ?? [];
    const total = spans.length;
    if (total > 0) {
      const elapsed = (Date.now() - receivedAtMs) / 1000;
      const currentTime = audioNow + elapsed;
      const duration = line1EndT - line1StartT;
      const progress =
        duration > 0 ? Math.min(1, Math.max(0, (currentTime - line1StartT) / duration)) : 1;
      for (let index = 0; index < total; index += 1) {
        const charProgress = Math.min(1, Math.max(0, progress * total - index));
        spans[index].style.color = charColor(charProgress);
      }
    }
  }
  requestAnimationFrame(animateLyrics);
}

async function requestMainLyricsSync(reason = "manual") {
  try {
    await emitTo(MAIN_WW, "desktop-lyrics-request-sync", { reason });
  } catch (e) {
    console.warn("desktop-lyrics-request-sync", e);
  }
}

function schedulePersistBounds() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistWindowBounds();
  }, 420);
}

async function persistWindowBounds() {
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
  } catch (e) {
    console.warn("persistWindowBounds", e);
  }
}

async function persistScale(next) {
  const value = Math.min(2.5, Math.max(0.5, next));
  scale = value;
  document.documentElement.style.setProperty("--ly-scale", String(value));
  try {
    await invoke("save_settings", { patch: { desktop_lyrics_scale: value } });
  } catch (e) {
    console.warn("save_settings scale", e);
  }
}

async function applyCursorPassthrough(locked) {
  try {
    await lyricsWin.setIgnoreCursorEvents(!!locked);
  } catch (e) {
    console.warn("setIgnoreCursorEvents", e);
  }
}

function applyLyricsLockUi(locked) {
  lyricsLocked = !!locked;
  document.body.classList.toggle("lyrics-locked", lyricsLocked);
  const lockBtn = document.getElementById("btn-ly-lock");
  if (lockBtn) {
    lockBtn.title = "锁定桌面歌词";
    lockBtn.setAttribute("aria-label", "锁定桌面歌词");
  }
  if (frameEl) {
    if (lyricsLocked) frameEl.removeAttribute("data-tauri-drag-region");
    else frameEl.setAttribute("data-tauri-drag-region", "");
  }
  void applyCursorPassthrough(lyricsLocked);
}

async function initLyricsWindow() {
  try {
    const settings = await invoke("get_settings");
    if (
      settings &&
      typeof settings.desktop_lyrics_scale === "number" &&
      Number.isFinite(settings.desktop_lyrics_scale)
    ) {
      scale = Math.min(2.5, Math.max(0.5, settings.desktop_lyrics_scale));
      document.documentElement.style.setProperty("--ly-scale", String(scale));
    }
    const locked =
      settings && typeof settings.desktop_lyrics_locked === "boolean"
        ? settings.desktop_lyrics_locked
        : true;
    applyLyricsLockUi(locked);
    applyLyricColors(
      settings?.desktop_lyrics_color_base ?? settings?.desktopLyricsColorBase ?? "#ffffff",
      settings?.desktop_lyrics_color_highlight ??
        settings?.desktopLyricsColorHighlight ??
        "#ffb7d4"
    );
  } catch (e) {
    console.warn("get_settings fail", e);
    applyLyricsLockUi(true);
    applyLyricColors("#ffffff", "#ffb7d4");
  }

  await lyricsWin.listen("desktop-lyrics-colors", (e) => {
    const payload = e?.payload ?? {};
    applyLyricColors(payload.base ?? "#ffffff", payload.highlight ?? "#ffb7d4");
  });

  await lyricsWin.listen("desktop-lyrics-lines", (e) => {
    const payload = e?.payload ?? {};
    lyAnchor = {
      line1: payload.line1 ?? "—",
      line2: payload.line2 ?? "—",
      line1StartT: Number(payload.line1StartT ?? payload.line1_start_t) || 0,
      line1EndT: Number(payload.line1EndT ?? payload.line1_end_t) || 0,
      audioNow: Number(payload.audioNow ?? payload.audio_now) || 0,
      receivedAtMs: Date.now(),
    };
    const line2El = document.getElementById("line2");
    if (line2El) line2El.textContent = lyAnchor.line2;
  });

  await lyricsWin.listen("desktop-lyrics-lock", (e) => {
    const payload = e?.payload;
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
    try {
      unMove();
    } catch {
      /* ignore */
    }
    try {
      unResize();
    } catch {
      /* ignore */
    }
  });

  void requestMainLyricsSync("init");
  window.setTimeout(() => {
    void requestMainLyricsSync("init-delay");
  }, 180);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void requestMainLyricsSync("visibility");
    }
  });
  window.addEventListener("focus", () => {
    void requestMainLyricsSync("focus");
  });
}

void initLyricsWindow();
requestAnimationFrame(animateLyrics);

function lyricsPreventDragMaximize(event) {
  if (event.target?.closest?.(".ly-toolbar")) return;
  event.preventDefault();
  event.stopPropagation();
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
    try {
      const nextLocked = !lyricsLocked;
      applyLyricsLockUi(nextLocked);
      await invoke("save_settings", { patch: { desktop_lyrics_locked: nextLocked } });
    } catch (e) {
      console.warn("save_settings fail", e);
    }
    try {
      await emitTo(MAIN_WW, "desktop-lyrics-lock-sync", { locked: lyricsLocked });
    } catch (e) {
      console.warn("emitTo main fail", e);
    }
  });
}

document.getElementById("ly-minus")?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  void persistScale(scale - 0.08);
});
document.getElementById("ly-plus")?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  void persistScale(scale + 0.08);
});

document.body.addEventListener(
  "wheel",
  (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.06 : 0.06;
    void persistScale(scale + delta);
  },
  { passive: false }
);
