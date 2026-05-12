const MINI_PLAYER_LABEL = "mini-player";
const MINI_PLAYER_URL = "/mini_player.html";
const MINI_DEFAULT_WIDTH = 460;
const MINI_DEFAULT_HEIGHT = 360;
const MINI_MIN_WIDTH = 360;
const MINI_MIN_HEIGHT = 240;

// Mini-window helpers isolate child-window creation and persisted bounds recovery.
export function createMiniModeWindowController({ WebviewWindow }) {
  async function currentWindowRef() {
    return WebviewWindow.getByLabel(MINI_PLAYER_LABEL);
  }

  async function resolveBounds(settings = {}) {
    const width = Math.max(MINI_MIN_WIDTH, Number(settings.width) || MINI_DEFAULT_WIDTH);
    const height = Math.max(MINI_MIN_HEIGHT, Number(settings.height) || MINI_DEFAULT_HEIGHT);
    const savedX = Number.isFinite(Number(settings.x)) ? Number(settings.x) : null;
    const savedY = Number.isFinite(Number(settings.y)) ? Number(settings.y) : null;
    if (savedX != null && savedY != null) {
      return { x: Math.max(0, Math.round(savedX)), y: Math.max(0, Math.round(savedY)), width, height };
    }
    let x = Math.round((window.screen.availWidth - width) / 2);
    let y = Math.round((window.screen.availHeight - height) / 2);
    try {
      const current = WebviewWindow.getCurrent();
      const factor = await current.scaleFactor();
      const outerPos = await current.outerPosition();
      const outerSize = await current.outerSize();
      const logicalPos = outerPos.toLogical(factor);
      const logicalSize = outerSize.toLogical(factor);
      x = Math.round(logicalPos.x + (logicalSize.width - width) / 2);
      y = Math.round(logicalPos.y + Math.min(56, Math.max(20, (logicalSize.height - height) / 3)));
    } catch (error) {
      console.warn("mini mode resolve bounds", error);
    }
    return {
      x: Math.max(0, Math.min(x, Math.max(0, window.screen.availWidth - width))),
      y: Math.max(0, Math.min(y, Math.max(0, window.screen.availHeight - height))),
      width,
      height,
    };
  }

  async function ensureWindow(settings = {}) {
    const existing = await currentWindowRef();
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return existing;
    }
    const bounds = await resolveBounds(settings);
    const win = new WebviewWindow(MINI_PLAYER_LABEL, {
      url: MINI_PLAYER_URL,
      title: "CloudPlayer Mini",
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      resizable: true,
      alwaysOnTop: settings.alwaysOnTop !== false,
      decorations: false,
      transparent: true,
      shadow: true,
      skipTaskbar: true,
      focus: true,
    });
    await new Promise((resolve, reject) => {
      let settled = false;
      win.once("tauri://created", () => {
        if (settled) return;
        settled = true;
        resolve();
      });
      win.once("tauri://error", (error) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error || "mini window error")));
      });
      window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve();
      }, 2500);
    });
    return win;
  }

  return { currentWindowRef, ensureWindow, label: MINI_PLAYER_LABEL };
}

export const MINI_PLAYER_TARGET = { kind: "WebviewWindow", label: MINI_PLAYER_LABEL };
