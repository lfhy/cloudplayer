// Entry file only boots the native main-window close confirmation window.
import "./styles/windows/close-confirm.css";
import { alertRequestFailed } from "./app/helpers/errors.js";
import { applyAppTheme, applyPlatformClassNames } from "./app/helpers/platformTheme.js";
import { invoke } from "./wails/tauri-core.js";
import { WebviewWindow } from "./wails/tauri-webviewWindow.js";

const closeConfirmWindow = new WebviewWindow("close-confirm", {}, false);

function renderCloseConfirmWindow() {
  const root = document.getElementById("close-confirm-app");
  if (!root) throw new Error("close-confirm-app not found");
  root.innerHTML = `
    <main class="close-confirm-shell">
      <section class="close-confirm-panel">
        <header class="close-confirm-hero">
          <div class="close-confirm-copy">
            <h1 class="close-confirm-title">关闭 CloudPlayer 时要怎么处理？</h1>
            <p class="close-confirm-desc">这次可以临时选择，也可以记住为默认行为。</p>
          </div>
        </header>
        <section class="close-confirm-options" aria-label="关闭主窗口选项">
          <button type="button" class="close-confirm-option close-confirm-option--tray" id="close-confirm-tray">最小化到系统托盘</button>
          <button type="button" class="close-confirm-option close-confirm-option--quit" id="close-confirm-quit">退出 CloudPlayer</button>
        </section>
        <footer class="close-confirm-footer">
          <label class="close-confirm-remember">
            <input type="checkbox" id="close-confirm-remember" />
            <span>记住这次选择</span>
          </label>
          <button type="button" class="close-confirm-cancel" id="close-confirm-cancel">取消</button>
        </footer>
      </section>
    </main>
  `;
}

async function syncCloseConfirmTheme() {
  try {
    const settings = await invoke("get_settings");
    applyAppTheme(
      settings?.app_theme ?? settings?.appTheme ?? "coral",
      settings?.app_theme_custom_accent ?? settings?.appThemeCustomAccent ?? "#c62f2f",
      settings?.app_theme_mode ?? settings?.appThemeMode ?? "system",
    );
  } catch {
    applyAppTheme("coral", "#c62f2f", "system");
  }
}

async function applyCloseChoice(action) {
  const remember = !!document.getElementById("close-confirm-remember")?.checked;
  try {
    await invoke("apply_main_window_close_choice", { action, remember });
  } catch (error) {
    alertRequestFailed(error, "main window close");
  }
}

function wireCloseConfirmWindow() {
  document.getElementById("close-confirm-tray")?.addEventListener("click", () => {
    void applyCloseChoice("tray");
  });
  document.getElementById("close-confirm-quit")?.addEventListener("click", () => {
    void applyCloseChoice("quit");
  });
  document.getElementById("close-confirm-cancel")?.addEventListener("click", () => {
    void closeConfirmWindow.hide();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") void closeConfirmWindow.hide();
  });
  window.addEventListener("focus", () => {
    void syncCloseConfirmTheme();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderCloseConfirmWindow();
  applyPlatformClassNames();
  wireCloseConfirmWindow();
  void syncCloseConfirmTheme();
});
