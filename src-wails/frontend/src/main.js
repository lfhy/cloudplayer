import { convertFileSrc, invoke } from "./wails/tauri-core.js";
import { open } from "./wails/tauri-plugin-dialog.js";
import { emitTo, listen } from "./wails/tauri-event.js";
import { WebviewWindow } from "./wails/tauri-webviewWindow.js";
import {
  LYRICS_REPLACE_TARGET,
  LYRICS_WW_TARGET,
  NAV,
  PLAY_MODES,
  QUALITY_LABELS,
  QUICK_THEME_MODE_LABELS,
  RECENT_SESSION_MAX,
  SIDEBAR_MENU_NAV,
  TRAY_PLAYER_TARGET,
} from "./app/constants.js";
import { MSG_REQUEST_FAILED, alertRequestFailed, warnRequestFailed } from "./app/helpers/errors.js";
import {
  appLogoMarkSvg,
  dockLyricsLockIcon,
  iconSvgByName,
  importBackButtonIconSvg,
  importMethodIconSvg,
  navIconSvg,
} from "./app/helpers/icons.js";
import { loadLikedSet, saveLikedSet } from "./app/helpers/likedSet.js";
import { audioDiagPayload, createPlayEventLogger } from "./app/helpers/playerDiagnostics.js";
import { escapeHtml, setTableMutedMessage } from "./app/helpers/text.js";
import { formatDurationMs, formatTime } from "./app/helpers/time.js";
import {
  applyAppTheme,
  applyPlatformClassNames,
  normalizeAccentHex,
  normalizeAppTheme,
  normalizeAppThemeMode,
  normalizeCloseAction,
  normalizeNetworkProxyMode,
  normalizeNetworkProxyUrl,
  normalizeSettingsTab,
  resolveAppThemeMode,
  setNetworkProxyModeSelection as applyNetworkProxyModeSelectionUi,
  setSettingsTab as applySettingsTabUi,
  setThemeCardSelection as applyThemeCardSelectionUi,
  setThemeModeSelection as applyThemeModeSelectionUi,
  systemDarkMedia,
  themeAccentRgb,
} from "./app/helpers/platformTheme.js";
import { createImportFlowHelpers } from "./app/helpers/importFlow.js";
import { createImportPageController } from "./features/import/controller.js";
import { createContextMenuController } from "./features/contextMenu/controller.js";
import { createDownloadController } from "./features/download/controller.js";
import { createNavigationController } from "./features/layout/navigationController.js";
import { createHomeController } from "./features/library/homeController.js";
import { createPlaylistController } from "./features/library/playlistController.js";
import { createLyricsController } from "./features/lyrics/controller.js";
import { createDockController } from "./features/player/dockController.js";
import { createDockThemeHelpers } from "./features/player/dockTheme.js";
import { createAudioEventsController } from "./features/player/audioEventsController.js";
import { createPlayerChromeController } from "./features/player/chromeController.js";
import { createPlayerHotkeyController } from "./features/player/hotkeysController.js";
import { createPlaybackController } from "./features/player/playbackController.js";
import { createTrayRecentController } from "./features/player/trayRecentController.js";
import { createSearchController } from "./features/search/controller.js";
import { createSettingsController } from "./features/settings/controller.js";
import { renderMainShell } from "./layout/renderMainShell.js";

/** @type {{ keyword: string, page: number, hasNext: boolean, results: any[], busy: boolean }} */
const searchState = {
  keyword: "",
  page: 1,
  hasNext: false,
  results: [],
  scope: "catalog",
  busy: false,
  playlistResults: [],
  view: "home",
};

