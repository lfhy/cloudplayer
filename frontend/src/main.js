import { convertFileSrc, invoke } from "./wails/tauri-core.js";
import { open } from "./wails/tauri-plugin-dialog.js";
import { emitTo, listen } from "./wails/tauri-event.js";
import { WebviewWindow } from "./wails/tauri-webviewWindow.js";
import { LYRICS_REPLACE_TARGET, NAV, PLAY_MODES, QUALITY_LABELS, QUICK_THEME_MODE_LABELS, RECENT_SESSION_MAX, SIDEBAR_MENU_NAV, TRAY_PLAYER_TARGET } from "./app/constants.js";
import { MSG_REQUEST_FAILED, alertRequestFailed, warnRequestFailed } from "./app/helpers/errors.js";
import { appLogoMarkSvg, dockLyricsLockIcon, iconSvgByName, importBackButtonIconSvg, importMethodIconSvg, navIconSvg } from "./app/helpers/icons.js";
import { loadLikedSet, saveLikedSet } from "./app/helpers/likedSet.js";
import { audioDiagPayload, createPlayEventLogger } from "./app/helpers/playerDiagnostics.js";
import { escapeHtml, setTableMutedMessage } from "./app/helpers/text.js";
import { formatDurationMs, formatTime } from "./app/helpers/time.js";
import { applyAppTheme, applyPlatformClassNames, normalizeAccentHex, normalizeAppTheme, normalizeAppThemeMode, normalizeCloseAction, normalizeMusicCollectionMode, normalizeMusicSourceProvider, normalizeNetworkProxyMode, normalizeNetworkProxyUrl, normalizeSettingsTab, setMusicSourceProviderSelection as applyMusicSourceProviderSelectionUi, setNetworkProxyModeSelection as applyNetworkProxyModeSelectionUi, setSettingsTab as applySettingsTabUi, setThemeCardSelection as applyThemeCardSelectionUi, setThemeModeSelection as applyThemeModeSelectionUi, systemDarkMedia } from "./app/helpers/platformTheme.js";
import { createAccountCenterController } from "./features/accounts/controller.js";
import { createBasePlayerRuntime } from "./app/runtime/basePlayerRuntime.js";
import { createDockRuntime } from "./app/runtime/dockRuntime.js";
import { createPageRuntime } from "./app/runtime/pageRuntime.js";
import { createSettingsRuntime } from "./app/runtime/settingsRuntime.js";
import { startDesktopRuntime } from "./app/runtime/startupRuntime.js";
import { renderMainShell } from "./layout/renderMainShell.js";
import { createPlaybackStatePersistence } from "./features/player/playbackStatePersistence.js";
import { createImmersiveController } from "./features/player/immersiveController.js";
import { createMiniModeController } from "./features/player/miniModeController.js";
import { wireChildWindowMask } from "./features/window/childWindowMask.js";

// Composition root: only shared mutable state and runtime assembly stay here.
const searchState = { keyword: "", page: 1, hasNext: false, results: [], scope: "catalog", busy: false, playlistResults: [], view: "home" };
let playQueue = [], playIndex = 0, seekDragging = false, playLoadGeneration = 0, audioSourceGeneration = 0, audioProgressLogLastTs = 0;
let playModeIndex = 0, qualityPref = "128", importTracks = [], desktopLyricsOpen = false, desktopLyricsWindow = null, desktopLyricsLocked = true;
let mainWindowCloseAction = "ask", selectedPlaylistId = null, selectedPlaylistName = "", playlistDetailRows = [], importShareSuggestedName = "";
let neteaseCookieEnabled = false, neteaseCookieValue = "", importMethod = "", importDraftDirty = false, sessionRecentPlays = [], localLibraryRows = [], lastLibraryFolder = "";
let musicCollectionMode = "offline";
const downloadTasksBySourceId = new Map(), logPlayEventDesktop = createPlayEventLogger(invoke);
let likedIds = loadLikedSet();
let setPage = () => {}, renderHomePage = () => {}, renderDailyTable = () => {}, renderRecentPlaysTable = () => {};
let renderQueuePanel = () => {}, refreshFavButton = () => {}, randomNextIndex = () => 0, refreshQuickThemeModeUi = () => {}, renderImportTable = () => {}, loadPlaylistDetail = async () => {};
let openAccountCenter = () => {}, refreshAccountCenter = () => {}, wireAccountCenter = () => {};
let scheduleSavePlaybackState = () => {}, restorePlaybackState = async () => {};
let clearPersistedPlaybackState = async () => {};
let scheduleSavePlaybackProgress = () => {}, savePlaybackProgressNow = async () => {};
let hasPendingPlaybackResume = () => false, applyPendingPlaybackResume = () => false;

