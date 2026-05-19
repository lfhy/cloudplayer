// Database-repair controller keeps the destructive reset confirmation and loading feedback inside one standalone child window.
import { Window as RuntimeWindow } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { applyAppTheme, applyPlatformClassNames, isWindowsDesktop, systemDarkMedia } from "../../app/helpers/platformTheme.js";
import { windowTitlebarTemplate, wireWindowChrome } from "../../features/window/chrome.js";
import { wireChildWindowAutoSize } from "../shared/autoSize.js";
import { emitTo, listen } from "../../wails/tauri-event.js";
import { invoke } from "../../wails/tauri-core.js";

const WINDOW_LABEL = "database-repair";
const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const currentWindow = RuntimeWindow.Get(WINDOW_LABEL);
let activeRequestID = "";
let replySent = false;
let suppressCancelReply = false;

function renderDatabaseRepairWindow(root) {
  const titlebar = isWindowsDesktop()
    ? ""
    : windowTitlebarTemplate({
        title: "修复数据库",
        allowMinimize: false,
        allowMaximize: false,
        className: "app-titlebar--child",
      });
  root.innerHTML = `
    <div class="app-child-window-frame app-child-window-frame--dialog database-repair-frame">
      ${titlebar}
      <main class="close-confirm-card database-repair-card">
        <header class="close-confirm-card__head">
          <h1 id="database-repair-title" class="close-confirm-card__title">修复数据库？</h1>
        </header>
        <div class="close-confirm-card__body database-repair-card__body">
          <p id="database-repair-desc" class="close-confirm-card__desc database-repair-card__desc">会清理本地缓存的云歌单副本，只保留本地歌单，并把当前歌单模式切回离线。之后再次切换到在线或混合模式时，会重新拉取云歌单。</p>
          <div id="database-repair-actions" class="close-confirm-card__actions">
            <button type="button" id="database-repair-cancel" class="close-confirm-choice">先不修复</button>
            <button type="button" id="database-repair-confirm" class="close-confirm-choice close-confirm-choice--danger">开始修复</button>
          </div>
          <div id="database-repair-loading" class="database-repair-card__loading" role="status" aria-live="polite" hidden>
            <span class="database-repair-card__spinner" aria-hidden="true"></span>
            <span id="database-repair-loading-text">正在整理数据库并清理本地云歌单…</span>
          </div>
        </div>
      </main>
    </div>
  `;
}

function setRepairLoading(loading) {
  const actions = document.getElementById("database-repair-actions");
  const loadingWrap = document.getElementById("database-repair-loading");
  const title = document.getElementById("database-repair-title");
  const desc = document.getElementById("database-repair-desc");
  if (actions) actions.hidden = !!loading;
  if (loadingWrap) loadingWrap.hidden = !loading;
  if (title) title.textContent = loading ? "正在修复数据库…" : "修复数据库？";
  if (desc) {
    desc.textContent = loading
      ? "请稍等，正在清理本地缓存的云歌单副本，并把当前歌单模式切回离线。"
      : "会清理本地缓存的云歌单副本，只保留本地歌单，并把当前歌单模式切回离线。之后再次切换到在线或混合模式时，会重新拉取云歌单。";
  }
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
    console.warn("get_settings for database repair", error);
  }
}

async function emitDialogEvent(payload) {
  if (replySent) return;
  replySent = true;
  await emitTo(MAIN_WW, "settings-database-repair-dialog", payload);
}

async function hideDatabaseRepairWindow() {
  try {
    await DesktopService.HideWindow(WINDOW_LABEL);
  } catch (error) {
    console.warn("hide database repair window", error);
    try {
      await currentWindow.Hide();
    } catch (innerError) {
      console.warn("runtime hide database repair window", innerError);
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

async function closeCancelled() {
  suppressCancelReply = true;
  await emitDialogEvent({ type: "cancelled" });
  await hideDatabaseRepairWindow();
  await focusMainWindow();
}

async function requestRepair() {
  activeRequestID = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  setRepairLoading(true);
  try {
    await emitDialogEvent({ type: "requested", requestId: activeRequestID });
  } catch (error) {
    console.warn("emit database repair request", error);
    replySent = false;
    activeRequestID = "";
    setRepairLoading(false);
  }
}

function wireDatabaseRepairWindow() {
  document.getElementById("database-repair-cancel")?.addEventListener("click", () => {
    void closeCancelled();
  });
  document.getElementById("database-repair-confirm")?.addEventListener("click", () => {
    void requestRepair();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || activeRequestID) return;
    event.preventDefault();
    void closeCancelled();
  });
  listen("settings-database-repair-finished", (event) => {
    if (event?.payload?.requestId !== activeRequestID) return;
    suppressCancelReply = true;
    void hideDatabaseRepairWindow().then(() => focusMainWindow());
  });
  window.addEventListener("beforeunload", () => {
    if (suppressCancelReply || activeRequestID) return;
    void emitDialogEvent({ type: "cancelled" });
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

export function bootstrapDatabaseRepairWindow() {
  document.addEventListener("DOMContentLoaded", () => {
    applyPlatformClassNames();
    renderDatabaseRepairWindow(document.getElementById("app"));
    if (!isWindowsDesktop()) {
      wireWindowChrome({ windowName: WINDOW_LABEL, allowMinimize: false, allowMaximize: false });
    }
    wireDatabaseRepairWindow();
    const autoSize = wireChildWindowAutoSize({
      element: document.querySelector(".app-child-window-frame--dialog"),
      windowLabel: WINDOW_LABEL,
      windowRef: currentWindow,
      minHeight: 208,
      minWidth: 448,
      paddingHeight: 28,
    });
    void applyThemeFromSettings();
    window.addEventListener("beforeunload", () => autoSize.cleanup());
  });
}