const {
  fetchSearchPage,
  getActiveSearchInput,
  getSearchInputs,
  renderPlaylistSearchResults,
  renderSearchTable,
  setSearchScope,
  setSearchView,
  submitPageSearch,
  syncSearchInputs,
  updateSearchToolbar,
  updateSearchViewState,
  wireDiscoverToolbar,
  wireSearchPage,
} = createSearchController({
  escapeHtml,
  invoke,
  loadPlaylistDetail: (...args) => loadPlaylistDetail(...args),
  MSG_REQUEST_FAILED,
  openSearchRowContextMenu: (...args) => openSearchRowContextMenu(...args),
  playCatalogAll: (rows) => {
    playQueue = rows.map((row) => ({
      source_id: row.source_id,
      title: row.title,
      artist: row.artist || "",
      cover_url: row.cover_url || null,
    }));
    void playFromQueueIndex(0);
  },
  playFromSearchRow: (...args) => playFromSearchRow(...args),
  searchLocalPlaylists: (...args) => searchLocalPlaylists(...args),
  searchState,
  setPage: (...args) => setPage(...args),
  setSelectedPlaylist: (id, name) => {
    selectedPlaylistId = id;
    selectedPlaylistName = name;
  },
  setTableMutedMessage,
  warnRequestFailed,
});

let playQueue = [];
let playIndex = 0;
let seekDragging = false;
/** 每次发起「加载并播放」递增，用于丢弃过期的异步结果与 audio error（避免 A 失败覆盖 B 的封面/文案） */
let playLoadGeneration = 0;
/** 当前 audio 元素对应的加载世代（在成功写入 src 后赋值） */
let audioSourceGeneration = 0;
/** `progress` 上报节流：最多每秒一条 */
let audioProgressLogLastTs = 0;

/** 不向用户展示后端/网络异常细节（仅控制台保留完整错误） */
const logPlayEventDesktop = createPlayEventLogger(invoke);
let playModeIndex = 0;
let qualityPref = "128";

/** 导入页已解析条目 @type {{ title: string, artist: string, album: string }[]} */
let importTracks = [];

/** 桌面歌词独立窗口是否处于显示状态（隐藏/关闭后为 false） */
let desktopLyricsOpen = false;
let desktopLyricsWindow = null;
let desktopLyricsLocked = true;

/** 主窗口关闭：`ask` | `quit` | `tray`（与 settings 同步） */
let mainWindowCloseAction = "ask";

/** @type {number | null} */
let selectedPlaylistId = null;
let selectedPlaylistName = "";
/** @type {any[]} */
let playlistDetailRows = [];

/** 分享链接拉取成功后建议的歌单名（网易云 / QQ 返回） */
let importShareSuggestedName = "";
let neteaseCookieEnabled = false;
let neteaseCookieValue = "";
let importMethod = "";
let importDraftDirty = false;
let syncNeteaseCookieUi = () => {};
let setImportMethod = () => {};
let showImportResultStage = () => {};
let setImportStep = () => {};
let resetImportFlow = () => {};
let setImportDraft = () => {};

/** @type {Array<{ source_id?: string, title: string, artist: string, cover_url?: string | null, local_path?: string }>} */
let sessionRecentPlays = [];
/** 下载队列展示：sourceId -> 最后一帧事件 */
const downloadTasksBySourceId = new Map();
/** 本地曲库列表行缓存（双击播放） @type {any[]} */
let localLibraryRows = [];
let lastLibraryFolder = "";

const {
  applyLyricsPayload,
  broadcastDesktopLyricsColors,
  broadcastDesktopLyricsLock,
  clearLyricsCache,
  currentPlayableKey,
  ensureLrcLoadedForCurrentTrack,
  openDesktopLyricsFromSettingsIfNeeded,
  openLyricsReplaceWindow,
  refreshLyricsLockMenuLabel,
  scheduleDesktopLyricsStateSync,
  syncDesktopLyrics,
  syncDesktopLyricsState,
  toggleDesktopLyrics,
} = createLyricsController({
  dockLyricsLockIcon,
  emitTo,
  getAudioEl: audioEl,
  getDesktopLyricsLocked: () => desktopLyricsLocked,
  getDesktopLyricsOpen: () => desktopLyricsOpen,
  getDesktopLyricsWindow: () => desktopLyricsWindow,
  getPlayIndex: () => playIndex,
  getPlayLoadGeneration: () => playLoadGeneration,
  getPlayQueue: () => playQueue,
  invoke,
  setDesktopLyricsLocked: (value) => {
    desktopLyricsLocked = value;
  },
  setDesktopLyricsOpen: (value) => {
    desktopLyricsOpen = value;
  },
  setDesktopLyricsWindow: (value) => {
    desktopLyricsWindow = value;
  },
  WebviewWindow,
});

