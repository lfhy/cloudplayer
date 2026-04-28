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
      <section class="close-confirm-card">
        <header class="close-confirm-copy">
          <span class="close-confirm-eyebrow">关闭主窗口</span>
          <h1 class="close-confirm-title">要退出还是最小化到托盘？</h1>
          <p class="close-confirm-desc">可以先临时选择一次，也可以勾选记住，下次点关闭按钮时直接按这个行为执行。</p>
        </header>
        <label class="close-confirm-remember">
          <input type="checkbox" id="close-confirm-remember" />
          <span>记住这次选择</span>
        </label>
        <div class="close-confirm-actions">
          <button type="button" class="close-confirm-btn close-confirm-btn--secondary" id="close-confirm-tray">最小化到系统托盘</button>
          <button type="button" class="close-confirm-btn close-confirm-btn--accent" id="close-confirm-quit">退出 CloudPlayer</button>
        </div>
        <button type="button" class="close-confirm-cancel" id="close-confirm-cancel">取消</button>
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