function setMusicCollectionModeValue(value) {
  musicCollectionMode = normalizeMusicCollectionMode(value);
}

function musicOnlineModeEnabled() {
  return musicCollectionMode === "online";
}

function audioEl() { return document.getElementById("audio-player"); }

async function syncLikedIdsFromBackend() {
  try {
    await invoke("ensure_favorites_playlist");
    const sourceIds = await invoke("list_favorite_source_ids");
    likedIds = new Set(Array.isArray(sourceIds) ? sourceIds.map((item) => String(item || "").trim()).filter(Boolean) : []);
    saveLikedSet(likedIds);
  } catch (error) {
    console.warn("sync favorites from backend", error);
  }
}

function setPlayModeIndexValue(value) {
  const next = Number(value);
  playModeIndex = Number.isFinite(next) && next >= 0 && next < PLAY_MODES.length ? next : 0;
  scheduleSavePlaybackState();
}

function setPlayQueueValue(rows) {
  playQueue = Array.isArray(rows) ? rows : [];
  if (playIndex >= playQueue.length) playIndex = playQueue.length ? playQueue.length - 1 : 0;
  scheduleSavePlaybackState();
}

function setPlayIndexValue(value) {
  const next = Number(value);
  if (!playQueue.length) {
    playIndex = 0;
  } else if (!Number.isFinite(next)) {
    playIndex = 0;
  } else {
    playIndex = Math.max(0, Math.min(playQueue.length - 1, Math.round(next)));
  }
  scheduleSavePlaybackState();
}

async function invalidatePlaybackContext(reason = "unknown") {
  const audio = audioEl();
  playLoadGeneration += 1;
  audioSourceGeneration += 1;
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  setPlayQueueValue([]);
  setPlayIndexValue(0);
  await clearPersistedPlaybackState();
  player.restorePlaybackSelection?.();
  player.refreshCurrentLyricsSnapshot?.();
  void player.syncDesktopLyrics?.();
  console.info("playback context invalidated", reason);
}

async function refreshPlaylistContextAfterSourceMutation() {
  const playlists = await pages.refreshPlaylistSelect(true);
  const first = Array.isArray(playlists) && playlists.length ? playlists[0] : null;
  if (!first) {
    selectedPlaylistId = null;
    selectedPlaylistName = "";
    playlistDetailRows = [];
    pages.renderPlaylistDetailTable();
    return;
  }
  selectedPlaylistId = first.id;
  selectedPlaylistName = first.name || "";
  if (document.querySelector('.page[data-page="playlist"]')?.classList.contains("page-active")) {
    await pages.loadPlaylistDetail(first.id, first.name || "", true);
  }
}

async function handleKugouAuthChanged(payload = {}) {
  await invalidatePlaybackContext(`kugou_${payload?.action || "changed"}`);
  let nextMode = "offline";
  try {
    const latestSettings = await invoke("get_settings");
    nextMode = latestSettings?.music_collection_mode ?? latestSettings?.musicCollectionMode ?? ((latestSettings?.music_online_mode ?? latestSettings?.musicOnlineMode) ? "online" : "offline");
    setMusicCollectionModeValue(nextMode);
  } catch (error) {
    console.warn("get_settings after kugou auth change", error);
  }
  if (nextMode !== "offline" || payload?.action === "logout") {
    await refreshPlaylistContextAfterSourceMutation();
  }
  await refreshAccountCenter();
}