const { renderDailyTable, renderHomePage } = createHomeController({
  escapeHtml,
  getDownloadTaskCount: () => downloadTasksBySourceId.size,
  getSessionRecentPlays: () => sessionRecentPlays,
  invoke,
  playFromRecentRow: (...args) => playFromRecentRow(...args),
  playSingleItem: (item) => {
    playQueue = item.local_path
      ? [{ title: item.title, artist: item.artist || "", local_path: item.local_path, cover_url: null }]
      : [{ source_id: item.source_id, title: item.title, artist: item.artist || "", cover_url: item.cover_url || null }];
    void playFromQueueIndex(0);
    renderQueuePanel();
  },
});

const {
  loadPlaylistDetail,
  playFromPlaylistRow,
  refreshPlaylistSelect,
  refreshSidebarPlaylists,
  renderPlaylistDetailTable,
  searchLocalPlaylists,
  wirePlaylistPage,
} = createPlaylistController({
  alertRequestFailed,
  escapeHtml,
  formatDurationMs,
  getImportTracks: () => importTracks,
  getLikedIds: () => likedIds,
  getPlaylistDetailRows: () => playlistDetailRows,
  getSelectedPlaylistId: () => selectedPlaylistId,
  getSelectedPlaylistName: () => selectedPlaylistName,
  invoke,
  MSG_REQUEST_FAILED,
  openPlaylistDetailRowContextMenu: (...args) => openPlaylistDetailRowContextMenu(...args),
  openSidebarPlaylistContextMenu: (...args) => openSidebarPlaylistContextMenu(...args),
  playFromQueueIndex: (...args) => playFromQueueIndex(...args),
  renderHomePage,
  renderQueuePanel: (...args) => renderQueuePanel(...args),
  setPage: (...args) => setPage(...args),
  setPlaylistDetailRows: (rows) => {
    playlistDetailRows = Array.isArray(rows) ? rows : [];
  },
  setPlayQueue: (rows) => {
    playQueue = rows;
  },
  setSelectedPlaylist: (id, name) => {
    selectedPlaylistId = id;
    selectedPlaylistName = name;
  },
  warnRequestFailed,
});

const {
  closeContextMenu,
  enqueueDownloadForTrack,
  openPlaylistDetailRowContextMenu,
  openSearchRowContextMenu,
  openSidebarPlaylistContextMenu,
} = createContextMenuController({
  alertRequestFailed,
  getPlayIndex: () => playIndex,
  getPlayQueue: () => playQueue,
  getPlaylistDetailRows: () => playlistDetailRows,
  getSearchResults: () => searchState.results,
  getSelectedPlaylistId: () => selectedPlaylistId,
  getSelectedPlaylistName: () => selectedPlaylistName,
  invoke,
  loadPlaylistDetail,
  playFromQueueIndex: (...args) => playFromQueueIndex(...args),
  playFromSearchRow: (...args) => playFromSearchRow(...args),
  refreshPlaylistSelect,
  refreshSidebarPlaylists,
  renderQueuePanel: (...args) => renderQueuePanel(...args),
  setPage: (...args) => setPage(...args),
  setPlayQueue: (rows) => {
    playQueue = rows;
  },
  setSelectedPlaylist: (id, name) => {
    selectedPlaylistId = id;
    selectedPlaylistName = name;
  },
});
let likedIds = loadLikedSet();

