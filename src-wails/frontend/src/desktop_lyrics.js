import { invoke } from "./wails/tauri-core.js";
import { emitTo } from "./wails/tauri-event.js";
import { WebviewWindow } from "./wails/tauri-webviewWindow.js";

const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const lyricsWin = WebviewWindow.getCurrent();
const frameEl = document.getElementById("ly-frame");

let scale = 1;
let lyricsLocked = false;
let persistTimer = null;

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

function setLines(a, b) {
  const e1 = document.getElementById("line1");
  const e2 = document.getElementById("line2");
  if (e1) e1.textContent = a || "—";
  if (e2) e2.textContent = b || "—";
}

/** 锁定：完全穿透；未锁定：正常交互并可拖动。 */
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
  const hint = document.getElementById("lock-hint");
  const lockBtn = document.getElementById("btn-ly-lock");
  if (lockBtn) {
    lockBtn.textContent = "锁定";
    lockBtn.title = "锁定（解锁请用主窗口 ⋯ 菜单）";
  }
  if (hint) {
    if (lyricsLocked) {
      hint.hidden = false;
      hint.textContent = "已锁定 请在主窗口 ⋯ 菜单解锁";
      hint.setAttribute("aria-hidden", "false");
    } else {
      hint.hidden = true;
      hint.setAttribute("aria-hidden", "true");
    }
  }
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
      s && typeof s.desktop_lyrics_locked === "boolean" ? s.desktop_lyrics_locked : false;
    applyLyricsLockUi(locked);
  } catch (e) {
    console.warn("get_settings fail", e);
    applyLyricsLockUi(false);
  }

  await lyricsWin.listen("desktop-lyrics-lines", (e) => {
    const p = e?.payload ?? {};
    const a = p.line1 ?? p.lineOne;
    const b = p.line2 ?? p.lineTwo;
    setLines(a, b);
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
