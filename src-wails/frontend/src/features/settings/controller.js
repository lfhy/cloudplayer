// Settings controller owns form state, autosave, and modal wiring for preferences.
import { createHotkeyController } from "./hotkeys.js";
import { canSaveCustomProxyUrl } from "../../app/helpers/platformTheme.js";

export function createSettingsController(deps) {
  const {
    alertRequestFailed,
    applyAppTheme,
    broadcastDesktopLyricsColors,
    broadcastDesktopLyricsLock,
    invoke,
    normalizeAccentHex,
    normalizeAppTheme,
    normalizeAppThemeMode,
    normalizeCloseAction,
    normalizeNetworkProxyMode,
    normalizeNetworkProxyUrl,
    openDesktopLyricsFromSettingsIfNeeded,
    refreshLyricsLockMenuLabel,
    setMainWindowCloseAction,
    setNetworkProxyModeSelection,
    setPage,
    setThemeCardSelection,
    setThemeModeSelection,
    setSettingsTab,
    updateDownloadFolderHint,
    warnRequestFailed,
    audioEl,
    syncNeteaseCookieUi,
    setDesktopLyricsLocked,
    getDesktopLyricsOpen,
    setLastLibraryFolder,
    setNeteaseCookieState,
  } = deps;
  let settingsFormBaseline = { theme: "coral", mode: "system", customAccent: "#c62f2f", proxyMode: "direct", proxyURL: "", action: "ask", base: "#ffffff", highlight: "#ffb7d4", neteaseApiBase: "", hotkeysSig: "" };
  let settingsSaveTimer = null;
  let settingsSaveInFlight = false;
  let settingsSaveQueued = false;
  let suppressSettingsAutoSave = false;
  let queueSettingsAutosave = () => {};
  const hotkeys = createHotkeyController({ invoke, queueSettingsAutosave: (...args) => queueSettingsAutosave(...args), updateSettingsSaveButtonState: () => {}, warnRequestFailed });

  function normalizeLyricHexInput(value, fallback) {
    const normalized = (value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback;
  }

  function normalizeNeteaseApiBase(raw) {
    return String(raw ?? "").trim();
  }

  function getSettingsFormValues() {
    const current = {
      theme: normalizeAppTheme(document.getElementById("setting-app-theme")?.value),
      mode: normalizeAppThemeMode(document.getElementById("setting-app-theme-mode")?.value),
      customAccent: normalizeAccentHex(document.getElementById("setting-app-theme-custom-accent")?.value, "#c62f2f"),
      proxyMode: normalizeNetworkProxyMode(document.getElementById("setting-network-proxy-mode")?.value),
      proxyURL: normalizeNetworkProxyUrl(document.getElementById("setting-network-proxy-url")?.value),
      action: normalizeCloseAction(document.getElementById("setting-close-action")?.value),
      base: normalizeLyricHexInput(document.getElementById("setting-ly-base")?.value, "#ffffff"),
      highlight: normalizeLyricHexInput(document.getElementById("setting-ly-highlight")?.value, "#ffb7d4"),
      neteaseApiBase: normalizeNeteaseApiBase(document.getElementById("setting-netease-api-base")?.value),
      globalHotkeys: hotkeys.getGlobalHotkeysPayloadFromDom(),
    };
    return { ...current, hotkeysSig: JSON.stringify(current.globalHotkeys) };
  }

  function settingsFormIsDirty() {
    const current = getSettingsFormValues();
    return ["theme", "mode", "customAccent", "proxyMode", "proxyURL", "action", "base", "highlight", "neteaseApiBase", "hotkeysSig"].some((key) => current[key] !== settingsFormBaseline[key]);
  }

  function syncSettingsFormBaselineFromDom() {
    settingsFormBaseline = getSettingsFormValues();
  }

  function fillSettingsFormFromSettings(settings) {
    const theme = normalizeAppTheme(settings?.app_theme ?? settings?.appTheme ?? "coral");
    const mode = normalizeAppThemeMode(settings?.app_theme_mode ?? settings?.appThemeMode ?? "system");
    const customAccent = normalizeAccentHex(settings?.app_theme_custom_accent ?? settings?.appThemeCustomAccent ?? "#c62f2f", "#c62f2f");
    const proxyMode = normalizeNetworkProxyMode(settings?.network_proxy_mode ?? settings?.networkProxyMode ?? "direct");
    const proxyURL = normalizeNetworkProxyUrl(settings?.network_proxy_url ?? settings?.networkProxyUrl ?? "");
    const customAccentEl = document.getElementById("setting-app-theme-custom-accent");
    const customAccentCodeEl = document.getElementById("setting-app-theme-custom-accent-code");
    const proxyUrlEl = document.getElementById("setting-network-proxy-url");
    if (customAccentEl) customAccentEl.value = customAccent;
    if (customAccentCodeEl) customAccentCodeEl.textContent = customAccent;
    if (proxyUrlEl) proxyUrlEl.value = proxyURL;
    setThemeModeSelection(mode);
    setThemeCardSelection(theme);
    setNetworkProxyModeSelection(proxyMode);
    applyAppTheme(theme, customAccent, mode);
    const closeAction = normalizeCloseAction(settings?.main_window_close_action ?? settings?.mainWindowCloseAction);
    const closeActionEl = document.getElementById("setting-close-action");
    if (closeActionEl) closeActionEl.value = closeAction;
    const baseEl = document.getElementById("setting-ly-base");
    const highlightEl = document.getElementById("setting-ly-highlight");
    if (baseEl) baseEl.value = normalizeLyricHexInput(settings?.desktop_lyrics_color_base ?? settings?.desktopLyricsColorBase, "#ffffff");
    if (highlightEl) highlightEl.value = normalizeLyricHexInput(settings?.desktop_lyrics_color_highlight ?? settings?.desktopLyricsColorHighlight, "#ffb7d4");
    const neteaseApiBaseEl = document.getElementById("setting-netease-api-base");
    if (neteaseApiBaseEl) neteaseApiBaseEl.value = normalizeNeteaseApiBase(settings?.lyrics_netease_api_base ?? settings?.lyricsNeteaseApiBase ?? "");
    hotkeys.fillHotkeysFormFromSettings(settings);
    syncSettingsFormBaselineFromDom();
  }

  async function persistSettingsFromForm() {
    if (settingsSaveInFlight) {
      settingsSaveQueued = true;
      return;
    }
    if (!settingsFormIsDirty()) return;
    settingsSaveInFlight = true;
    const current = getSettingsFormValues();
    try {
      let proxyURLForSave = current.proxyURL;
      const customProxyReady = canSaveCustomProxyUrl(current.proxyURL);
      if (current.proxyMode === "custom" && !customProxyReady) return;
      if (current.proxyMode !== "custom" && !customProxyReady) {
        proxyURLForSave = "";
        const proxyUrlEl = document.getElementById("setting-network-proxy-url");
        if (proxyUrlEl) proxyUrlEl.value = "";
      }
      if (current.hotkeysSig !== settingsFormBaseline.hotkeysSig) {
        const seen = new Map();
        for (const [fieldKey, accel] of Object.entries(current.globalHotkeys)) {
          if (fieldKey === "enabled") continue;
          const normalized = String(accel || "").trim();
          if (!normalized) continue;
          if (seen.has(normalized)) {
            hotkeys.renderHotkeyStatusOk();
            const duplicateField = seen.get(normalized);
            const hint = `与「${hotkeys.hotkeyFieldLabel(duplicateField)}」重复`;
            hotkeys.hotkeyStatusSetConflict(fieldKey, hint);
            hotkeys.hotkeyStatusSetConflict(duplicateField, hint);
            return;
          }
          seen.set(normalized, fieldKey);
        }
        const report = await invoke("apply_global_hotkeys", { cfg: current.globalHotkeys });
        if (report) hotkeys.renderHotkeyStatusFromReport(report);
      }
      await invoke("save_settings", { patch: { app_theme: current.theme, app_theme_mode: current.mode, app_theme_custom_accent: current.customAccent, network_proxy_mode: current.proxyMode, network_proxy_url: proxyURLForSave, main_window_close_action: current.action, desktop_lyrics_color_base: current.base, desktop_lyrics_color_highlight: current.highlight, lyrics_netease_api_base: current.neteaseApiBase } });
      applyAppTheme(current.theme, current.customAccent, current.mode);
      setMainWindowCloseAction(current.action);
      syncSettingsFormBaselineFromDom();
      void broadcastDesktopLyricsColors();
    } catch (error) {
      alertRequestFailed(error, "save settings");
    } finally {
      settingsSaveInFlight = false;
      if (settingsSaveQueued) {
        settingsSaveQueued = false;
        queueSettingsAutosave(true);
      }
    }
  }

  queueSettingsAutosave = (immediate = false) => {
    if (suppressSettingsAutoSave) return;
    if (settingsSaveTimer != null) clearTimeout(settingsSaveTimer);
    settingsSaveTimer = immediate ? null : setTimeout(() => { settingsSaveTimer = null; void persistSettingsFromForm(); }, 260);
    if (immediate) void persistSettingsFromForm();
  };

  function openCloseConfirmModal() {
    const rememberEl = document.getElementById("close-choice-remember");
    if (rememberEl) rememberEl.checked = false;
    const modalEl = document.getElementById("close-confirm-modal");
    if (!modalEl) return;
    modalEl.hidden = false;
    modalEl.setAttribute("aria-hidden", "false");
  }

  function closeCloseConfirmModal() {
    const modalEl = document.getElementById("close-confirm-modal");
    if (!modalEl) return;
    modalEl.hidden = true;
    modalEl.setAttribute("aria-hidden", "true");
  }

  async function runCloseChoice(mode) {
    const remember = !!document.getElementById("close-choice-remember")?.checked;
    closeCloseConfirmModal();
    if (remember) {
      const patch = { main_window_close_action: mode === "tray" ? "tray" : "quit" };
      try {
        await invoke("save_settings", { patch });
        setMainWindowCloseAction(patch.main_window_close_action);
      } catch (error) {
        console.warn("save_settings main_window_close_action", error);
      }
    }
    try {
      if (mode === "tray") await invoke("hide_main_window");
      else await invoke("quit_app");
    } catch (error) {
      alertRequestFailed(error, "close flow");
    }
  }

  function wirePreferencesModals() {
    document.getElementById("btn-dock-settings")?.addEventListener("click", () => setPage("settings"));
    document.querySelectorAll("[data-settings-tab]").forEach((button) => button.addEventListener("click", () => setSettingsTab(button.getAttribute("data-settings-tab") || "appearance")));
    setSettingsTab("appearance");
    [["setting-app-theme-mode", "change", true], ["setting-app-theme", "change", true], ["setting-app-theme-custom-accent", "input", false], ["setting-network-proxy-url", "input", false], ["setting-close-action", "change", true], ["setting-ly-base", "input", false], ["setting-ly-highlight", "input", false], ["setting-netease-api-base", "input", false], ["setting-hotkeys-enabled", "change", true]].forEach(([id, eventName, immediate]) => {
      document.getElementById(id)?.addEventListener(eventName, () => queueSettingsAutosave(immediate));
    });
    document.querySelectorAll("[data-theme-mode-card]").forEach((card) => card.addEventListener("click", () => {
      setThemeModeSelection(card.getAttribute("data-theme-mode-card") || "system");
      const current = getSettingsFormValues();
      applyAppTheme(current.theme, current.customAccent, current.mode);
      queueSettingsAutosave(true);
    }));
    document.querySelectorAll("[data-theme-card]").forEach((card) => card.addEventListener("click", () => {
      setThemeCardSelection(card.getAttribute("data-theme-card") || "coral");
      const current = getSettingsFormValues();
      const codeEl = document.getElementById("setting-app-theme-custom-accent-code");
      if (codeEl) codeEl.textContent = current.customAccent;
      applyAppTheme(current.theme, current.customAccent, current.mode);
      queueSettingsAutosave(true);
    }));
    document.getElementById("setting-app-theme-custom-accent")?.addEventListener("input", (event) => {
      const input = event.currentTarget;
      const value = normalizeAccentHex(input?.value, "#c62f2f");
      const codeEl = document.getElementById("setting-app-theme-custom-accent-code");
      if (input) input.value = value;
      if (codeEl) codeEl.textContent = value;
      if (normalizeAppTheme(document.getElementById("setting-app-theme")?.value) === "custom") {
        applyAppTheme("custom", value, getSettingsFormValues().mode);
      }
      queueSettingsAutosave();
    });
    document.querySelectorAll("[data-network-proxy-mode-card]").forEach((card) => card.addEventListener("click", () => {
      setNetworkProxyModeSelection(card.getAttribute("data-network-proxy-mode-card") || "direct");
      queueSettingsAutosave(true);
    }));
    hotkeys.wireHotkeySettingsUi();
    document.getElementById("close-choice-tray")?.addEventListener("click", () => void runCloseChoice("tray"));
    document.getElementById("close-choice-quit")?.addEventListener("click", () => void runCloseChoice("quit"));
    document.getElementById("close-choice-cancel")?.addEventListener("click", () => closeCloseConfirmModal());
    document.getElementById("close-confirm-modal")?.addEventListener("click", (event) => {
      if (event.target?.id === "close-confirm-modal") closeCloseConfirmModal();
    });
  }

  async function loadSettings() {
    try {
      const settings = await invoke("get_settings");
      applyAppTheme(settings?.app_theme ?? settings?.appTheme ?? "coral", settings?.app_theme_custom_accent ?? settings?.appThemeCustomAccent ?? "#c62f2f", settings?.app_theme_mode ?? settings?.appThemeMode ?? "system");
      setMainWindowCloseAction(normalizeCloseAction(settings?.main_window_close_action ?? settings?.mainWindowCloseAction));
      fillSettingsFormFromSettings(settings);
      const volume = typeof settings?.volume === "number" ? settings.volume : null;
      const volEl = document.getElementById("volume");
      if (volEl && volume != null) volEl.value = String(Math.round(volume * 100));
      const audio = audioEl();
      if (audio && volume != null) audio.volume = volume;
      if (typeof settings?.desktop_lyrics_locked === "boolean") setDesktopLyricsLocked(settings.desktop_lyrics_locked);
      refreshLyricsLockMenuLabel();
      if (typeof settings?.last_library_folder === "string") setLastLibraryFolder(settings.last_library_folder.trim());
      const downloadFolder = settings?.download_folder || settings?.downloadFolder || "";
      updateDownloadFolderHint(typeof downloadFolder === "string" ? downloadFolder.trim() : "");
      setNeteaseCookieState({ enabled: !!settings?.share_netease_cookie_enabled, value: settings?.share_netease_cookie || "" });
      syncNeteaseCookieUi();
      if (getDesktopLyricsOpen()) {
        void broadcastDesktopLyricsLock();
        void broadcastDesktopLyricsColors();
      }
      if (settings?.desktop_lyrics_visible) queueMicrotask(() => void openDesktopLyricsFromSettingsIfNeeded(settings));
    } catch (error) {
      console.warn("get_settings", error);
    }
    try {
      console.info(await invoke("db_status"));
    } catch (error) {
      console.warn("db_status", error);
    }
  }

  return { getSettingsFormValues, loadSettings, openCloseConfirmModal, queueSettingsAutosave, wirePreferencesModals };
}