function canSaveCustomProxyUrl(value) {
  const raw = normalizeNetworkProxyUrl(value);
  if (!raw) return false;
  const candidate = raw.includes("://") ? raw : `http://${raw}`;
  try {
    const url = new URL(candidate);
    const scheme = url.protocol.replace(/:$/, "").toLowerCase();
    return ["http", "https", "socks", "socks5", "socks5h"].includes(scheme) && !!url.host;
  } catch {
    return false;
  }
}

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
  refreshQuickThemeModeUi(normalized);
}

function setNetworkProxyModeSelection(mode) {
  const normalized = normalizeNetworkProxyMode(mode);
  const hidden = document.getElementById("setting-network-proxy-mode");
  const urlInput = document.getElementById("setting-network-proxy-url");
  if (hidden) hidden.value = normalized;
  if (urlInput) urlInput.disabled = normalized !== "custom";
  applyNetworkProxyModeSelectionUi(normalized);
}

function setSettingsTab(tab) {
  applySettingsTabUi(normalizeSettingsTab(tab));
}

const { applyQuickThemeMode, effectiveQuickThemeMode, nextQuickThemeMode, refreshQuickThemeModeUi } =
  createDockThemeHelpers({
    applyAppTheme,
    getSettingsFormValues: () => getSettingsFormValues(),
    labels: QUICK_THEME_MODE_LABELS,
    navIconSvg,
    normalizeAppThemeMode,
    queueSettingsAutosave: (...args) => queueSettingsAutosave(...args),
    setThemeModeSelection,
  });

const {
  closeAllDockMenus,
  randomNextIndex,
  refreshFavButton,
  renderQueuePanel,
  toggleDockMenu,
  wireDockBar,
} = createDockController({
  alertRequestFailed,
  applyQuickThemeMode,
  broadcastDesktopLyricsLock,
  closeContextMenu,
  effectiveQuickThemeMode,
  getDesktopLyricsLocked: () => desktopLyricsLocked,
  getDesktopLyricsOpen: () => desktopLyricsOpen,
  enqueueDownloadForTrack,
  getLikedIds: () => likedIds,
  getPlayIndex: () => playIndex,
  getPlayModeIndex: () => playModeIndex,
  getPlayQueue: () => playQueue,
  getQualityPref: () => qualityPref,
  iconSvgByName,
  invoke,
  nextQuickThemeMode,
  openLyricsReplaceWindow,
  playFromQueueIndex: (...args) => playFromQueueIndex(...args),
  playModeItems: PLAY_MODES,
  qualityLabels: QUALITY_LABELS,
  refreshLyricsLockMenuLabel,
  refreshQuickThemeModeUi,
  removeCurrentFromQueue: (...args) => removeCurrentFromQueue(...args),
  renderPlayerNav: (...args) => setPlayerNavEnabled(...args),
  saveLikedIds: saveLikedSet,
  setDesktopLyricsLocked: (value) => {
    desktopLyricsLocked = value;
  },
  setPlayModeIndex: (value) => {
    playModeIndex = value;
  },
  setQualityPref: (value) => {
    qualityPref = value;
  },
  toggleQueuePanel: (...args) => toggleQueuePanel(...args),
  toggleDesktopLyrics,
});

const { wireGlobalHotkeyListener, wireVolume } = createPlayerHotkeyController({
  getAudioEl: audioEl,
  invoke,
  listen,
  shouldIgnoreGlobalHotkeyAction: () => shouldIgnoreGlobalHotkeyAction(),
  warnRequestFailed,
});

const {
  broadcastTrayPlayerState,
  currentTrayPlayerState,
  loadRecentPlaysFromDb,
  playFromRecentRow,
  pushSessionRecentFromCurrentTrack,
  renderRecentPlaysTable,
} = createTrayRecentController({
  emitTo,
  escapeHtml,
  getAudioEl: audioEl,
  getPlayIndex: () => playIndex,
  getPlayQueue: () => playQueue,
  getSessionRecentPlays: () => sessionRecentPlays,
  invoke,
  maxSessionRecent: RECENT_SESSION_MAX,
  onRecentChanged: () => {
    if (document.querySelector('.page[data-page="recent"]')?.classList.contains("page-active")) {
      renderRecentPlaysTable();
    }
    if (document.querySelector('.page[data-page="home"]')?.classList.contains("page-active")) {
      renderHomePage();
    }
    if (document.querySelector('.page[data-page="daily"]')?.classList.contains("page-active")) {
      renderDailyTable();
    }
  },
  playFromQueueIndex: (...args) => playFromQueueIndex(...args),
  renderQueuePanel: (...args) => renderQueuePanel(...args),
  setPlayQueue: (rows) => {
    playQueue = rows;
  },
  setSessionRecentPlays: (rows) => {
    sessionRecentPlays = Array.isArray(rows) ? rows : [];
  },
  trayPlayerTarget: TRAY_PLAYER_TARGET,
});