function shouldIgnoreGlobalHotkeyAction() {
  const active = document.activeElement;
  if (!active || !(active instanceof Element)) return false;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return !active.disabled && !active.readOnly;
  if (active instanceof HTMLElement && active.isContentEditable) return true;
  const owner = active.closest('input, textarea, [contenteditable="true"]');
  if (!owner) return false;
  return owner instanceof HTMLInputElement || owner instanceof HTMLTextAreaElement ? !owner.disabled && !owner.readOnly : owner instanceof HTMLElement;
}

const settings = createSettingsRuntime({
  alertRequestFailed, applyAppTheme, applyMusicSourceProviderSelectionUi, applyNetworkProxyModeSelectionUi, applySettingsTabUi, applyThemeCardSelectionUi, applyThemeModeSelectionUi, audioEl, invoke,
  broadcastDesktopLyricsColors: (...args) => player.broadcastDesktopLyricsColors(...args), broadcastDesktopLyricsLock: (...args) => player.broadcastDesktopLyricsLock(...args),
  getDesktopLyricsOpen: () => desktopLyricsOpen, getImportDraftDirty: () => importDraftDirty, getImportMethod: () => importMethod, getImportTracks: () => importTracks,
  getNeteaseCookieEnabled: () => neteaseCookieEnabled, getNeteaseCookieValue: () => neteaseCookieValue, normalizeAccentHex, normalizeAppTheme, normalizeAppThemeMode,
  normalizeCloseAction, normalizeMusicSourceProvider, normalizeNetworkProxyMode, normalizeNetworkProxyUrl, normalizeSettingsTab,
  openAccountCenter: (...args) => openAccountCenter(...args),
  openDesktopLyricsFromSettingsIfNeeded: (...args) => player.openDesktopLyricsFromSettingsIfNeeded(...args), queueQuickThemeRefresh: (...args) => refreshQuickThemeModeUi(...args),
  refreshLyricsLockMenuLabel: (...args) => player.refreshLyricsLockMenuLabel(...args), renderImportTable: (...args) => renderImportTable(...args),
  setDesktopLyricsIdleText: (...args) => player.setDesktopLyricsIdleText(...args),
  setDesktopLyricsLocked: (value) => { desktopLyricsLocked = value; }, setImportDraftDirty: (value) => { importDraftDirty = value; }, setImportMethodValue: (value) => { importMethod = value; },
  setImportShareSuggestedName: (value) => { importShareSuggestedName = value || ""; }, setImportTracksValue: (rows) => { importTracks = Array.isArray(rows) ? rows : []; },
  setLastLibraryFolder: (value) => { lastLibraryFolder = value; }, setMainWindowCloseAction: (value) => { mainWindowCloseAction = value; },
  setMusicCollectionModeValue,
  setNeteaseCookieState: ({ enabled, value }) => { neteaseCookieEnabled = !!enabled; neteaseCookieValue = String(value || ""); }, setPage: (...args) => setPage(...args),
  onKugouAuthChanged: (...args) => handleKugouAuthChanged(...args),
  onMusicCollectionModeChanged: async (mode) => {
    setMusicCollectionModeValue(mode);
    await invalidatePlaybackContext(`music_collection_mode_${musicCollectionMode}`);
    await refreshPlaylistContextAfterSourceMutation();
  },
  onMusicSourceProviderChanged: async () => {
    await invalidatePlaybackContext("music_source_provider_changed");
  },
  setPreferredPlaybackVolume: (...args) => player.setPreferredPlaybackVolume(...args),
  updateDownloadFolderHint: (...args) => player.updateDownloadFolderHint(...args), warnRequestFailed,
});

