import { invoke } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const lyricsWin = WebviewWindow.getCurrent();

let scale = 1;
let lyricsLocked = true;
let persistTimer = null;

/** @type {{ line1: string, line2: string, line1StartT: number, line1EndT: number, audioNow: number, receivedAtMs: number } | null} */
let lyAnchor = null;
let builtLine = "";

/** 未唱 / 已唱（与主窗设置一致，可由事件更新） */
let baseRgb = { r: 255, g: 255, b: 255 };
let hiRgb = { r: 255, g: 183, b: 212 };

function lerp255(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex) {
  const t = (hex || "").trim();
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(t);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function applyLyricColors(baseHex, highlightHex) {
  const b = hexToRgb(baseHex);
  const h = hexToRgb(highlightHex);
  if (b) baseRgb = b;
  if (h) hiRgb = h;
}

/** 未唱色 → 已唱色，逐字 t∈[0,1] */
function charColor(t) {
  return `rgb(${lerp255(baseRgb.r, hiRgb.r, t)},${lerp255(baseRgb.g, hiRgb.g, t)},${lerp255(baseRgb.b, hiRgb.b, t)})`;
}

function rebuildLine1Spans(text) {
  const e1 = document.getElementById("line1");
  if (!e1 || builtLine === text) return;
  builtLine = text;
  e1.replaceChildren();
  for (const ch of Array.from(text)) {
    const s = document.createElement("span");
    s.className = "ly-char";
    s.textContent = ch;
    e1.appendChild(s);
  }
}

function animateLyrics() {
  if (lyAnchor) {
    const { line1StartT, line1EndT, audioNow, receivedAtMs, line1 } = lyAnchor;
    rebuildLine1Spans(line1);
    const spans = document.getElementById("line1")?.children ?? [];
    const n = spans.length;
    if (n > 0) {
      const elapsed = (Date.now() - receivedAtMs) / 1000;
      const t = audioNow + elapsed;
      const dur = line1EndT - line1StartT;
      const p = dur > 0 ? Math.min(1, Math.max(0, (t - line1StartT) / dur)) : 1;
      for (let i = 0; i < n; i++) {
        const charP = Math.min(1, Math.max(0, p * n - i));
        spans[i].style.color = charColor(charP);
      }
    }
  }
  requestAnimationFrame(animateLyrics);
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
  const s = Math.min(2.5, Math.max(0.5, next));
  scale = s;
  document.documentElement.style.setProperty("--ly-scale", String(s));
  try {
    await invoke("save_settings", { patch: { desktop_lyrics_scale: s } });
  } catch (e) {
    console.warn("save_settings scale", e);
  }
}

/** 锁定：完全穿透（与下方窗口抢不到鼠标）；未锁定：正常交互。解锁仅主窗口菜单。 */
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
    lockBtn.textContent = "锁定";
    lockBtn.title = "锁定（解锁请用主窗口 ⋯ 菜单）";
  }
  const frameEl = document.getElementById("ly-frame");
  if (frameEl) {
    if (lyricsLocked) frameEl.removeAttribute("data-tauri-drag-region");
    else frameEl.setAttribute("data-tauri-drag-region", "");
  }
  void applyCursorPassthrough(lyricsLocked);
}

async function initLyricsWindow() {
  try {
    const s = await invoke("get_settings");
    if (s && typeof s.desktop_lyrics_scale === "number" && Number.isFinite(s.desktop_lyrics_scale)) {
      scale = Math.min(2.5, Math.max(0.5, s.desktop_lyrics_scale));
      document.documentElement.style.setProperty("--ly-scale", String(scale));
    }
    const locked =
      s && typeof s.desktop_lyrics_locked === "boolean" ? s.desktop_lyrics_locked : true;
    applyLyricsLockUi(locked);
    applyLyricColors(
      s?.desktop_lyrics_color_base ?? s?.desktopLyricsColorBase ?? "#ffffff",
      s?.desktop_lyrics_color_highlight ?? s?.desktopLyricsColorHighlight ?? "#ffb7d4"
    );
  } catch (e) {
    console.warn("get_settings fail", e);
    applyLyricsLockUi(true);
  }

  await lyricsWin.listen("desktop-lyrics-colors", (e) => {
    const p = e?.payload ?? {};
    applyLyricColors(p.base ?? "#ffffff", p.highlight ?? "#ffb7d4");
  });

  await lyricsWin.listen("desktop-lyrics-lines", (e) => {
    const p = e?.payload ?? {};
    lyAnchor = {
      line1: p.line1 ?? "—",
      line2: p.line2 ?? "—",
      line1StartT: Number(p.line1StartT ?? p.line1_start_t) || 0,
      line1EndT: Number(p.line1EndT ?? p.line1_end_t) || 0,
      audioNow: Number(p.audioNow ?? p.audio_now) || 0,
      receivedAtMs: Date.now(),
    };
    const e2 = document.getElementById("line2");
    if (e2) e2.textContent = lyAnchor.line2;
  });

  await lyricsWin.listen("desktop-lyrics-lock", (e) => {
    const p = e?.payload;
    const locked = p && typeof p === "object" && "locked" in p ? !!p.locked : true;
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
}

void initLyricsWindow();
requestAnimationFrame(animateLyrics);

/** 整框可拖；拦截歌词区域双击最大化（工具栏除外） */
const lyFrame = document.getElementById("ly-frame");
function lyricsPreventDragMaximize(ev) {
  if (ev.target?.closest?.(".ly-toolbar")) return;
  ev.preventDefault();
  ev.stopPropagation();
}
lyFrame?.addEventListener(
  "mousedown",
  (ev) => {
    if (ev.detail >= 2) lyricsPreventDragMaximize(ev);
  },
  true,
);
lyFrame?.addEventListener("dblclick", lyricsPreventDragMaximize, true);

/** 仅从歌词窗「锁定」；解锁请用主窗口菜单 */
const lockBtnEl = document.getElementById("btn-ly-lock");
if (lockBtnEl) {
  lockBtnEl.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (lyricsLocked) return;
    applyLyricsLockUi(true);
    try {
      await invoke("save_settings", { patch: { desktop_lyrics_locked: true } });
    } catch (e) {
      console.warn("save_settings fail", e);
    }
    try {
      await emitTo(MAIN_WW, "desktop-lyrics-lock-sync", { locked: true });
    } catch (e) {
      console.warn("emitTo main fail", e);
    }
  });
}

document.getElementById("ly-minus")?.addEventListener("click", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  void persistScale(scale - 0.08);
});
document.getElementById("ly-plus")?.addEventListener("click", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  void persistScale(scale + 0.08);
});

document.body.addEventListener(
  "wheel",
  (ev) => {
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    const delta = ev.deltaY > 0 ? -0.06 : 0.06;
    void persistScale(scale + delta);
  },
  { passive: false },
);