const {
  applyDownloadTaskChanged,
  refreshLocalLibraryTable,
  renderDownloadQueueTable,
  updateDownloadFolderHint,
  wireDownloadPage,
} = createDownloadController({
  alertRequestFailed,
  escapeHtml,
  getDownloadTasks: () => downloadTasksBySourceId,
  invoke,
  messageRequestFailed: MSG_REQUEST_FAILED,
  open,
  setLocalLibraryRows: (rows) => {
    localLibraryRows = Array.isArray(rows) ? rows : [];
  },
  updateHomeAfterQueueChange: () => {
    if (document.querySelector('.page[data-page="home"]')?.classList.contains("page-active")) {
      renderHomePage();
    }
  },
  warnRequestFailed,
});

const { setPlayerNavEnabled, syncSeekUi, updatePlayerChrome } = createPlayerChromeController({
  broadcastTrayPlayerState,
  formatTime,
  getAudioEl: audioEl,
  getPlayIndex: () => playIndex,
  getPlayModeIndex: () => playModeIndex,
  getPlayQueue: () => playQueue,
  getSeekDragging: () => seekDragging,
  playModeItems: PLAY_MODES,
});

const { wireAudio } = createAudioEventsController({
  alertRequestFailed,
  audioDiagPayload,
  broadcastTrayPlayerState,
  getAudioEl: audioEl,
  getAudioProgressLogLastTs: () => audioProgressLogLastTs,
  getAudioSourceGeneration: () => audioSourceGeneration,
  getPlayIndex: () => playIndex,
  getPlayLoadGeneration: () => playLoadGeneration,
  getPlayModeIndex: () => playModeIndex,
  getPlayQueue: () => playQueue,
  logPlayEventDesktop,
  messageRequestFailed: MSG_REQUEST_FAILED,
  playFromQueueIndex: (...args) => playFromQueueIndex(...args),
  playModeItems: PLAY_MODES,
  randomNextIndex,
  setAudioProgressLogLastTs: (value) => {
    audioProgressLogLastTs = value;
  },
  setSeekDragging: (value) => {
    seekDragging = value;
  },
  syncDesktopLyrics: () => syncDesktopLyrics(),
  syncSeekUi,
});

// Settings are split into a controller so the runtime entry only keeps state bridges.
const {
  getSettingsFormValues,
  loadSettings,
  openCloseConfirmModal,
  queueSettingsAutosave,
  wirePreferencesModals,
} = createSettingsController({
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
  normalizeNetworkProxyMode,
  normalizeNetworkProxyUrl,
  openDesktopLyricsFromSettingsIfNeeded,
  refreshLyricsLockMenuLabel,
  setMainWindowCloseAction: (value) => {
    mainWindowCloseAction = value;
  },
  setNetworkProxyModeSelection,
  setPage: (...args) => setPage(...args),
  setSettingsTab,
  setThemeCardSelection,
  setThemeModeSelection,
  updateDownloadFolderHint,
  warnRequestFailed,
  syncNeteaseCookieUi: () => syncNeteaseCookieUi(),
  setDesktopLyricsLocked: (value) => {
    desktopLyricsLocked = value;
  },
  getDesktopLyricsOpen: () => desktopLyricsOpen,
  setLastLibraryFolder: (value) => {
    lastLibraryFolder = value;
  },
  setNeteaseCookieState: ({ enabled, value }) => {
    neteaseCookieEnabled = !!enabled;
    neteaseCookieValue = String(value || "");
  },
});