const player = createBasePlayerRuntime({
  alertRequestFailed, audioDiagPayload, convertFileSrc, dockLyricsLockIcon, emitTo, escapeHtml, formatTime, getAudioEl: audioEl, invoke, logPlayEventDesktop,
  getAudioProgressLogLastTs: () => audioProgressLogLastTs, getAudioSourceGeneration: () => audioSourceGeneration, getDesktopLyricsLocked: () => desktopLyricsLocked,
  getDesktopLyricsOpen: () => desktopLyricsOpen, getDesktopLyricsWindow: () => desktopLyricsWindow, getDownloadTasks: () => downloadTasksBySourceId, getPlayIndex: () => playIndex,
  getPlayLoadGeneration: () => playLoadGeneration, getPlayModeIndex: () => playModeIndex, getPlayQueue: () => playQueue, getSearchState: () => searchState,
  getLikedIds: () => likedIds, getSeekDragging: () => seekDragging, getSessionRecentPlays: () => sessionRecentPlays, maxSessionRecent: RECENT_SESSION_MAX, messageRequestFailed: MSG_REQUEST_FAILED,
  onHomeQueueChanged: () => { if (document.querySelector('.page[data-page="home"]')?.classList.contains("page-active")) void renderHomePage(); },
  onRecentChanged: () => {
    if (document.querySelector('.page[data-page="recent"]')?.classList.contains("page-active")) renderRecentPlaysTable();
    if (document.querySelector('.page[data-page="home"]')?.classList.contains("page-active")) void renderHomePage();
    if (document.querySelector('.page[data-page="daily"]')?.classList.contains("page-active")) void renderDailyTable();
  },
  open, formatDurationMs, playModeItems: PLAY_MODES, randomNextIndex: (...args) => randomNextIndex(...args), refreshFavButton: (...args) => refreshFavButton(...args), renderQueuePanel: (...args) => renderQueuePanel(...args),
  setAudioProgressLogLastTs: (value) => { audioProgressLogLastTs = value; }, setAudioSourceGeneration: (value) => { audioSourceGeneration = value; },
  setDesktopLyricsLocked: (value) => { desktopLyricsLocked = value; }, setDesktopLyricsOpen: (value) => { desktopLyricsOpen = value; }, setDesktopLyricsWindow: (value) => { desktopLyricsWindow = value; },
  setLocalLibraryRows: (rows) => { localLibraryRows = Array.isArray(rows) ? rows : []; }, setPlayIndex: (value) => { setPlayIndexValue(value); }, setPlayLoadGeneration: (value) => { playLoadGeneration = value; },
  setPlayQueue: (rows) => { setPlayQueueValue(rows); }, setSeekDragging: (value) => { seekDragging = value; }, setSessionRecentPlays: (rows) => { sessionRecentPlays = Array.isArray(rows) ? rows : []; },
  applyPendingPlaybackResume: (...args) => applyPendingPlaybackResume(...args), hasPendingPlaybackResume: (...args) => hasPendingPlaybackResume(...args),
  savePlaybackProgressNow: (...args) => savePlaybackProgressNow(...args), scheduleSavePlaybackProgress: () => scheduleSavePlaybackProgress(),
  scheduleSavePlaybackState: () => scheduleSavePlaybackState(),
  trayPlayerTarget: TRAY_PLAYER_TARGET, warnRequestFailed, WebviewWindow,
});

