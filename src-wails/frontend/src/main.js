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
import { createPlayerHotkeyController } from "./features/player/hotkeysController.js";
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
  loadPlaylistDetail,
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
  playFromSearchRow,
  searchLocalPlaylists,
  searchState,
  setPage,
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
  playFromRecentRow,
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
  playFromQueueIndex,
  renderHomePage,
  renderQueuePanel,
  setPage,
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
  playFromQueueIndex,
  playFromSearchRow,
  refreshPlaylistSelect,
  refreshSidebarPlaylists,
  renderQueuePanel,
  setPage,
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
  playFromQueueIndex,
  playModeItems: PLAY_MODES,
  qualityLabels: QUALITY_LABELS,
  refreshLyricsLockMenuLabel,
  refreshQuickThemeModeUi,
  removeCurrentFromQueue,
  renderPlayerNav: setPlayerNavEnabled,
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
  toggleQueuePanel,
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
  playFromQueueIndex,
  renderQueuePanel,
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
  setPage,
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


function removeCurrentFromQueue() {
  if (!playQueue.length) return;
  playQueue.splice(playIndex, 1);
  const a = audioEl();
  if (!playQueue.length) {
    playIndex = 0;
    playLoadGeneration += 1;
    if (a) {
      a.pause();
      a.removeAttribute("src");
    }
    updatePlayerChrome({ title: "未播放", sub: "队列已空", coverUrl: null });
    document.getElementById("btn-player-play").textContent = "▶";
  } else {
    if (playIndex >= playQueue.length) playIndex = playQueue.length - 1;
    playFromQueueIndex(playIndex);
  }
  renderQueuePanel();
  setPlayerNavEnabled();
  refreshFavButton();
}

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
  setPage,
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

/**
 * @param {{ title?: string, sub?: string, coverUrl?: string | null, touchCover?: boolean }} patch
 * touchCover 为 false 时不改封面（用于播放失败，避免错误条目替换当前正在播放的封面）
 */
function updatePlayerChrome(patch = {}) {
  const { title, sub, coverUrl, touchCover = true } = patch;
  const tEl = document.getElementById("dock-title");
  const sEl = document.getElementById("dock-sub");
  const cov = document.getElementById("dock-cover");
  if (title !== undefined && tEl) tEl.textContent = title;
  if (sub !== undefined && sEl) sEl.textContent = sub;
  if (touchCover && cov && coverUrl !== undefined && coverUrl) cov.src = coverUrl;
  queueMicrotask(() => {
    void broadcastTrayPlayerState();
  });
}

function syncSeekUi() {
  const a = audioEl();
  const seek = document.getElementById("seek");
  const cur = document.getElementById("time-current");
  const tot = document.getElementById("time-total");
  if (!a || !seek || !cur || !tot) return;
  const d = a.duration;
  if (d && isFinite(d) && d > 0) {
    tot.textContent = formatTime(d);
    if (!seekDragging) {
      seek.value = String(Math.min(1000, Math.floor((a.currentTime / d) * 1000)));
    }
    cur.textContent = formatTime(a.currentTime);
    seek.disabled = false;
  } else {
    cur.textContent = "0:00";
    tot.textContent = "0:00";
    seek.value = "0";
    seek.disabled = !a.src;
  }
}

function setPlayerNavEnabled() {
  const prev = document.getElementById("btn-player-prev");
  const next = document.getElementById("btn-player-next");
  const n = playQueue.length;
  const mode = PLAY_MODES[playModeIndex].key;
  if (!n) {
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
    return;
  }
  if (mode === "loop_list" || mode === "shuffle") {
    if (prev) prev.disabled = false;
    if (next) next.disabled = false;
    return;
  }
  if (mode === "one") {
    const dis = n <= 1;
    if (prev) prev.disabled = dis;
    if (next) next.disabled = dis;
    return;
  }
  if (prev) prev.disabled = playIndex <= 0;
  if (next) next.disabled = playIndex >= n - 1;
  queueMicrotask(() => {
    void broadcastTrayPlayerState();
  });
}