const { playFromQueueIndex, playFromSearchRow, removeCurrentFromQueue } = createPlaybackController({
  alertRequestFailed,
  clearLyricsCache,
  convertFileSrc,
  ensureLrcLoadedForCurrentTrack,
  getAudioEl: audioEl,
  getDesktopLyricsOpen: () => desktopLyricsOpen,
  getPlayIndex: () => playIndex,
  getPlayLoadGeneration: () => playLoadGeneration,
  getPlayQueue: () => playQueue,
  getSearchState: () => searchState,
  invoke,
  logPlayEventDesktop,
  messageRequestFailed: MSG_REQUEST_FAILED,
  onAfterQueueChanged: () => pushSessionRecentFromCurrentTrack(),
  onLyricsReady: () => syncDesktopLyrics(),
  refreshFavButton,
  renderQueuePanel,
  setAudioSourceGeneration: (value) => {
    audioSourceGeneration = value;
  },
  setPlayIndex: (value) => {
    playIndex = value;
  },
  setPlayLoadGeneration: (value) => {
    playLoadGeneration = value;
  },
  setPlayQueue: (rows) => {
    playQueue = Array.isArray(rows) ? rows : [];
  },
  setPlayerNavEnabled,
  syncSeekUi,
  updatePlayerChrome,
});


/** ---------- 右键菜单（对齐 Py sidebar / import_track_context_menu） ---------- */


const { renderImportTable, wireImportPage } = createImportPageController({
  alertRequestFailed,
  escapeHtml,
  getImportMethod: () => importMethod,
  getImportShareSuggestedName: () => importShareSuggestedName,
  getImportTracks: () => importTracks,
  getLastLibraryFolder: () => lastLibraryFolder,
  getNeteaseCookieState: () => ({ enabled: neteaseCookieEnabled, value: neteaseCookieValue }),
  importBackButtonIconSvg,
  importMethodIconSvg,
  invoke,
  loadPlaylistDetail,
  MSG_REQUEST_FAILED,
  open,
  refreshLocalLibraryTable,
  refreshPlaylistSelect,
  refreshSidebarPlaylists,
  setImportDraft: (...args) => setImportDraft(...args),
  setImportMethod: (...args) => setImportMethod(...args),
  setImportStep: (...args) => setImportStep(...args),
  setLastLibraryFolder: (value) => {
    lastLibraryFolder = value;
  },
  setNeteaseCookieState: ({ enabled, value }) => {
    neteaseCookieEnabled = !!enabled;
    neteaseCookieValue = String(value || "");
  },
  setPage: (...args) => setPage(...args),
  setSelectedPlaylist: (id, name) => {
    selectedPlaylistId = id;
    selectedPlaylistName = name;
  },
  syncNeteaseCookieUi: () => syncNeteaseCookieUi(),
});

// Import flow keeps step transitions in a helper while main.js owns the mutable state.
({
  syncNeteaseCookieUi,
  setImportMethod,
  showImportResultStage,
  setImportStep,
  resetImportFlow,
  setImportDraft,
} = createImportFlowHelpers({
  getImportMethod: () => importMethod,
  setImportMethodValue: (value) => {
    importMethod = value;
  },
  getImportTracks: () => importTracks,
  setImportTracksValue: (tracks) => {
    importTracks = Array.isArray(tracks) ? tracks : [];
  },
  setImportShareSuggestedName: (value) => {
    importShareSuggestedName = value || "";
  },
  setImportDraftDirty: (dirty) => {
    importDraftDirty = !!dirty;
  },
  getImportDraftDirty: () => importDraftDirty,
  getNeteaseCookieEnabled: () => neteaseCookieEnabled,
  getNeteaseCookieValue: () => neteaseCookieValue,
  renderImportTable,
}));

function audioEl() {
  return document.getElementById("audio-player");
}