const accountCenter = createAccountCenterController({
  invoke,
});
openAccountCenter = (...args) => accountCenter.openAccountCenter(...args);
refreshAccountCenter = (...args) => settings.refreshKugouSettingsStatus(...args);
wireAccountCenter = (...args) => accountCenter.wireAccountCenter(...args);
listen("account-center-status-changed", () => {
  void refreshAccountCenter();
});
listen("account-center-kugou-session-mutated", (event) => {
  void handleKugouAuthChanged(event?.payload || {});
});
listen("account-center-open-import", (event) => {
  const provider = String(event?.payload?.provider || "").trim().toLowerCase();
  settings.setImportMethod(provider === "netease" ? "netease" : "kugou");
  settings.setImportStep("config");
  setPage("import");
});
listen("account-center-toggle-online-mode", async (event) => {
  const nextMode = normalizeMusicCollectionMode(event?.payload?.nextMode);
  try {
    const result = await settings.toggleMusicOnlineModeFromAccountCenter?.(nextMode);
    await emitTo({ kind: "WebviewWindow", label: "account-center" }, "account-center-toggle-online-mode-result", {
      ok: true,
      mode: result?.mode || musicCollectionMode,
    });
  } catch (error) {
    await emitTo({ kind: "WebviewWindow", label: "account-center" }, "account-center-toggle-online-mode-result", {
      ok: false,
      mode: musicCollectionMode,
      message: error instanceof Error ? error.message : String(error || "toggle online mode failed"),
    });
  }
});
wireChildWindowMask();

const pages = createPageRuntime({
  alertRequestFailed, appLogoMarkSvg, applyQuickThemeMode: (...args) => dockTheme.applyQuickThemeMode(...args), escapeHtml, formatDurationMs, invoke, messageRequestFailed: MSG_REQUEST_FAILED,
  getDownloadTaskCount: () => downloadTasksBySourceId.size, getImportMethod: () => importMethod, getImportShareSuggestedName: () => importShareSuggestedName, getImportTracks: () => importTracks,
  getLastLibraryFolder: () => lastLibraryFolder, getLikedIds: () => likedIds, getNeteaseCookieState: () => ({ enabled: neteaseCookieEnabled, value: neteaseCookieValue }),
  getMusicOnlineModeEnabled: () => musicOnlineModeEnabled(),
  getMusicCollectionMode: () => musicCollectionMode,
  getPlayIndex: () => playIndex, getPlayQueue: () => playQueue, getPlaylistDetailRows: () => playlistDetailRows, getSelectedPlaylistId: () => selectedPlaylistId, getSelectedPlaylistName: () => selectedPlaylistName,
  getSessionRecentPlays: () => sessionRecentPlays, importBackButtonIconSvg, importMethodIconSvg, navIconSvg, navItems: NAV, open,
  openAccountCenter: (...args) => openAccountCenter(...args),
  playFromQueueIndex: (...args) => player.playFromQueueIndex(...args), playFromRecentRow: (...args) => player.playFromRecentRow(...args), playFromSearchRow: (...args) => player.playFromSearchRow(...args),
  refreshLocalLibraryTable: (...args) => player.refreshLocalLibraryTable(...args), refreshQuickThemeModeUi: (...args) => refreshQuickThemeModeUi(...args), renderDownloadQueueTable: (...args) => player.renderDownloadQueueTable(...args),
  renderQueuePanel: (...args) => renderQueuePanel(...args), renderRecentPlaysTable: (...args) => renderRecentPlaysTable(...args), resetImportFlow: settings.resetImportFlow, searchState,
  refreshKugouSettingsStatus: (...args) => settings.refreshKugouSettingsStatus(...args),
  syncMusicSourceProviderSelection: (...args) => settings.syncMusicSourceProviderSelection(...args),
  setImportDraft: settings.setImportDraft, setImportConfigHeader: settings.setImportConfigHeader, setImportMethod: settings.setImportMethod, setImportStep: settings.setImportStep, setLastLibraryFolder: (value) => { lastLibraryFolder = value; },
  setNeteaseCookieState: ({ enabled, value }) => { neteaseCookieEnabled = !!enabled; neteaseCookieValue = String(value || ""); }, setPlayQueue: (rows) => { setPlayQueueValue(rows); },
  setTableMutedMessage,
  setPlaylistDetailRows: (rows) => { playlistDetailRows = Array.isArray(rows) ? rows : []; }, setSelectedPlaylist: (id, name) => { selectedPlaylistId = id; selectedPlaylistName = name || ""; },
  sidebarMenuItems: SIDEBAR_MENU_NAV, syncNeteaseCookieUi: settings.syncNeteaseCookieUi, onKugouAuthChanged: (...args) => handleKugouAuthChanged(...args), warnRequestFailed,
});
setPage = pages.setPage; renderHomePage = pages.renderHomePage; renderDailyTable = pages.renderDailyTable; renderRecentPlaysTable = player.renderRecentPlaysTable; renderImportTable = pages.renderImportTable; loadPlaylistDetail = pages.loadPlaylistDetail;

