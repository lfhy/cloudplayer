// Online-mode confirm controller mirrors the close-confirm child window for settings-side confirmation.
import { Window as RuntimeWindow } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { applyAppTheme, applyPlatformClassNames, systemDarkMedia } from "../../app/helpers/platformTheme.js";
import { wireChildWindowAutoSize } from "../shared/autoSize.js";
import { emitTo } from "../../wails/tauri-event.js";
import { invoke } from "../../wails/tauri-core.js";

const WINDOW_LABEL = "online-mode-confirm";
const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const currentWindow = RuntimeWindow.Get(WINDOW_LABEL);
let suppressCancelReply = false;
let replySent = false;

function renderOnlineModeConfirmWindow(root) {
  root.innerHTML = `
    <main class="close-confirm-card">
      <header class="close-confirm-card__head">
        <h1 class="close-confirm-card__title">开启在线模式？</h1>
      </header>
      <div class="close-confirm-card__body online-mode-confirm__body">
        <p class="close-confirm-card__desc">会切换到酷狗云歌单，并立即重新拉取云端歌单。</p>
        <div class="close-confirm-card__actions">
          <button type="button" id="online-mode-confirm-cancel" class="close-confirm-choice">暂不切换</button>
          <button type="button" id="online-mode-confirm-continue" class="close-confirm-choice">继续开启</button>
        </div>
      </div>
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
    console.warn("get_settings for online mode confirm", error);
  }
}

async function emitResult(accepted) {
  if (replySent) return;
  replySent = true;
  await emitTo(MAIN_WW, "settings-online-mode-confirm-result", { accepted: !!accepted });
}

async function hideOnlineModeConfirmWindow() {
  try {
    await DesktopService.HideWindow(WINDOW_LABEL);
  } catch (error) {
    console.warn("hide online mode confirm window", error);
    try {
      await currentWindow.Hide();
    } catch (innerError) {
      console.warn("runtime hide online mode confirm window", innerError);
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

async function closeWithResult(accepted) {
  suppressCancelReply = true;
  await emitResult(accepted);
  await hideOnlineModeConfirmWindow();
  await focusMainWindow();
}

function wireOnlineModeConfirmWindow() {
  document.getElementById("online-mode-confirm-cancel")?.addEventListener("click", () => {
    void closeWithResult(false);
  });
  document.getElementById("online-mode-confirm-continue")?.addEventListener("click", () => {
    void closeWithResult(true);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    void closeWithResult(false);
  });
  window.addEventListener("beforeunload", () => {
    if (suppressCancelReply) return;
    void emitResult(false);
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

export function bootstrapOnlineModeConfirmWindow() {
  document.addEventListener("DOMContentLoaded", () => {
    applyPlatformClassNames();
    renderOnlineModeConfirmWindow(document.getElementById("app"));
    wireOnlineModeConfirmWindow();
    const cleanupAutoSize = wireChildWindowAutoSize({ element: document.querySelector(".close-confirm-card"), windowRef: currentWindow, minHeight: 188, minWidth: 432 });
    void applyThemeFromSettings();
    window.addEventListener("beforeunload", cleanupAutoSize);
    window.setTimeout(() => {
      document.getElementById("online-mode-confirm-continue")?.focus();
    }, 30);
  });
}
