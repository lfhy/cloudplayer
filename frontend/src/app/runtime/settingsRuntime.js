import { createImportFlowHelpers } from "../helpers/importFlow.js";
import { createSettingsController } from "../../features/settings/controller.js";

// Settings runtime owns preference UI bridging and import-step state transitions.
export function createSettingsRuntime(deps) {
  const {
    alertRequestFailed,
    applyAppTheme,
    applyMusicSourceProviderSelectionUi,
    applyNetworkProxyModeSelectionUi,
    applySettingsTabUi,
    applyThemeCardSelectionUi,
    applyThemeModeSelectionUi,
    audioEl,
    broadcastDesktopLyricsColors,
    broadcastDesktopLyricsLock,
    getDesktopLyricsOpen,
    getImportDraftDirty,
    getImportMethod,
    getImportTracks,
    getNeteaseCookieEnabled,
    getNeteaseCookieValue,
    invoke,
    normalizeAccentHex,
    normalizeAppTheme,
    normalizeAppThemeMode,
    normalizeCloseAction,
    normalizeMusicSourceProvider,
    normalizeNetworkProxyMode,
    normalizeNetworkProxyUrl,
    normalizeSettingsTab,
    openDesktopLyricsFromSettingsIfNeeded,
    queueQuickThemeRefresh,
    refreshLyricsLockMenuLabel,
    renderImportTable,
    setDesktopLyricsLocked,
    setImportDraftDirty,
    setImportMethodValue,
    setImportShareSuggestedName,
    setImportTracksValue,
    setLastLibraryFolder,
    setDesktopLyricsIdleText,
    setMainWindowCloseAction,
    setNeteaseCookieState,
    setPage,
    updateDownloadFolderHint,
    warnRequestFailed,
  } = deps;

  function setThemeCardSelection(theme) {
    const normalized = normalizeAppTheme(theme);
    const hidden = document.getElementById("setting-app-theme");
    if (hidden) hidden.value = normalized;
    applyThemeCardSelectionUi(normalized);
  }

  function setThemeModeSelection(mode) {
    const normalized = normalizeAppThemeMode(mode);
    const hidden = document.getElementById("setting-app-theme-mode");
    if (hidden) hidden.value = normalized;
    applyThemeModeSelectionUi(normalized);
    queueQuickThemeRefresh(normalized);
  }

  function setNetworkProxyModeSelection(mode) {
    const normalized = normalizeNetworkProxyMode(mode);
    const hidden = document.getElementById("setting-network-proxy-mode");
    const urlInput = document.getElementById("setting-network-proxy-url");
    if (hidden) hidden.value = normalized;
    if (urlInput) urlInput.disabled = normalized !== "custom";
    applyNetworkProxyModeSelectionUi(normalized);
  }

  function setMusicSourceProviderSelection(provider) {
    const normalized = normalizeMusicSourceProvider(provider);
    const hidden = document.getElementById("setting-music-source-provider");
    if (hidden) hidden.value = normalized;
    applyMusicSourceProviderSelectionUi(normalized);
  }

  function setSettingsTab(tab) {
    applySettingsTabUi(normalizeSettingsTab(tab));
  }

  const flow = createImportFlowHelpers({
    getImportMethod,
    setImportMethodValue,
    getImportTracks,
    setImportTracksValue,
    setImportShareSuggestedName,
    setImportDraftDirty,
    getImportDraftDirty,
    getNeteaseCookieEnabled,
    getNeteaseCookieValue,
    renderImportTable,
  });

  const settings = createSettingsController({
    alertRequestFailed,
    applyAppTheme,
    audioEl,
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
    setSettingsTab,
    setThemeCardSelection,
    setThemeModeSelection,
    setDesktopLyricsIdleText,
    updateDownloadFolderHint,
    warnRequestFailed,
    syncNeteaseCookieUi: () => flow.syncNeteaseCookieUi(),
    setDesktopLyricsLocked,
    getDesktopLyricsOpen,
    setLastLibraryFolder,
    setNeteaseCookieState,
    setImportDraft: flow.setImportDraft,
    setImportConfigHeader: flow.setImportConfigHeader,
    setImportMethod: flow.setImportMethod,
    setImportStep: flow.setImportStep,
  });

  return {
    getSettingsFormValues: settings.getSettingsFormValues,
    loadSettings: settings.loadSettings,
    openCloseConfirmModal: settings.openCloseConfirmModal,
    queueSettingsAutosave: settings.queueSettingsAutosave,
    refreshKugouSettingsStatus: settings.refreshKugouSettingsStatus,
    setMusicSourceProviderSelection,
    setNetworkProxyModeSelection,
    setSettingsTab,
    setThemeCardSelection,
    setThemeModeSelection,
    setImportDraft: flow.setImportDraft,
    setImportConfigHeader: flow.setImportConfigHeader,
    setImportMethod: flow.setImportMethod,
    setImportStep: flow.setImportStep,
    syncNeteaseCookieUi: flow.syncNeteaseCookieUi,
    wirePreferencesModals: settings.wirePreferencesModals,
    resetImportFlow: flow.resetImportFlow,
    setImportDraft: flow.setImportDraft,
    setImportConfigHeader: flow.setImportConfigHeader,
    setImportMethod: flow.setImportMethod,
    setImportStep: flow.setImportStep,
    showImportResultStage: flow.showImportResultStage,
  };
}