async function playFromQueueIndex(idx) {
  if (!playQueue.length || idx < 0 || idx >= playQueue.length) return;
  const generation = ++playLoadGeneration;
  playIndex = idx;
  const item = playQueue[idx];
  const subBase = item.local_path ? (item.artist ? `${item.artist}` : "本地音乐") : item.artist ? `${item.artist}` : "在线试听";
  updatePlayerChrome({
    title: item.title,
    sub: `${subBase} · ${item.local_path ? "正在加载本地文件…" : "正在拉取音频…"}`,
    touchCover: false,
  });
  const playBtn = document.getElementById("btn-player-play");
  const a = audioEl();
  try {
    let assetUrl;
    let onlineResolvedPlayUrl = null;
    let playLogExtra = item.local_path ? { kind: "local" } : null;
    if (item.local_path) {
      let pathOk = false;
      try {
        pathOk = await invoke("local_path_accessible", { path: item.local_path });
      } catch (e) {
        console.warn("local_path_accessible", e);
      }
      if (!pathOk) {
        if (generation !== playLoadGeneration) return;
        updatePlayerChrome({
          title: item.title,
          sub: `${item.artist ? `${item.artist} · ` : ""}本地文件不可用`,
          touchCover: false,
        });
        alert(`本地文件不存在或无法访问：\n${String(item.local_path || "").trim() || "（路径为空）"}`);
        return;
      }
      assetUrl = convertFileSrc(item.local_path);
    } else {
      /** 后端顺序：已下载文件 → 试听缓存文件 → 拉取并缓存试听 → 直链 URL */
      const resolveRetryBudgetMs = 5000;
      const resolveRetryGapMs = 200;
      const resolveT0 = Date.now();
      let resolved = null;
      let lastErr = null;
      for (;;) {
        if (generation !== playLoadGeneration) return;
        if (Date.now() - resolveT0 >= resolveRetryBudgetMs) break;
        try {
          resolved = await invoke("resolve_online_play", {
            songId: item.source_id,
            title: item.title || "",
            artist: item.artist || "",
          });
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (Date.now() - resolveT0 >= resolveRetryBudgetMs) break;
          const wait = Math.min(resolveRetryGapMs, resolveRetryBudgetMs - (Date.now() - resolveT0));
          if (wait > 0) {
            await new Promise((r) => setTimeout(r, wait));
          }
        }
      }
      if (generation !== playLoadGeneration) return;
      if (!resolved) throw lastErr ?? new Error("resolve_online_play failed");
      if (resolved.kind === "url" && resolved.url) {
        assetUrl = resolved.url;
        onlineResolvedPlayUrl = resolved.url;
      } else if (resolved.kind === "file" && resolved.path) {
        assetUrl = convertFileSrc(resolved.path);
      } else {
        throw new Error("resolve_online_play: 无效结果");
      }
      playLogExtra = {
        sid: item.source_id,
        kind: resolved.kind,
        via: resolved.via,
      };
    }
    if (generation !== playLoadGeneration) return;
    await logPlayEventDesktop("play_start", {
      url: assetUrl,
      extra: playLogExtra,
    });
    a.pause();
    a.removeAttribute("src");
    a.load();
    a.src = assetUrl;
    audioSourceGeneration = generation;
    await a.play();
    if (generation !== playLoadGeneration) return;
    pushSessionRecentFromCurrentTrack(onlineResolvedPlayUrl);
    updatePlayerChrome({
      title: item.title,
      sub: item.local_path
        ? item.artist
          ? `${item.artist} · 本地`
          : "本地音乐"
        : item.artist
          ? `${item.artist} · 在线试听`
          : "在线试听",
      coverUrl: item.cover_url || null,
    });
    if (playBtn) {
      playBtn.textContent = "⏸";
      playBtn.disabled = false;
    }
    setPlayerNavEnabled();
    syncSeekUi();
    renderQueuePanel();
    refreshFavButton();
    clearLyricsCache();
    if (desktopLyricsOpen) {
      void ensureLrcLoadedForCurrentTrack(generation).then(() => {
        if (generation !== playLoadGeneration) return;
        void syncDesktopLyrics();
      });
    }
  } catch (e) {
    if (generation !== playLoadGeneration) return;
    updatePlayerChrome({
      title: item.title,
      sub: MSG_REQUEST_FAILED,
      touchCover: false,
    });
    alertRequestFailed(e, "playFromQueueIndex");
  }
}

function playFromSearchRow(rowIdx) {
  if (searchState.scope !== "catalog") return;
  playQueue = searchState.results.map((r) => ({
    source_id: r.source_id,
    title: r.title,
    artist: r.artist || "",
    cover_url: r.cover_url || null,
  }));
  playFromQueueIndex(rowIdx);
  renderQueuePanel();
}