function isEditableElement(el) {
  if (!el || !(el instanceof Element)) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return !el.disabled && !el.readOnly;
  }
  if (el instanceof HTMLElement && el.isContentEditable) {
    return true;
  }
  const owner = el.closest('input, textarea, [contenteditable="true"]');
  if (!owner) return false;
  if (owner instanceof HTMLInputElement || owner instanceof HTMLTextAreaElement) {
    return !owner.disabled && !owner.readOnly;
  }
  return owner instanceof HTMLElement;
}

function shouldIgnoreGlobalHotkeyAction() {
  return isEditableElement(document.activeElement);
}

const { renderSidebar, setPage, toggleQueuePanel, wireQueueToggle } = createNavigationController({
  alertRequestFailed,
  appLogoMarkSvg,
  applyQuickThemeMode,
  escapeHtml,
  getActiveSearchInput,
  invoke,
  navIconSvg,
  navItems: NAV,
  onDailyPage: () => renderDailyTable(),
  onDownloadPage: () => renderDownloadQueueTable(),
  onHomePage: () => renderHomePage(),
  onImportPage: () => {
    if (!importMethod && !importTracks.length) resetImportFlow();
    void refreshPlaylistSelect();
  },
  onPlaylistPage: () => {
    if (selectedPlaylistId == null) {
      selectedPlaylistName = "";
      const titleEl = document.getElementById("playlist-page-title");
      if (titleEl) titleEl.textContent = "歌单";
      playlistDetailRows = [];
      renderPlaylistDetailTable();
      return;
    }
    void loadPlaylistDetail(selectedPlaylistId, selectedPlaylistName);
  },
  onRecentPage: () => renderRecentPlaysTable(),
  onSearchPage: () => {
    queueMicrotask(() => {
      getActiveSearchInput()?.focus();
    });
  },
  refreshQuickThemeModeUi,
  refreshSidebarPlaylists,
  renderQueuePanel,
  sidebarMenuItems: SIDEBAR_MENU_NAV,
});