const { dock, dockTheme, hotkeys, volume } = createDockRuntime({
  alertRequestFailed, applyAppTheme, getAudioEl: audioEl, getDesktopLyricsLocked: () => desktopLyricsLocked, getDesktopLyricsOpen: () => desktopLyricsOpen, getLikedIds: () => likedIds,
  getPlayIndex: () => playIndex, getPlayModeIndex: () => playModeIndex, getPlayQueue: () => playQueue, getQualityPref: () => qualityPref, getSettingsFormValues: () => settings.getSettingsFormValues(),
  invoke, listen, navIconSvg, normalizeAppThemeMode, iconSvgByName, playModeItems: PLAY_MODES, qualityLabels: QUALITY_LABELS, quickThemeModeLabels: QUICK_THEME_MODE_LABELS,
  setPreferredPlaybackVolume: (...args) => player.setPreferredPlaybackVolume(...args),
  queueSettingsAutosave: (...args) => settings.queueSettingsAutosave(...args), setThemeModeSelection: settings.setThemeModeSelection, saveLikedIds: saveLikedSet, shouldIgnoreGlobalHotkeyAction, warnRequestFailed,
  broadcastDesktopLyricsLock: (...args) => player.broadcastDesktopLyricsLock(...args), closeContextMenu: (...args) => pages.closeContextMenu(...args), enqueueDownloadForTrack: (...args) => pages.enqueueDownloadForTrack(...args),
  openLyricsReplaceWindow: (...args) => player.openLyricsReplaceWindow(...args), playFromQueueIndex: (...args) => player.playFromQueueIndex(...args), refreshLyricsLockMenuLabel: (...args) => player.refreshLyricsLockMenuLabel(...args),
  removeCurrentFromQueue: (...args) => player.removeCurrentFromQueue(...args), renderPlayerNav: (...args) => player.setPlayerNavEnabled(...args), toggleDesktopLyrics: (...args) => player.toggleDesktopLyrics(...args),
  togglePlayPauseWithTransition: (...args) => player.togglePlayPauseWithTransition(...args),
  toggleQueuePanel: (...args) => pages.toggleQueuePanel(...args), setDesktopLyricsLocked: (value) => { desktopLyricsLocked = value; }, setPlayModeIndex: (value) => { setPlayModeIndexValue(value); }, setQualityPref: (value) => { qualityPref = value; },
  scheduleSavePlaybackState: () => scheduleSavePlaybackState(),
});
refreshQuickThemeModeUi = dockTheme.refreshQuickThemeModeUi; renderQueuePanel = dock.renderQueuePanel; refreshFavButton = dock.refreshFavButton; randomNextIndex = dock.randomNextIndex;
const playbackState = createPlaybackStatePersistence({
  getAudioEl: audioEl,
  getPlayIndex: () => playIndex,
  getPlayModeIndex: () => playModeIndex,
  getPlayQueue: () => playQueue,
  invoke,
  playModeItems: PLAY_MODES,
  refreshCurrentLyricsSnapshot: () => player.refreshCurrentLyricsSnapshot?.(),
  restorePlaybackUi: () => {
    dock.refreshPlayModeButton?.();
    player.restorePlaybackSelection?.();
  },
  setPlayIndex: (value) => { setPlayIndexValue(value); },
  setPlayModeIndex: (value) => { setPlayModeIndexValue(value); },
  setPlayQueue: (rows) => { setPlayQueueValue(rows); },
  syncDesktopLyrics: () => player.syncDesktopLyrics?.(),
  syncSeekUi: () => player.syncSeekUi?.(),
});
applyPendingPlaybackResume = playbackState.applyPendingPlaybackResume;
clearPersistedPlaybackState = playbackState.clearPersistedPlaybackState;
hasPendingPlaybackResume = playbackState.hasPendingPlaybackResume;
savePlaybackProgressNow = playbackState.savePlaybackProgressNow;
scheduleSavePlaybackProgress = playbackState.scheduleSavePlaybackProgress;
scheduleSavePlaybackState = playbackState.scheduleSavePlaybackState;
restorePlaybackState = playbackState.restorePlaybackState;
playbackState.wirePersistenceLifecycle?.();

