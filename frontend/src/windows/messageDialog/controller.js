// Message-dialog controller renders one-button notifications in the shared child-window shell.
import { Window as RuntimeWindow } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { applyAppTheme, applyPlatformClassNames, systemDarkMedia } from "../../app/helpers/platformTheme.js";
import { escapeHtml } from "../../app/helpers/text.js";
import { windowTitlebarTemplate, wireWindowChrome } from "../../features/window/chrome.js";
import { wireChildWindowAutoSize } from "../shared/autoSize.js";
import { emitTo } from "../../wails/tauri-event.js";
import { invoke } from "../../wails/tauri-core.js";

const WINDOW_LABEL = "message-dialog";
const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const currentWindow = RuntimeWindow.Get(WINDOW_LABEL);
let replySent = false;
let suppressCloseReply = false;

function dialogCopy() {
  const params = new URLSearchParams(globalThis.location?.search || "");
  return {
    title: String(params.get("title") || "提示").trim() || "提示",
    heading: String(params.get("heading") || "请求失败").trim() || "请求失败",
    message: String(params.get("message") || "请稍后重试。").trim() || "请稍后重试。",
    buttonText: String(params.get("buttonText") || "知道了").trim() || "知道了",
  };
}

function renderMessageDialogWindow(root) {
  const copy = dialogCopy();
  document.title = copy.title;
  root.innerHTML = `
    <div class="app-child-window-frame app-child-window-frame--dialog">
      ${windowTitlebarTemplate({
        title: copy.title,
        allowMinimize: false,
        allowMaximize: false,
        className: "app-titlebar--child",
      })}
      <main class="close-confirm-card message-dialog-card">
        <header class="close-confirm-card__head">
          <h1 class="close-confirm-card__title">${escapeHtml(copy.heading)}</h1>
        </header>
        <div class="close-confirm-card__body message-dialog-card__body">
          <p class="close-confirm-card__desc message-dialog-card__desc">${escapeHtml(copy.message)}</p>
        </div>
        <footer class="close-confirm-card__footer message-dialog-card__footer">
          <button type="button" id="message-dialog-confirm" class="btn-accent">${escapeHtml(copy.buttonText)}</button>
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
    console.warn("get_settings for message dialog", error);
  }
}

async function emitResult() {
  if (replySent) return;
  replySent = true;
  await emitTo(MAIN_WW, "message-dialog-result", { accepted: true });
}

async function hideMessageDialogWindow() {
  try {
    await DesktopService.HideWindow(WINDOW_LABEL);
  } catch (error) {
    console.warn("hide message dialog window", error);
    try {
      await currentWindow.Hide();
    } catch (innerError) {
      console.warn("runtime hide message dialog window", innerError);
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

async function closeMessageDialog() {
  suppressCloseReply = true;
  await emitResult();
  await hideMessageDialogWindow();
  await focusMainWindow();
}

function wireMessageDialogWindow() {
  document.getElementById("message-dialog-confirm")?.addEventListener("click", () => {
    void closeMessageDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" && event.key !== "Enter") return;
    event.preventDefault();
    void closeMessageDialog();
  });
  window.addEventListener("beforeunload", () => {
    if (suppressCloseReply) return;
    void emitResult();
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

export function bootstrapMessageDialogWindow() {
  document.addEventListener("DOMContentLoaded", () => {
    replySent = false;
    suppressCloseReply = false;
    applyPlatformClassNames();
    renderMessageDialogWindow(document.getElementById("app"));
    wireWindowChrome({ windowName: WINDOW_LABEL, allowMinimize: false, allowMaximize: false });
    wireMessageDialogWindow();
    const autoSize = wireChildWindowAutoSize({
      element: document.querySelector(".app-child-window-frame--dialog"),
      windowLabel: WINDOW_LABEL,
      windowRef: currentWindow,
      minHeight: 156,
      minWidth: 456,
      paddingHeight: 18,
    });
    void applyThemeFromSettings();
    window.addEventListener("beforeunload", () => autoSize.cleanup());
  });
}