function wireAudio() {
  const a = audioEl();
  const playBtn = document.getElementById("btn-player-play");
  const seek = document.getElementById("seek");

  a.addEventListener("timeupdate", () => {
    syncSeekUi();
    void syncDesktopLyrics();
  });
  a.addEventListener("loadedmetadata", () => {
    syncSeekUi();
    if (audioSourceGeneration === playLoadGeneration) {
      void logPlayEventDesktop("audio_loadedmetadata", {
        url: a.src || null,
        extra: audioDiagPayload(a),
      });
    }
  });
  a.addEventListener("durationchange", () => syncSeekUi());
  a.addEventListener("canplay", () => syncSeekUi());
  a.addEventListener("progress", () => {
    if (audioSourceGeneration !== playLoadGeneration) return;
    const now = Date.now();
    if (now - audioProgressLogLastTs < 1000) return;
    audioProgressLogLastTs = now;
    void logPlayEventDesktop("audio_progress", {
      url: a.src || null,
      extra: audioDiagPayload(a),
    });
  });
  a.addEventListener("stalled", () => {
    if (audioSourceGeneration !== playLoadGeneration) return;
    void logPlayEventDesktop("audio_stalled", {
      url: a.src || null,
      extra: audioDiagPayload(a),
    });
  });
  a.addEventListener("ended", () => {
    if (audioSourceGeneration === playLoadGeneration) {
      void logPlayEventDesktop("audio_ended", {
        url: a.src || null,
        extra: audioDiagPayload(a),
      });
    }
    const n = playQueue.length;
    const mode = PLAY_MODES[playModeIndex].key;
    if (!n) {
      syncSeekUi();
      return;
    }
    if (mode === "one") {
      a.currentTime = 0;
      a.play().catch(() => {});
      return;
    }
    if (mode === "loop_list") {
      const nxt = (playIndex + 1) % n;
      playFromQueueIndex(nxt);
      return;
    }
    if (mode === "shuffle") {
      playFromQueueIndex(randomNextIndex());
      return;
    }
    if (playIndex < n - 1) {
      playFromQueueIndex(playIndex + 1);
    } else if (playBtn) {
      playBtn.textContent = "▶";
    }
    syncSeekUi();
  });
  a.addEventListener("play", () => {
    if (playBtn) playBtn.textContent = "⏸";
    void broadcastTrayPlayerState();
  });
  a.addEventListener("pause", () => {
    if (playBtn) playBtn.textContent = "▶";
    void broadcastTrayPlayerState();
  });
  a.addEventListener("error", () => {
    const err = a.error;
    if (err && err.code === 1) return;
    if (audioSourceGeneration !== playLoadGeneration) return;
    void logPlayEventDesktop("audio_error", {
      url: a.src || null,
      error_code: err ? err.code : null,
      message: err && err.message ? err.message : null,
      extra: audioDiagPayload(a),
    });
    const sub = document.getElementById("dock-sub");
    if (sub && err) {
      sub.textContent = MSG_REQUEST_FAILED;
    }
    void broadcastTrayPlayerState();
  });

  if (seek) {
    seek.addEventListener("pointerdown", () => {
      seekDragging = true;
    });
    seek.addEventListener("pointerup", () => {
      seekDragging = false;
      syncSeekUi();
    });
    seek.addEventListener("input", () => {
      const d = a.duration;
      if (d && isFinite(d) && d > 0) {
        a.currentTime = (Number(seek.value) / 1000) * d;
      }
    });
  }

  playBtn?.addEventListener("click", async () => {
    if (!a.src) return;
    try {
      if (a.paused) {
        await a.play();
      } else {
        a.pause();
      }
    } catch (err) {
      alertRequestFailed(err, "audio play()");
    }
  });
  document.getElementById("btn-player-prev")?.addEventListener("click", () => {
    const n = playQueue.length;
    if (!n) return;
    const mode = PLAY_MODES[playModeIndex].key;
    if (mode === "shuffle") {
      playFromQueueIndex((playIndex - 1 + n) % n);
      return;
    }
    if (mode === "loop_list" && playIndex === 0) {
      playFromQueueIndex(n - 1);
      return;
    }
    if (playIndex > 0) playFromQueueIndex(playIndex - 1);
  });
  document.getElementById("btn-player-next")?.addEventListener("click", () => {
    const n = playQueue.length;
    if (!n) return;
    const mode = PLAY_MODES[playModeIndex].key;
    if (mode === "shuffle") {
      playFromQueueIndex(randomNextIndex());
      return;
    }
    if (mode === "loop_list" && playIndex === n - 1) {
      playFromQueueIndex(0);
      return;
    }
    if (playIndex < n - 1) playFromQueueIndex(playIndex + 1);
  });
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