const immersive = createImmersiveController({
  formatTime,
  getAudioEl: audioEl,
  getCurrentLyricsSnapshot: (...args) => player.getCurrentLyricsSnapshot(...args),
  getPlayIndex: () => playIndex,
  getPlayQueue: () => playQueue,
  getSeekDragging: () => seekDragging,
  readCurrentLyricsSnapshot: (...args) => player.readCurrentLyricsSnapshot(...args),
  setSeekDragging: (value) => { seekDragging = value; },
});
const miniMode = createMiniModeController({
  closeImmersive: () => immersive.close(),
  formatTime,
  getAudioEl: audioEl,
  getCurrentLyricsSnapshot: (...args) => player.getCurrentLyricsSnapshot(...args),
  getPlayIndex: () => playIndex,
  getPlayQueue: () => playQueue,
  getSeekDragging: () => seekDragging,
  readCurrentLyricsSnapshot: (...args) => player.readCurrentLyricsSnapshot(...args),
  setSeekDragging: (value) => { seekDragging = value; },
});
startDesktopRuntime({
  alertRequestFailed, applyAppTheme, applyPlatformClassNames, dock, emitTo, getMainWindowCloseAction: () => mainWindowCloseAction, getPlayIndex: () => playIndex, getPlayLoadGeneration: () => playLoadGeneration,
  getPlayQueue: () => playQueue, getSelectedPlaylistId: () => selectedPlaylistId, getSelectedPlaylistName: () => selectedPlaylistName, hotkeys, invoke, listen, loadPlaylistDetail,
  immersive,
  lyricsReplaceTarget: LYRICS_REPLACE_TARGET, normalizeAppThemeMode,
  onLyricsLockSync: (locked) => { desktopLyricsLocked = locked; player.refreshLyricsLockMenuLabel(); },
  pages, player, renderDailyTable, renderImportTable, renderMainShell, renderQueuePanel: (...args) => renderQueuePanel(...args), restorePlaybackState: () => restorePlaybackState(), searchState, setPage: (...args) => setPage(...args), settings, systemDarkMedia,
  syncTrayCommand: async (action, payload = {}) => {
    if (action === "toggle") document.getElementById("btn-player-play")?.click();
    else if (action === "prev") document.getElementById("btn-player-prev")?.click();
    else if (action === "next") document.getElementById("btn-player-next")?.click();
    else if (action === "seek") {
      const audio = audioEl();
      const duration = audio?.duration;
      if (audio && duration && Number.isFinite(duration) && duration > 0) {
        const value = Number(payload?.value);
        if (Number.isFinite(value)) audio.currentTime = (Math.max(0, Math.min(1000, value)) / 1000) * duration;
      }
    }
    else if (action === "open-main") await invoke("show_main_window").catch((error) => console.warn("show_main_window from tray-player-command", error));
  },
  wireAccountCenter: (...args) => wireAccountCenter(...args),
});
document.addEventListener("DOMContentLoaded", () => {
  miniMode.wire();
  hotkeys.wireVolume?.();
  volume.syncVolumeUi?.();
});
