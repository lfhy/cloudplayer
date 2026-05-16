// Close-confirm controller keeps the independent child-window exit flow minimal and self-contained.
import { Window as RuntimeWindow } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { applyAppTheme, applyPlatformClassNames, systemDarkMedia } from "../../app/helpers/platformTheme.js";
import { windowTitlebarTemplate, wireWindowChrome } from "../../features/window/chrome.js";
import { wireChildWindowAutoSize } from "../shared/autoSize.js";
import { invoke } from "../../wails/tauri-core.js";

const WINDOW_LABEL = "close-confirm";
const currentWindow = RuntimeWindow.Get(WINDOW_LABEL);
let suppressFocusRestore = false;

function renderCloseConfirmWindow(root) {
  root.innerHTML = `
    <div class="app-child-window-frame app-child-window-frame--dialog">
      ${windowTitlebarTemplate({
        title: "关闭主窗口",
        allowMinimize: false,
        allowMaximize: false,
        className: "app-titlebar--child",
      })}
      <main class="close-confirm-card">
        <header class="close-confirm-card__head">
          <h1 class="close-confirm-card__title">关闭主窗口？</h1>
        </header>
        <div class="close-confirm-card__body">
          <div class="close-confirm-card__actions">
            <button type="button" id="close-confirm-tray" class="close-confirm-choice">最小化到托盘</button>
            <button type="button" id="close-confirm-quit" class="close-confirm-choice close-confirm-choice--danger">退出应用</button>
          </div>
        </div>
        <footer class="close-confirm-card__footer">
          <button type="button" id="close-confirm-cancel" class="btn-outline">取消</button>
        </footer>
      </main>
    </div>
  `;
}

async function applyThemeFromSettings() {
  try {
    const settings = await invoke("get_settings");
    applyAppTheme(
      settings?.app_theme ?? settings?.appTheme ?? "coral",
      settings?.app_theme_custom_accent ?? settings?.appThemeCustomAccent ?? "#c62f2f",
      settings?.app_theme_mode ?? settings?.appThemeMode ?? "system"
    );
  } catch (error) {
    console.warn("get_settings for close confirm", error);
  }
}

async function hideCloseConfirmWindow() {
  try {
    await DesktopService.HideWindow(WINDOW_LABEL);
  } catch (error) {
    console.warn("hide close confirm window", error);
    try {
      await currentWindow.Hide();
    } catch (innerError) {
      console.warn("runtime hide close confirm window", innerError);
      window.close();
    }
  }
}

async function focusMainWindow() {
  try {
    await invoke("show_main_window");
  } catch (error) {
    console.warn("show_main_window", error);
  }
}

async function runCloseAction(mode) {
  suppressFocusRestore = true;
  if (mode === "tray") {
    await hideCloseConfirmWindow();
    try {
      await invoke("hide_main_window");
    } catch (error) {
      console.warn("hide_main_window", error);
      suppressFocusRestore = false;
      await focusMainWindow();
    }
    return;
  }
  try {
    await invoke("quit_app");
  } catch (error) {
    console.warn("quit_app", error);
    suppressFocusRestore = false;
    await focusMainWindow();
  }
}

async function cancelCloseAction() {
  suppressFocusRestore = true;
  await hideCloseConfirmWindow();
  await focusMainWindow();
}

function wireCloseConfirmWindow() {
  document.getElementById("close-confirm-tray")?.addEventListener("click", () => {
    void runCloseAction("tray");
  });
  document.getElementById("close-confirm-quit")?.addEventListener("click", () => {
    void runCloseAction("quit");
  });
  document.getElementById("close-confirm-cancel")?.addEventListener("click", () => {
    void cancelCloseAction();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    void cancelCloseAction();
  });
  window.addEventListener("beforeunload", () => {
    if (suppressFocusRestore) return;
    void focusMainWindow();
  });
  window.addEventListener("focus", () => {
    void applyThemeFromSettings();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void applyThemeFromSettings();
  });
  if (systemDarkMedia && typeof systemDarkMedia.addEventListener === "function") {
    systemDarkMedia.addEventListener("change", () => {
      void applyThemeFromSettings();
    });
  }
}

export function bootstrapCloseConfirmWindow() {
  document.addEventListener("DOMContentLoaded", () => {
    applyPlatformClassNames();
    renderCloseConfirmWindow(document.getElementById("app"));
    wireWindowChrome({ windowName: WINDOW_LABEL, allowMinimize: false, allowMaximize: false });
    wireCloseConfirmWindow();
    const autoSize = wireChildWindowAutoSize({
      element: document.querySelector(".app-child-window-frame--dialog"),
      windowLabel: WINDOW_LABEL,
      windowRef: currentWindow,
      // Keep the close-confirm window content-driven so the lower half does not turn into dead space.
      minHeight: 156,
      minWidth: 432,
      paddingHeight: 28,
    });
    void applyThemeFromSettings();
    window.addEventListener("beforeunload", () => autoSize.cleanup());
    window.setTimeout(() => {
      document.getElementById("close-confirm-tray")?.focus();
    }, 30);
  });
}
