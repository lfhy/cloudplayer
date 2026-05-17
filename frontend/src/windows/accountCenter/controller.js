// Account-center child window keeps login flows out of the main webview while reusing the same content modules.
import { Events, Window as RuntimeWindow } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { alertRequestFailed } from "../../app/helpers/errors.js";
import { applyAppTheme, applyPlatformClassNames, isWindowsDesktop, systemDarkMedia } from "../../app/helpers/platformTheme.js";
import { escapeHtml } from "../../app/helpers/text.js";
import { createAccountCenterView } from "../../features/accounts/windowView.js";
import { accountCenterWindowTemplate } from "../../features/accounts/windowTemplate.js";
import { wireWindowChrome } from "../../features/window/chrome.js";
import { wireChildWindowAutoSize } from "../shared/autoSize.js";
import { emitTo } from "../../wails/tauri-event.js";
import { invoke } from "../../wails/tauri-core.js";

const WINDOW_LABEL = "account-center";
const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const currentWindow = RuntimeWindow.Get(WINDOW_LABEL);

function requestedProvider() {
  const provider = new URLSearchParams(globalThis.location?.search || "").get("provider");
  return provider === "netease" ? "netease" : "kugou";
}

function renderAccountCenterWindow(root) {
  root.innerHTML = accountCenterWindowTemplate();
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
    console.warn("get_settings for account center", error);
  }
}

async function hideAccountCenterWindow() {
  try {
    await DesktopService.HideWindow(WINDOW_LABEL);
  } catch (error) {
    console.warn("hide account center window", error);
    try {
      await currentWindow.Hide();
    } catch (innerError) {
      console.warn("runtime hide account center window", innerError);
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

async function closeAccountCenterWindow() {
  await hideAccountCenterWindow();
  await focusMainWindow();
}

async function notifyAccountStatus(status) {
  await emitTo(MAIN_WW, "account-center-status-changed", { provider: "kugou", status });
}

async function notifyKugouSessionMutation(payload) {
  await emitTo(MAIN_WW, "account-center-kugou-session-mutated", payload || { action: "unknown" });
}

async function openImportFlow(provider) {
  await emitTo(MAIN_WW, "account-center-open-import", { provider });
  await closeAccountCenterWindow();
}

async function toggleOnlineMode(nextMode) {
  await emitTo(MAIN_WW, "account-center-toggle-online-mode", { nextMode: String(nextMode || "offline") });
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("toggle online mode timeout"));
    }, 20000);
    Events.Once("account-center-toggle-online-mode-result", (event) => {
      window.clearTimeout(timeout);
      const payload = event?.data?.payload || event?.data || {};
      if (payload?.ok === false) {
        reject(new Error(payload?.message || "toggle online mode failed"));
        return;
      }
      resolve({ mode: payload?.mode || "offline" });
    });
  });
}

function cardEl() {
  return document.querySelector(".app-child-window-frame--account");
}

function wireThemeRefresh() {
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

export function bootstrapAccountCenterWindow() {
  document.addEventListener("DOMContentLoaded", () => {
    applyPlatformClassNames();
    renderAccountCenterWindow(document.getElementById("app"));
    if (!isWindowsDesktop()) {
      wireWindowChrome({ windowName: WINDOW_LABEL, allowMinimize: false, allowMaximize: false });
    }
    const autoSize = wireChildWindowAutoSize({
      element: cardEl(),
      windowLabel: WINDOW_LABEL,
      windowRef: currentWindow,
      // Keep a compact baseline so the window can shrink after login hides the SMS / QR form.
      minHeight: 280,
      minWidth: 560,
      paddingHeight: 24,
      paddingWidth: 24,
    });
    autoSize.scheduleResize();
    const view = createAccountCenterView({
      alertRequestFailed,
      closeAccountCenter: closeAccountCenterWindow,
      escapeHtml,
      invoke,
      onImportRequested: openImportFlow,
      onKugouAuthChanged: (payload) => {
        void notifyKugouSessionMutation(payload);
      },
      onOnlineModeToggleRequested: toggleOnlineMode,
      onKugouStatusChanged: (status) => {
        void notifyAccountStatus(status);
      },
      onLayoutSettled: () => {
        autoSize.scheduleDebouncedResize(90);
      },
    });
    view.wireAccountCenter();
    view.openAccountCenter(requestedProvider());
    wireThemeRefresh();
    void applyThemeFromSettings();
    window.addEventListener("beforeunload", () => {
      autoSize.cleanup();
      void focusMainWindow();
    });
  });
}
