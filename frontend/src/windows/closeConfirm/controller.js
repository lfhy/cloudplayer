// Close-confirm controller keeps the independent child-window exit flow minimal and self-contained.
import { Window as RuntimeWindow } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { applyAppTheme, applyPlatformClassNames, systemDarkMedia } from "../../app/helpers/platformTheme.js";
import { invoke } from "../../wails/tauri-core.js";

const WINDOW_LABEL = "close-confirm";
const currentWindow = RuntimeWindow.Get(WINDOW_LABEL);
let suppressFocusRestore = false;

function resetRememberChoice() {
  const remember = document.getElementById("close-confirm-remember");
  if (remember) remember.checked = false;
}

function renderCloseConfirmWindow(root) {
  root.innerHTML = `
    <main class="close-confirm-card">
      <header class="close-confirm-card__head">
        <h1 class="close-confirm-card__title">关闭主窗口？</h1>
      </header>
      <div class="close-confirm-card__actions">
        <button type="button" id="close-confirm-tray" class="close-confirm-choice">最小化到托盘</button>
        <button type="button" id="close-confirm-quit" class="close-confirm-choice close-confirm-choice--danger">退出应用</button>
      </div>
      <footer class="close-confirm-card__footer">
        <label class="close-confirm-card__remember"><input type="checkbox" id="close-confirm-remember" /> 记住这次选择</label>
        <button type="button" id="close-confirm-cancel" class="btn-outline">取消</button>
      </footer>
    </main>
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

async function persistRememberedAction(mode) {
  if (!document.getElementById("close-confirm-remember")?.checked) return;
  const patch = { main_window_close_action: mode === "tray" ? "tray" : "quit" };
  try {
    await invoke("save_settings", { patch });
  } catch (error) {
    console.warn("save_settings main_window_close_action", error);
  }
}

async function runCloseAction(mode) {
  suppressFocusRestore = true;
  await persistRememberedAction(mode);
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
    resetRememberChoice();
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
    resetRememberChoice();
    wireCloseConfirmWindow();
    void applyThemeFromSettings();
    window.setTimeout(() => {
      document.getElementById("close-confirm-tray")?.focus();
    }, 30);
  });
}
