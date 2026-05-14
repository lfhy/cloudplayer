// Settings controller owns form state, autosave, and modal wiring for preferences.
import { createHotkeyController } from "./hotkeys.js";
import { closeCloseConfirmModalDom, openCloseConfirmModalDom, runCloseChoiceFlow } from "./closeFlow.js";
import { wireSettingsActionButtons } from "./actions.js";
import { createExternalOnlineModeToggle } from "./externalOnlineMode.js";
import { DEFAULT_LYRICS_IDLE_LINE1, DEFAULT_LYRICS_IDLE_LINE2, normalizeLyricHexInput, normalizeLyricsIdleLine, normalizeNeteaseApiBase, normalizePlaybackFallbackChain, normalizeSearchCacheTTLHours, settingsFormBaselineDefaults } from "./formHelpers.js";
import { createFallbackChainEditor } from "./fallbackChainEditor.js";
import { applyLyricsSourceSelectionToDom, readLyricsSourceSettingsFromDom, wireLyricsSourceSelection } from "./lyricSources.js";
import { createKugouSettingsStatusRefresher, isMusicSourceOnlineModeSelected, musicOnlineModeStatusText, setMusicSourceOnlineModeAvailability, setMusicSourceOnlineModeBusy, setMusicSourceOnlineModeSelection, toggleMusicOnlineMode, wireMusicSourceOnlineModeSelection } from "./sourceMode.js";
import { renderLyricsPreview } from "./lyricsPreview.js";
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
    normalizeMusicSourceProvider,
    normalizeNetworkProxyMode,
    normalizeNetworkProxyUrl,
    openDesktopLyricsFromSettingsIfNeeded,
    refreshLyricsLockMenuLabel,
    setMainWindowCloseAction,
    setMusicSourceProviderSelection,
    setNetworkProxyModeSelection,
    setPage,
    setThemeCardSelection,
    setThemeModeSelection,
    setSettingsTab,
    updateDownloadFolderHint,
    warnRequestFailed,
    audioEl,
    setPreferredPlaybackVolume,
    syncNeteaseCookieUi,
    setDesktopLyricsLocked,
    getDesktopLyricsOpen,
    setLastLibraryFolder,
    setNeteaseCookieState,
    setImportDraft,
    setImportMethod,
    setImportStep,
    setMusicOnlineModeEnabledValue,
    openAccountCenter,
    onKugouAuthChanged,
    onMusicOnlineModeChanged,
    onMusicSourceProviderChanged,
  } = deps;
  let settingsFormBaseline = settingsFormBaselineDefaults();
  let settingsSaveTimer = null;
  let settingsSaveInFlight = false;
  let settingsSaveQueued = false;
  let suppressSettingsAutoSave = false;
  let refreshKugouSettingsStatus = () => {};
  let queueSettingsAutosave = () => {};
  const fallbackChainEditor = createFallbackChainEditor({ onChange: () => queueSettingsAutosave(true) });
  const hotkeys = createHotkeyController({ invoke, queueSettingsAutosave: (...args) => queueSettingsAutosave(...args), updateSettingsSaveButtonState: () => {}, warnRequestFailed });

  function getSettingsFormValues() {
    const current = {
      theme: normalizeAppTheme(document.getElementById("setting-app-theme")?.value),
      mode: normalizeAppThemeMode(document.getElementById("setting-app-theme-mode")?.value),
      customAccent: normalizeAccentHex(document.getElementById("setting-app-theme-custom-accent")?.value, "#c62f2f"),
      proxyMode: normalizeNetworkProxyMode(document.getElementById("setting-network-proxy-mode")?.value),
      proxyURL: normalizeNetworkProxyUrl(document.getElementById("setting-network-proxy-url")?.value),
      action: normalizeCloseAction(document.getElementById("setting-close-action")?.value),
      musicSourceProvider: normalizeMusicSourceProvider(document.getElementById("setting-music-source-provider")?.value),
      musicOnlineMode: isMusicSourceOnlineModeSelected(),
      autoCacheOnPlay: document.getElementById("setting-auto-cache-on-play")?.checked === true,
      playbackFallbackChain: normalizePlaybackFallbackChain(document.getElementById("setting-playback-fallback-chain")?.value),
      searchCacheTTLHours: normalizeSearchCacheTTLHours(document.getElementById("setting-search-cache-ttl-hours")?.value),
      idleLine1: normalizeLyricsIdleLine(document.getElementById("setting-ly-idle-line1")?.value, DEFAULT_LYRICS_IDLE_LINE1),
      idleLine2: normalizeLyricsIdleLine(document.getElementById("setting-ly-idle-line2")?.value, DEFAULT_LYRICS_IDLE_LINE2),
      ...readLyricsSourceSettingsFromDom(),
      base: normalizeLyricHexInput(document.getElementById("setting-ly-base")?.value, "#ffffff"),
      highlight: normalizeLyricHexInput(document.getElementById("setting-ly-highlight")?.value, "#ffb7d4"),
      neteaseApiBase: normalizeNeteaseApiBase(document.getElementById("setting-netease-api-base")?.value),
      globalHotkeys: hotkeys.getGlobalHotkeysPayloadFromDom(),
    };
    return { ...current, hotkeysSig: JSON.stringify(current.globalHotkeys) };
  }

  function settingsFormIsDirty() {
    const current = getSettingsFormValues();
    return ["theme", "mode", "customAccent", "proxyMode", "proxyURL", "action", "musicSourceProvider", "musicOnlineMode", "autoCacheOnPlay", "playbackFallbackChain", "searchCacheTTLHours", "idleLine1", "idleLine2", "lyricsProviderOrder", "lyricsLRCLibEnabled", "base", "highlight", "neteaseApiBase", "hotkeysSig"].some((key) => current[key] !== settingsFormBaseline[key]);
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
    const searchCacheTTLEl = document.getElementById("setting-search-cache-ttl-hours");
    const autoCacheOnPlayEl = document.getElementById("setting-auto-cache-on-play");
    const playbackFallbackChainEl = document.getElementById("setting-playback-fallback-chain");
    if (customAccentEl) customAccentEl.value = customAccent;
    if (customAccentCodeEl) customAccentCodeEl.textContent = customAccent;
    if (proxyUrlEl) proxyUrlEl.value = proxyURL;
    if (searchCacheTTLEl) searchCacheTTLEl.value = String(normalizeSearchCacheTTLHours(settings?.search_cache_ttl_hours ?? settings?.searchCacheTTLHours ?? 24));
    if (autoCacheOnPlayEl) autoCacheOnPlayEl.checked = settings?.auto_cache_on_play === true || settings?.autoCacheOnPlay === true;
    if (playbackFallbackChainEl) playbackFallbackChainEl.value = normalizePlaybackFallbackChain(settings?.playback_fallback_chain ?? settings?.playbackFallbackChain ?? "kugou,pjmp3,netease");
    fallbackChainEditor.setValue(playbackFallbackChainEl?.value || "kugou,pjmp3,netease");
    setThemeModeSelection(mode);
    setThemeCardSelection(theme);
    setNetworkProxyModeSelection(proxyMode);
    setMusicSourceProviderSelection(settings?.music_source_provider ?? settings?.musicSourceProvider ?? "kugou");
    setMusicSourceOnlineModeSelection(settings?.music_online_mode ?? settings?.musicOnlineMode ?? false);
    setMusicSourceOnlineModeBusy(false, musicOnlineModeStatusText(settings?.music_online_mode ?? settings?.musicOnlineMode ?? false));
    applyAppTheme(theme, customAccent, mode);
    const closeAction = normalizeCloseAction(settings?.main_window_close_action ?? settings?.mainWindowCloseAction);
    const closeActionEl = document.getElementById("setting-close-action");
    if (closeActionEl) closeActionEl.value = closeAction;
    const baseEl = document.getElementById("setting-ly-base");
    const highlightEl = document.getElementById("setting-ly-highlight");
    const idleLine1El = document.getElementById("setting-ly-idle-line1");
    const idleLine2El = document.getElementById("setting-ly-idle-line2");
    const searchCacheStatusEl = document.getElementById("setting-search-cache-status");
    if (baseEl) baseEl.value = normalizeLyricHexInput(settings?.desktop_lyrics_color_base ?? settings?.desktopLyricsColorBase, "#ffffff");
    if (highlightEl) highlightEl.value = normalizeLyricHexInput(settings?.desktop_lyrics_color_highlight ?? settings?.desktopLyricsColorHighlight, "#ffb7d4");
    const idleLine1 = normalizeLyricsIdleLine(settings?.desktop_lyrics_idle_line1 ?? settings?.desktopLyricsIdleLine1, DEFAULT_LYRICS_IDLE_LINE1);
    const idleLine2 = normalizeLyricsIdleLine(settings?.desktop_lyrics_idle_line2 ?? settings?.desktopLyricsIdleLine2, DEFAULT_LYRICS_IDLE_LINE2);
    if (idleLine1El) idleLine1El.value = idleLine1;
    if (idleLine2El) idleLine2El.value = idleLine2;
    deps.setDesktopLyricsIdleText?.(idleLine1, idleLine2);
    const neteaseApiBaseEl = document.getElementById("setting-netease-api-base");
    if (neteaseApiBaseEl) neteaseApiBaseEl.value = normalizeNeteaseApiBase(settings?.lyrics_netease_api_base ?? settings?.lyricsNeteaseApiBase ?? "");
    applyLyricsSourceSelectionToDom(settings?.lyrics_provider_order ?? settings?.lyricsProviderOrder ?? "qq,kugou,netease,lrclib", settings?.lyrics_lrclib_enabled !== false);
    if (searchCacheStatusEl) searchCacheStatusEl.textContent = `搜索结果按关键词、分页和当前曲库渠道缓存，当前保留 ${normalizeSearchCacheTTLHours(settings?.search_cache_ttl_hours ?? settings?.searchCacheTTLHours ?? 24)} 小时。`;
    hotkeys.fillHotkeysFormFromSettings(settings);
    renderLyricsPreview({ ...getSettingsFormValues(), idleLine1, idleLine2 });
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
      const providerChanged = current.musicSourceProvider !== settingsFormBaseline.musicSourceProvider;
      await invoke("save_settings", { patch: { app_theme: current.theme, app_theme_mode: current.mode, app_theme_custom_accent: current.customAccent, network_proxy_mode: current.proxyMode, network_proxy_url: proxyURLForSave, main_window_close_action: current.action, music_online_mode: current.musicOnlineMode, auto_cache_on_play: current.autoCacheOnPlay, music_source_provider: current.musicSourceProvider, playback_fallback_chain: current.playbackFallbackChain, search_cache_ttl_hours: current.searchCacheTTLHours, desktop_lyrics_idle_line1: current.idleLine1, desktop_lyrics_idle_line2: current.idleLine2, desktop_lyrics_color_base: current.base, desktop_lyrics_color_highlight: current.highlight, lyrics_provider_order: current.lyricsProviderOrder, lyrics_lrclib_enabled: current.lyricsLRCLibEnabled, lyrics_netease_api_base: current.neteaseApiBase } });
      if (providerChanged) await onMusicSourceProviderChanged?.(current.musicSourceProvider);
      applyAppTheme(current.theme, current.customAccent, current.mode);
      setMainWindowCloseAction(current.action);
      syncSettingsFormBaselineFromDom();
      const searchCacheStatusEl = document.getElementById("setting-search-cache-status");
      if (searchCacheStatusEl) searchCacheStatusEl.textContent = `搜索结果按关键词、分页和当前曲库渠道缓存，当前保留 ${current.searchCacheTTLHours} 小时。`;
      deps.setDesktopLyricsIdleText?.(current.idleLine1, current.idleLine2);
      renderLyricsPreview(current);
      void broadcastDesktopLyricsColors();
    } catch (error) {
      alertRequestFailed(error, "save settings");
      throw error;
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

  function openCloseConfirmModal() { openCloseConfirmModalDom(); }
  function closeCloseConfirmModal() { closeCloseConfirmModalDom(); }
  const toggleMusicOnlineModeFromAccountCenter = createExternalOnlineModeToggle({ alertRequestFailed, onMusicOnlineModeChanged, persistSettingsFromForm: (...args) => persistSettingsFromForm(...args), setMusicOnlineModeEnabledValue });

  function wirePreferencesModals() {
    globalThis.__cloudplayerOpenCloseConfirmModal = openCloseConfirmModal;
    globalThis.__cloudplayerCloseCloseConfirmModal = closeCloseConfirmModal;
    document.querySelectorAll("[data-settings-tab]").forEach((button) => button.addEventListener("click", () => setSettingsTab(button.getAttribute("data-settings-tab") || "appearance")));
    setSettingsTab("appearance");
    [["setting-app-theme-mode", "change", true], ["setting-app-theme", "change", true], ["setting-app-theme-custom-accent", "input", false], ["setting-network-proxy-url", "input", false], ["setting-close-action", "change", true], ["setting-auto-cache-on-play", "change", true], ["setting-playback-fallback-chain", "change", true], ["setting-search-cache-ttl-hours", "change", true], ["setting-ly-idle-line1", "input", false], ["setting-ly-idle-line2", "input", false], ["setting-ly-base", "input", false], ["setting-ly-highlight", "input", false], ["setting-netease-api-base", "input", false], ["setting-hotkeys-enabled", "change", true]].forEach(([id, eventName, immediate]) => {
      document.getElementById(id)?.addEventListener(eventName, () => {
        renderLyricsPreview(getSettingsFormValues());
        queueSettingsAutosave(immediate);
      });
    });
    const actionButtons = wireSettingsActionButtons({ alertRequestFailed, invoke, onKugouAuthChanged, openAccountCenter, setImportDraft, setImportMethod, setImportStep, setPage });
    refreshKugouSettingsStatus = createKugouSettingsStatusRefresher({ actionButtons, isMusicSourceOnlineModeSelected, queueSettingsAutosave, setMusicSourceOnlineModeAvailability, setMusicSourceOnlineModeSelection });
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
    document.querySelectorAll("[data-music-source-provider-card]").forEach((card) => card.addEventListener("click", () => {
      setMusicSourceProviderSelection(card.getAttribute("data-music-source-provider-card") || "kugou");
      queueSettingsAutosave(true);
    }));
    wireMusicSourceOnlineModeSelection((nextEnabled) => toggleMusicOnlineMode(nextEnabled, {
      alertRequestFailed,
      onMusicOnlineModeChanged,
      persistSettingsFromForm,
    }));
    fallbackChainEditor.render();
    document.getElementById("btn-open-app-log-location")?.addEventListener("click", async () => {
      try {
        await invoke("open_app_log_location");
      } catch (error) {
        try {
          const path = await invoke("get_app_log_path");
          warnRequestFailed(`无法打开日志位置：${path || "日志路径不可用"}`);
        } catch {
          alertRequestFailed(error, "open app log location");
        }
      }
    });
    wireLyricsSourceSelection(() => queueSettingsAutosave(true));
    hotkeys.wireHotkeySettingsUi();
    document.getElementById("close-choice-tray")?.addEventListener("click", () => void runCloseChoiceFlow("tray", { alertRequestFailed, invoke, setMainWindowCloseAction }));
    document.getElementById("close-choice-quit")?.addEventListener("click", () => void runCloseChoiceFlow("quit", { alertRequestFailed, invoke, setMainWindowCloseAction }));
    document.getElementById("close-choice-cancel")?.addEventListener("click", () => closeCloseConfirmModal());
    document.getElementById("close-confirm-modal")?.addEventListener("click", (event) => { if (event.target?.id === "close-confirm-modal") closeCloseConfirmModal(); });
  }

  async function loadSettings() {
    try {
      const settings = await invoke("get_settings");
      setMusicOnlineModeEnabledValue?.(settings?.music_online_mode ?? settings?.musicOnlineMode ?? false);
      applyAppTheme(settings?.app_theme ?? settings?.appTheme ?? "coral", settings?.app_theme_custom_accent ?? settings?.appThemeCustomAccent ?? "#c62f2f", settings?.app_theme_mode ?? settings?.appThemeMode ?? "system");
      setMainWindowCloseAction(normalizeCloseAction(settings?.main_window_close_action ?? settings?.mainWindowCloseAction));
      fillSettingsFormFromSettings(settings);
      const volume = typeof settings?.volume === "number" ? settings.volume : null;
      const volEl = document.getElementById("volume");
      if (volEl && volume != null) volEl.value = String(Math.round(volume * 100));
      if (volume != null) setPreferredPlaybackVolume?.(volume);
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
      renderLyricsPreview(getSettingsFormValues());
      void refreshKugouSettingsStatus();
    } catch (error) {
      console.warn("get_settings", error);
    }
    try { console.info(await invoke("db_status")); } catch (error) { console.warn("db_status", error); }
  }

  return { getSettingsFormValues, loadSettings, openCloseConfirmModal, queueSettingsAutosave, refreshKugouSettingsStatus, toggleMusicOnlineModeFromAccountCenter, wirePreferencesModals };
}