document.addEventListener("DOMContentLoaded", () => {
  renderMainShell();
  applyPlatformClassNames();
  renderSidebar();
  setPage("home");
  document.getElementById("btn-home-search")?.addEventListener("click", () => setPage("search"));
  document.getElementById("btn-home-import")?.addEventListener("click", () => setPage("import"));
  document.getElementById("btn-home-open-recent")?.addEventListener("click", () => setPage("recent"));
  document.getElementById("btn-home-open-daily")?.addEventListener("click", () => setPage("daily"));
  document.getElementById("btn-refresh-daily")?.addEventListener("click", () => renderDailyTable());
  wireQueueToggle();
  wireDockBar();
  wireDownloadPage();
  wireImportPage();
  wirePlaylistPage();
  wireVolume();
  wirePreferencesModals();
  wireSearchPage();
  wireGlobalHotkeyListener();
  wireDiscoverToolbar();
  wireAudio();
  setSearchScope(searchState.scope);
  updateSearchViewState();
  renderSearchTable();
  renderPlaylistSearchResults();
  renderImportTable();
  updateSearchToolbar();
  renderQueuePanel();
  refreshLyricsLockMenuLabel();
  let enrichReloadTimer = null;
  listen("import-enrich-item-done", (e) => {
    const p = e.payload;
    const pid = p?.playlistId ?? p?.playlist_id;
    if (pid == null || pid !== selectedPlaylistId) return;
    if (enrichReloadTimer) clearTimeout(enrichReloadTimer);
    enrichReloadTimer = setTimeout(() => {
      enrichReloadTimer = null;
      void loadPlaylistDetail(selectedPlaylistId, selectedPlaylistName);
    }, 450);
  });
  listen("import-enrich-finished", (e) => {
    const p = e.payload;
    const pid = p?.playlistId ?? p?.playlist_id;
    if (pid == null || pid !== selectedPlaylistId) return;
    void loadPlaylistDetail(selectedPlaylistId, selectedPlaylistName);
  });
  listen("desktop-lyrics-lock-sync", async (e) => {
    const locked = e?.payload?.locked;
    if (typeof locked !== "boolean") return;
    desktopLyricsLocked = locked;
    refreshLyricsLockMenuLabel();
  });
  listen("desktop-lyrics-request-sync", async () => {
    await ensureLrcLoadedForCurrentTrack(playLoadGeneration);
    await syncDesktopLyricsState();
  });
  listen("tray-player-request-sync", async () => {
    await broadcastTrayPlayerState();
  });
  listen("tray-player-command", async (e) => {
    const action = e?.payload?.action;
    if (action === "toggle") {
      document.getElementById("btn-player-play")?.click();
      return;
    }
    if (action === "prev") {
      document.getElementById("btn-player-prev")?.click();
      return;
    }
    if (action === "next") {
      document.getElementById("btn-player-next")?.click();
      return;
    }
    if (action === "open-main") {
      try {
        await invoke("show_main_window");
      } catch (err) {
        console.warn("show_main_window from tray-player-command", err);
      }
    }
  });
  listen("download-task-changed", (e) => {
    applyDownloadTaskChanged(e?.payload);
  });
  listen("desktop-lyrics-request-lock", async (e) => {
    const locked = e?.payload?.locked;
    if (typeof locked !== "boolean") return;
    desktopLyricsLocked = locked;
    refreshLyricsLockMenuLabel();
    try {
      await invoke("save_settings", { patch: { desktop_lyrics_locked: locked } });
    } catch (err) {
      console.warn("save_settings desktop_lyrics_locked (request-lock)", err);
    }
    await broadcastDesktopLyricsLock();
  });
  listen("main-close-requested", async () => {
    const action = mainWindowCloseAction;
    if (action === "quit") {
      try {
        await invoke("quit_app");
      } catch (e) {
        alertRequestFailed(e, "close flow");
      }
      return;
    }
    if (action === "tray") {
      try {
        await invoke("hide_main_window");
      } catch (e) {
        alertRequestFailed(e, "close flow");
      }
      return;
    }
    openCloseConfirmModal();
  });
  listen("lyrics-replace-apply-request", async (e) => {
    const requestId = String(e?.payload?.requestId || "").trim();
    const replyTarget = String(e?.payload?.replyTarget || LYRICS_REPLACE_TARGET.label).trim();
    if (!requestId) return;
    const reply = async (ok, message = "") => {
      try {
        await emitTo({ kind: "WebviewWindow", label: replyTarget }, "lyrics-replace-apply-result", {
          requestId,
          ok,
          message,
        });
      } catch (err) {
        console.warn("lyrics-replace-apply-result", err);
      }
    };
    const current = playQueue[playIndex] || null;
    if (!current) {
      await reply(false, "当前没有正在播放的曲目。");
      return;
    }
    const expectedTrackKey = String(e?.payload?.trackKey || "").trim();
    const currentTrackKey = currentPlayableKey(current);
    if (expectedTrackKey && expectedTrackKey !== currentTrackKey) {
      await reply(false, "当前播放曲目已变化，请重新打开“换歌词”窗口。");
      return;
    }
    const raw = e?.payload?.lyricsPayload;
    const lrcText = String(raw?.lrcText || "");
    if (!lrcText.trim()) {
      await reply(false, "当前候选没有可用歌词。");
      return;
    }
    await applyLyricsPayload(raw);
    await reply(true, "");
  });
  if (systemDarkMedia && typeof systemDarkMedia.addEventListener === "function") {
    systemDarkMedia.addEventListener("change", () => {
      const mode = normalizeAppThemeMode(
        document.getElementById("setting-app-theme-mode")?.value ??
          document.documentElement.dataset.themeMode ??
          "system"
      );
      if (mode !== "system") return;
      const current = getSettingsFormValues();
      applyAppTheme(current.theme, current.customAccent, mode);
    });
  }
  void loadRecentPlaysFromDb();
  loadSettings();
  void broadcastTrayPlayerState();
});
