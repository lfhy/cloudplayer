import "./styles.css";
import {
  buildImportCsvBlobUtf8,
  buildImportTxtBlob,
  triggerBlobDownload,
} from "./export-playlist.js";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const NAV = [
  { id: "discover", label: "发现", key: "like" },
  { id: "recent", label: "最近播放", key: "recent" },
  { id: "download", label: "本地和下载", key: "local_download" },
  { id: "import", label: "导入歌单", key: "import" },
];

/** @type {{ keyword: string, page: number, hasNext: boolean, results: any[], busy: boolean }} */
const searchState = {
  keyword: "",
  page: 1,
  hasNext: false,
  results: [],
  busy: false,
};

/** @type {Array<{ source_id?: string, title: string, artist: string, album?: string, cover_url?: string | null, local_path?: string }>} */
let playQueue = [];
let playIndex = 0;
let seekDragging = false;
/** 每次发起「加载并播放」递增，用于丢弃过期的异步结果与 audio error（避免 A 失败覆盖 B 的封面/文案） */
let playLoadGeneration = 0;
/** 当前 audio 元素对应的加载世代（在成功写入 src 后赋值） */
let audioSourceGeneration = 0;

/** 不向用户展示后端/网络异常细节（仅控制台保留完整错误） */
const MSG_REQUEST_FAILED = "请求失败";

function warnRequestFailed(e, label) {
  if (label) console.warn(label, e);
  else console.warn(e);
}

function alertRequestFailed(e, label) {
  warnRequestFailed(e, label);
  alert(MSG_REQUEST_FAILED);
}

/** 与 Py 版 PlayMode 对应：序 → 循 → 单 → 随 */
const PLAY_MODES = [
  { key: "sequential", label: "序", tip: "顺序播放（点击切换模式）" },
  { key: "loop_list", label: "循", tip: "列表循环" },
  { key: "one", label: "单", tip: "单曲循环" },
  { key: "shuffle", label: "随", tip: "随机播放" },
];
let playModeIndex = 0;

const QUALITY_LABELS = { flac: "无损", "320": "HQ", "128": "标准" };
let qualityPref = "128";

/** 导入页已解析条目 @type {{ title: string, artist: string, album: string }[]} */
let importTracks = [];

/** 桌面歌词独立窗口是否处于显示状态（隐藏/关闭后为 false） */
let desktopLyricsOpen = false;
let desktopLyricsWindow = null;
/** 与 settings 对齐：默认 true（锁定穿透，参考 QQ 音乐） */
let desktopLyricsLocked = true;
/** @type {{ t: number, text: string }[]} */
let lrcEntries = [];
/** 与 `lrcEntries` 同索引；逐字时间轴（毫秒），无则 null */
/** @type {Array<{ startMs: number, endMs: number, words: Array<{ startMs: number, endMs: number, text: string }> }> | null} */
let wordLines = null;
/** @type {string | null} */
let lrcCacheKey = null;

/** 歌词替换弹窗：多源搜索候选与预览载荷 */
/** @type {any[]} */
let lyricsReplaceCandidates = [];
let lyricsReplaceSelectedIndex = -1;
/** @type {{ lrcText: string, wordLines?: Array<any> | null } | null} */
let lyricsReplacePreviewPayload = null;
/** 防止快速切换搜索/行时，旧请求覆盖预览 */
let lyricsReplaceFetchGen = 0;

/** 主窗口关闭：`ask` | `quit` | `tray`（与 settings 同步） */
let mainWindowCloseAction = "ask";

/** @type {number | null} */
let selectedPlaylistId = null;
let selectedPlaylistName = "";
/** @type {any[]} */
let playlistDetailRows = [];

/** 分享链接拉取成功后建议的歌单名（网易云 / QQ 返回） */
let importShareSuggestedName = "";

/** 与 Py RecentPlaysPage：本会话内最近播放，最多 100 条 */
const RECENT_SESSION_MAX = 100;
/** @type {Array<{ source_id?: string, title: string, artist: string, album?: string, cover_url?: string | null, local_path?: string }>} */
let sessionRecentPlays = [];
/** 下载队列展示：sourceId -> 最后一帧事件 */
const downloadTasksBySourceId = new Map();
/** 本地曲库列表行缓存（双击播放） @type {any[]} */
let localLibraryRows = [];
/** 「下载歌曲」Tab：`list_downloaded_songs` 结果缓存（双击播放） @type {any[]} */
let downloadedSongsRows = [];
let lastLibraryFolder = "";

function loadLikedSet() {
  try {
    const raw = localStorage.getItem("cp_tauri_liked_ids");
    if (!raw) return new Set();
    const a = JSON.parse(raw);
    return new Set(Array.isArray(a) ? a : []);
  } catch {
    return new Set();
  }
}
function saveLikedSet(set) {
  localStorage.setItem("cp_tauri_liked_ids", JSON.stringify([...set]));
}
let likedIds = loadLikedSet();

function randomNextIndex() {
  const n = playQueue.length;
  if (n <= 1) return 0;
  let j = playIndex;
  let guard = 0;
  while (j === playIndex && guard++ < 12) {
    j = Math.floor(Math.random() * n);
  }
  return j;
}

function renderQueuePanel() {
  const ul = document.getElementById("queue-list");
  if (!ul) return;
  ul.innerHTML = "";
  if (!playQueue.length) {
    const li = document.createElement("li");
    li.textContent = "（空）在「发现」搜索并双击曲目加入队列";
    ul.appendChild(li);
    return;
  }
  playQueue.forEach((it, i) => {
    const li = document.createElement("li");
    if (i === playIndex) li.classList.add("is-current");
    const label = it.local_path
      ? `${it.title}${it.artist ? ` — ${it.artist}` : ""}`
      : it.artist
        ? `${it.title} — ${it.artist}`
        : it.title;
    li.textContent = label;
    li.title = it.local_path ? String(it.local_path) : `id=${it.source_id} · 双击播放`;
    li.addEventListener("dblclick", () => playFromQueueIndex(i));
    ul.appendChild(li);
  });
}

function refreshFavButton() {
  const btn = document.getElementById("btn-dock-fav");
  if (!btn) return;
  const cur = playQueue[playIndex];
  if (!cur) {
    btn.classList.remove("is-on");
    btn.textContent = "♡";
    btn.disabled = false;
    btn.title = "喜欢";
    return;
  }
  const sid = (cur.source_id || "").trim();
  const canFav = !!sid && !cur.local_path;
  btn.disabled = !canFav;
  btn.title = canFav ? "喜欢" : "本地文件无曲库 id，不支持喜欢";
  const on = canFav && likedIds.has(sid);
  btn.classList.toggle("is-on", on);
  btn.textContent = on ? "♥" : "♡";
}

function closeAllDockMenus() {
  document.querySelectorAll(".dock-menu").forEach((el) => {
    el.hidden = true;
  });
}

function toggleDockMenu(menuEl) {
  const willOpen = menuEl.hidden;
  closeAllDockMenus();
  menuEl.hidden = !willOpen;
}

function normalizeCloseAction(v) {
  const t = String(v || "ask").toLowerCase();
  return t === "quit" || t === "tray" ? t : "ask";
}

/** 偏好设置表单上次已保存/已加载的基线，用于对比是否有改动 */
let settingsFormBaseline = {
  action: "ask",
  base: "#ffffff",
  highlight: "#ffb7d4",
  neteaseApiBase: "",
};

function normalizeLyricHexInput(x, def) {
  const t = (x || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toLowerCase() : def;
}

function normalizeNeteaseApiBase(raw) {
  return String(raw ?? "").trim();
}

function getSettingsFormValues() {
  const sel = document.getElementById("setting-close-action");
  const b = document.getElementById("setting-ly-base");
  const h = document.getElementById("setting-ly-highlight");
  const nb = document.getElementById("setting-netease-api-base");
  return {
    action: normalizeCloseAction(sel?.value),
    base: normalizeLyricHexInput(b?.value, "#ffffff"),
    highlight: normalizeLyricHexInput(h?.value, "#ffb7d4"),
    neteaseApiBase: normalizeNeteaseApiBase(nb?.value),
  };
}

function settingsFormIsDirty() {
  const cur = getSettingsFormValues();
  return (
    cur.action !== settingsFormBaseline.action ||
    cur.base !== settingsFormBaseline.base ||
    cur.highlight !== settingsFormBaseline.highlight ||
    cur.neteaseApiBase !== settingsFormBaseline.neteaseApiBase
  );
}

function syncSettingsFormBaselineFromDom() {
  settingsFormBaseline = getSettingsFormValues();
  updateSettingsSaveButtonState();
}

function updateSettingsSaveButtonState() {
  const btn = document.getElementById("settings-save");
  if (!btn) return;
  const dirty = settingsFormIsDirty();
  btn.disabled = !dirty;
  btn.setAttribute("aria-disabled", dirty ? "false" : "true");
}

function fillSettingsFormFromSettings(s) {
  const sel = document.getElementById("setting-close-action");
  const v = normalizeCloseAction(s?.main_window_close_action ?? s?.mainWindowCloseAction);
  if (sel) sel.value = v;
  const b = document.getElementById("setting-ly-base");
  const h = document.getElementById("setting-ly-highlight");
  if (b) b.value = normalizeLyricHexInput(s?.desktop_lyrics_color_base ?? s?.desktopLyricsColorBase, "#ffffff");
  if (h) h.value = normalizeLyricHexInput(s?.desktop_lyrics_color_highlight ?? s?.desktopLyricsColorHighlight, "#ffb7d4");
  const nba = document.getElementById("setting-netease-api-base");
  if (nba) {
    nba.value = normalizeNeteaseApiBase(
      s?.lyrics_netease_api_base ?? s?.lyricsNeteaseApiBase ?? ""
    );
  }
  syncSettingsFormBaselineFromDom();
}

function openCloseConfirmModal() {
  const cb = document.getElementById("close-choice-remember");
  if (cb) cb.checked = false;
  const el = document.getElementById("close-confirm-modal");
  if (el) {
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
  }
}

function closeCloseConfirmModal() {
  const el = document.getElementById("close-confirm-modal");
  if (el) {
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
  }
}

async function runCloseChoice(mode) {
  const remember = !!document.getElementById("close-choice-remember")?.checked;
  closeCloseConfirmModal();
  if (remember) {
    const patch = { main_window_close_action: mode === "tray" ? "tray" : "quit" };
    try {
      await invoke("save_settings", { patch });
      mainWindowCloseAction = patch.main_window_close_action;
    } catch (e) {
      console.warn("save_settings main_window_close_action", e);
    }
  }
  try {
    if (mode === "tray") await invoke("hide_main_window");
    else await invoke("quit_app");
  } catch (e) {
    alertRequestFailed(e, "close flow");
  }
}

function wireSettingsFormDirtyTracking() {
  const onChange = () => updateSettingsSaveButtonState();
  document.getElementById("setting-close-action")?.addEventListener("change", onChange);
  document.getElementById("setting-ly-base")?.addEventListener("input", onChange);
  document.getElementById("setting-ly-highlight")?.addEventListener("input", onChange);
  document.getElementById("setting-netease-api-base")?.addEventListener("input", onChange);
}

function wirePreferencesModals() {
  document.getElementById("btn-settings-back")?.addEventListener("click", () => setPage("discover"));
  wireSettingsFormDirtyTracking();
  document.getElementById("settings-save")?.addEventListener("click", async () => {
    if (!settingsFormIsDirty()) return;
    const cur = getSettingsFormValues();
    try {
      await invoke("save_settings", {
        patch: {
          main_window_close_action: cur.action,
          desktop_lyrics_color_base: cur.base,
          desktop_lyrics_color_highlight: cur.highlight,
          lyrics_netease_api_base: cur.neteaseApiBase,
        },
      });
      mainWindowCloseAction = cur.action;
      syncSettingsFormBaselineFromDom();
      void broadcastDesktopLyricsColors();
    } catch (e) {
      alertRequestFailed(e, "save settings");
    }
  });
  document.getElementById("close-choice-tray")?.addEventListener("click", () => {
    void runCloseChoice("tray");
  });
  document.getElementById("close-choice-quit")?.addEventListener("click", () => {
    void runCloseChoice("quit");
  });
  document.getElementById("close-choice-cancel")?.addEventListener("click", () => closeCloseConfirmModal());
  document.getElementById("close-confirm-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "close-confirm-modal") closeCloseConfirmModal();
  });
}

function lyricsReplaceSourceLabel(src) {
  const s = String(src || "").toLowerCase();
  if (s === "qq") return "QQ";
  if (s === "kugou") return "酷狗";
  if (s === "netease") return "网易";
  if (s === "lrclib") return "LRCLIB";
  return src || "—";
}

function getLyricsReplaceSourcesFromChips() {
  const keys = [
    ["qq", "lyrics-replace-src-qq"],
    ["kugou", "lyrics-replace-src-kugou"],
    ["netease", "lyrics-replace-src-netease"],
    ["lrclib", "lyrics-replace-src-lrclib"],
  ];
  const out = [];
  for (const [id, elId] of keys) {
    const el = document.getElementById(elId);
    if (el && !el.disabled && el.checked) out.push(id);
  }
  return out;
}

function setLyricsReplaceError(msg) {
  const el = document.getElementById("lyrics-replace-error");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}

function closeLyricsReplaceModal() {
  const m = document.getElementById("lyrics-replace-modal");
  if (m) {
    m.hidden = true;
    m.setAttribute("aria-hidden", "true");
  }
  lyricsReplaceCandidates = [];
  lyricsReplaceSelectedIndex = -1;
  lyricsReplacePreviewPayload = null;
  setLyricsReplaceError("");
}

async function openLyricsReplaceModal() {
  const m = document.getElementById("lyrics-replace-modal");
  if (!m) return;
  m.hidden = false;
  m.setAttribute("aria-hidden", "false");
  const inp = document.getElementById("lyrics-replace-keyword");
  const cur = playQueue[playIndex];
  const kw = cur ? `${cur.artist || ""} ${cur.title || ""}`.trim() : "";
  if (inp) inp.value = kw;
  setLyricsReplaceError("");
  lyricsReplacePreviewPayload = null;
  lyricsReplaceCandidates = [];
  lyricsReplaceSelectedIndex = -1;
  const tbody = document.getElementById("lyrics-replace-tbody");
  if (tbody) setTableMutedMessage(tbody, 4, "输入关键词后点击「搜索」");
  const applyBtn = document.getElementById("lyrics-replace-apply");
  if (applyBtn) applyBtn.disabled = true;
  const prev = document.getElementById("lyrics-replace-preview");
  if (prev) prev.textContent = "";
  try {
    const s = await invoke("get_settings");
    const lr = document.getElementById("lyrics-replace-src-lrclib");
    const enabled = s.lyrics_lrclib_enabled !== false;
    if (lr) {
      lr.disabled = !enabled;
      lr.checked = enabled;
    }
  } catch (e) {
    console.warn("get_settings for lyrics replace", e);
  }
}

async function searchLyricsReplaceCandidates() {
  const searchBtn = document.getElementById("lyrics-replace-search-btn");
  if (searchBtn) searchBtn.disabled = true;
  try {
    lyricsReplaceFetchGen += 1;
    const inp = document.getElementById("lyrics-replace-keyword");
    const keyword = (inp?.value || "").trim();
    const tbody = document.getElementById("lyrics-replace-tbody");
    const applyBtn = document.getElementById("lyrics-replace-apply");
    if (applyBtn) applyBtn.disabled = true;
    lyricsReplacePreviewPayload = null;
    const prev = document.getElementById("lyrics-replace-preview");
    if (prev) prev.textContent = "";
    setLyricsReplaceError("");
    lyricsReplaceSelectedIndex = -1;
    if (!keyword) {
      setTableMutedMessage(tbody, 4, "请输入关键词");
      return;
    }
    const sources = getLyricsReplaceSourcesFromChips();
    if (!sources.length) {
      setTableMutedMessage(tbody, 4, "请至少选择一个来源");
      return;
    }
    const a = audioEl();
    const durationMs =
      a && a.duration && isFinite(a.duration) && a.duration > 0
        ? Math.round(a.duration * 1000)
        : null;
    setTableMutedMessage(tbody, 4, "搜索中…");
    try {
      lyricsReplaceCandidates = await invoke("lyrics_search_candidates", {
        keyword,
        durationMs,
        sources,
      });
    } catch (e) {
      console.warn("lyrics_search_candidates", e);
      setTableMutedMessage(tbody, 4, MSG_REQUEST_FAILED);
      setLyricsReplaceError(String(e));
      return;
    }
    renderLyricsReplaceTable();
    if (lyricsReplaceCandidates.length > 0) {
      await selectLyricsReplaceRow(0);
    } else {
      setTableMutedMessage(tbody, 4, "未找到结果");
      if (prev) prev.textContent = "未找到匹配歌词，请换关键词或来源。";
    }
  } finally {
    if (searchBtn) searchBtn.disabled = false;
  }
}

function renderLyricsReplaceTable() {
  const tbody = document.getElementById("lyrics-replace-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  for (let i = 0; i < lyricsReplaceCandidates.length; i++) {
    const c = lyricsReplaceCandidates[i];
    const tr = document.createElement("tr");
    tr.dataset.index = String(i);
    if (i === lyricsReplaceSelectedIndex) tr.classList.add("is-selected");
    const tdSrc = document.createElement("td");
    tdSrc.className = "col-lr-src";
    tdSrc.textContent = lyricsReplaceSourceLabel(c.source);
    const tdTitle = document.createElement("td");
    tdTitle.textContent = c.title || "—";
    const tdArtist = document.createElement("td");
    tdArtist.textContent = c.artist || "—";
    const tdDur = document.createElement("td");
    tdDur.className = "col-lr-dur";
    tdDur.textContent = formatDurationMs(c.durationMs);
    tr.append(tdSrc, tdTitle, tdArtist, tdDur);
    tr.addEventListener("click", () => {
      void selectLyricsReplaceRow(i);
    });
    tbody.appendChild(tr);
  }
}

async function selectLyricsReplaceRow(idx) {
  if (idx < 0 || idx >= lyricsReplaceCandidates.length) return;
  lyricsReplaceSelectedIndex = idx;
  const gen = ++lyricsReplaceFetchGen;
  const tbody = document.getElementById("lyrics-replace-tbody");
  if (tbody) {
    tbody.querySelectorAll("tr").forEach((tr, j) => {
      tr.classList.toggle("is-selected", j === idx);
    });
  }
  const applyBtn = document.getElementById("lyrics-replace-apply");
  if (applyBtn) applyBtn.disabled = true;
  lyricsReplacePreviewPayload = null;
  const prev = document.getElementById("lyrics-replace-preview");
  if (prev) prev.textContent = "加载中…";
  setLyricsReplaceError("");
  const cand = lyricsReplaceCandidates[idx];
  try {
    const raw = await invoke("lyrics_fetch_candidate", { candidate: cand });
    if (gen !== lyricsReplaceFetchGen) return;
    lyricsReplacePreviewPayload = raw;
    if (prev) prev.textContent = raw?.lrcText != null ? String(raw.lrcText) : "";
    if (applyBtn) applyBtn.disabled = !String(raw?.lrcText || "").trim();
  } catch (e) {
    console.warn("lyrics_fetch_candidate", e);
    if (gen !== lyricsReplaceFetchGen) return;
    if (prev) prev.textContent = "";
    setLyricsReplaceError(MSG_REQUEST_FAILED);
    if (applyBtn) applyBtn.disabled = true;
  }
}

async function applyLyricsReplace() {
  if (!lyricsReplacePreviewPayload) return;
  const lt = String(lyricsReplacePreviewPayload.lrcText || "");
  if (!lt.trim()) return;
  const cur = playQueue[playIndex];
  const cacheKey = cur?.local_path ? `local:${cur.local_path}` : (cur?.source_id || "").trim();
  lrcEntries = parseLrc(lt);
  wordLines = Array.isArray(lyricsReplacePreviewPayload.wordLines)
    ? lyricsReplacePreviewPayload.wordLines
    : null;
  lrcCacheKey = cacheKey;
  lyricsLog("lyrics replace apply: lines", lrcEntries.length, "wordLines", wordLines?.length ?? 0);
  await syncDesktopLyrics();
  closeLyricsReplaceModal();
}

function wireLyricsReplaceModal() {
  document.getElementById("btn-dock-lyrics-replace")?.addEventListener("click", (e) => {
    e.stopPropagation();
    void openLyricsReplaceModal();
  });
  document.getElementById("lyrics-replace-search-btn")?.addEventListener("click", () => {
    void searchLyricsReplaceCandidates();
  });
  document.getElementById("lyrics-replace-cancel")?.addEventListener("click", () => {
    closeLyricsReplaceModal();
  });
  document.getElementById("lyrics-replace-apply")?.addEventListener("click", () => {
    void applyLyricsReplace();
  });
  document.getElementById("lyrics-replace-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "lyrics-replace-modal") closeLyricsReplaceModal();
  });
  document.getElementById("lyrics-replace-keyword")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void searchLyricsReplaceCandidates();
    }
  });
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("lyrics-replace-modal");
    if (!modal || modal.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeLyricsReplaceModal();
    }
  });
}

function wireDockBar() {
  const modeBtn = document.getElementById("btn-play-mode");
  if (modeBtn) {
    const m0 = PLAY_MODES[playModeIndex];
    modeBtn.textContent = m0.label;
    modeBtn.title = m0.tip;
    modeBtn.addEventListener("click", () => {
      playModeIndex = (playModeIndex + 1) % PLAY_MODES.length;
      const mm = PLAY_MODES[playModeIndex];
      modeBtn.textContent = mm.label;
      modeBtn.title = mm.tip;
      setPlayerNavEnabled();
    });
  }

  const qBtn = document.getElementById("dock-quality");
  const qPop = document.getElementById("popover-quality");
  if (qBtn && qPop) {
    qBtn.textContent = QUALITY_LABELS[qualityPref] || "标准";
    qBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDockMenu(qPop);
    });
    qPop.querySelectorAll("[data-quality]").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        qualityPref = b.getAttribute("data-quality") || "128";
        qBtn.textContent = QUALITY_LABELS[qualityPref] || "标准";
        closeAllDockMenus();
      });
    });
  }

  document.getElementById("btn-dock-fav")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const cur = playQueue[playIndex];
    if (!cur) return;
    const sid = (cur.source_id || "").trim();
    if (!sid || cur.local_path) {
      alert("仅在线试听曲目支持「喜欢」（需曲库 id）。");
      return;
    }
    if (likedIds.has(sid)) likedIds.delete(sid);
    else likedIds.add(sid);
    saveLikedSet(likedIds);
    refreshFavButton();
  });

  document.getElementById("btn-dock-dl")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDockMenu(document.getElementById("popover-dl"));
  });
  document.getElementById("popover-dl")?.querySelectorAll("[data-dlq]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const q = b.getAttribute("data-dlq") || "128";
      closeAllDockMenus();
      const cur = playQueue[playIndex];
      if (!cur) {
        alert("当前没有播放曲目。");
        return;
      }
      void enqueueDownloadForTrack(
        { sourceId: cur.source_id, title: cur.title, artist: cur.artist },
        q
      );
    });
  });

  document.getElementById("btn-dock-more")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDockMenu(document.getElementById("popover-more"));
  });
  document.getElementById("btn-dock-settings")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDockMenus();
    setPage("settings");
  });
  document.querySelector('[data-more="add-pl"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDockMenus();
    alert("添加到歌单：待接入数据库与歌单页。");
  });
  document.querySelector('[data-more="rm-queue"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDockMenus();
    removeCurrentFromQueue();
  });

  document.getElementById("btn-more-lyrics-lock")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    closeAllDockMenus();
    desktopLyricsLocked = !desktopLyricsLocked;
    refreshLyricsLockMenuLabel();
    try {
      await invoke("save_settings", { patch: { desktop_lyrics_locked: desktopLyricsLocked } });
    } catch (err) {
      console.warn("save_settings desktop_lyrics_locked", err);
    }
    await broadcastDesktopLyricsLock();
  });

  document.getElementById("btn-dock-lyrics")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await toggleDesktopLyrics();
    } catch (err) {
      alertRequestFailed(err, "toggleDesktopLyrics");
    }
  });

  document.getElementById("btn-dock-queue")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleQueuePanel();
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".dock-menu-anchor") || e.target.closest(".dock-menu")) return;
    closeAllDockMenus();
  });

  wireLyricsReplaceModal();
}

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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function setTableMutedMessage(tbody, colSpan, message) {
  if (!tbody) return;
  tbody.innerHTML = "";
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colSpan;
  td.className = "muted";
  td.textContent = String(message ?? "");
  tr.appendChild(td);
  tbody.appendChild(tr);
}

/** ---------- 右键菜单（对齐 Py sidebar / import_track_context_menu） ---------- */

let contextMenuCleanup = null;

function closeContextMenu() {
  if (contextMenuCleanup) {
    contextMenuCleanup();
    contextMenuCleanup = null;
  }
}

function mountContextMenuAt(clientX, clientY, rootEl) {
  closeContextMenu();
  rootEl.classList.add("ctx-menu");
  Object.assign(rootEl.style, {
    position: "fixed",
    zIndex: "300",
    left: "0px",
    top: "0px",
  });
  document.body.appendChild(rootEl);
  const pad = 8;
  const place = () => {
    const r = rootEl.getBoundingClientRect();
    const left = Math.max(pad, Math.min(clientX, window.innerWidth - r.width - pad));
    const top = Math.max(pad, Math.min(clientY, window.innerHeight - r.height - pad));
    rootEl.style.left = `${left}px`;
    rootEl.style.top = `${top}px`;
  };
  place();

  const onDown = (e) => {
    if (rootEl.contains(e.target)) return;
    closeContextMenu();
  };
  const onKey = (e) => {
    if (e.key === "Escape") closeContextMenu();
  };
  const tid = window.setTimeout(() => {
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
  }, 0);
  contextMenuCleanup = () => {
    window.clearTimeout(tid);
    document.removeEventListener("mousedown", onDown, true);
    document.removeEventListener("keydown", onKey, true);
    rootEl.remove();
  };
}

function cmSep() {
  const d = document.createElement("div");
  d.className = "ctx-menu__sep";
  return d;
}

function cmBtn(label, onClick, disabled) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ctx-menu__item";
  b.textContent = label;
  if (disabled) b.disabled = true;
  else {
    b.addEventListener("click", () => {
      closeContextMenu();
      try {
        const ret = onClick();
        if (ret != null && typeof ret.then === "function") ret.catch((e) => alertRequestFailed(e, "ctx-menu"));
      } catch (e) {
        alertRequestFailed(e, "ctx-menu");
      }
    });
  }
  return b;
}

async function copyImportTrackInfoToClipboard({ title, artist, album, sourceId, coverUrl, localPath }) {
  const lines = [];
  if ((title || "").trim()) lines.push((title || "").trim());
  if ((artist || "").trim()) lines.push((artist || "").trim());
  if ((album || "").trim()) lines.push(`专辑：${(album || "").trim()}`);
  const sid = (sourceId || "").trim();
  if (sid) lines.push(`曲库 ID：${sid}`);
  const lp = (localPath || "").trim();
  if (lp) lines.push(`本地路径：${lp}`);
  const cu = (coverUrl || "").trim();
  if (cu) lines.push(`封面：${cu}`);
  const text = lines.join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    window.prompt("复制以下内容：", text);
  }
}

function searchResultToQueueItem(r) {
  return {
    source_id: r.source_id,
    title: r.title,
    artist: r.artist || "",
    album: r.album || "",
    cover_url: r.cover_url || null,
  };
}

function playlistImportRowToQueueItem(r) {
  const sid = (r.pjmp3_source_id || "").trim();
  if (!sid) return null;
  return {
    source_id: sid,
    title: r.title,
    artist: r.artist || "",
    album: r.album || "",
    cover_url: (r.cover_url || "").trim() || null,
  };
}

async function listPlaylistsCached() {
  try {
    return await invoke("list_playlists");
  } catch (e) {
    console.warn("list_playlists", e);
    return [];
  }
}

/** @param {{ sourceId?: string, title?: string, artist?: string }} track */
async function enqueueDownloadForTrack(track, quality) {
  const sid = (track.sourceId || "").trim();
  if (!sid) {
    alert("无曲库 id，无法下载。");
    return;
  }
  try {
    await invoke("enqueue_download", {
      job: {
        source_id: sid,
        title: track.title || "",
        artist: track.artist || "",
        quality,
      },
    });
  } catch (e) {
    alertRequestFailed(e, "enqueue_download");
  }
}

/** @param {{ sourceId?: string, title?: string, artist?: string }} track */
function buildDownloadSubmenu(track) {
  const dlRow = document.createElement("div");
  dlRow.className = "ctx-menu__row--sub";
  const dlFly = document.createElement("div");
  dlFly.className = "ctx-menu__fly";
  dlFly.textContent = "下载";
  const dlSub = document.createElement("div");
  dlSub.className = "ctx-menu__subpanel";
  for (const [label, q] of [
    ["FLAC", "flac"],
    ["高品质 320", "320"],
    ["标准 128", "128"],
  ]) {
    dlSub.appendChild(
      cmBtn(label, () => {
        void enqueueDownloadForTrack(track, q);
      })
    );
  }
  dlRow.appendChild(dlFly);
  dlRow.appendChild(dlSub);
  return dlRow;
}

/** @param {{ title: string, artist: string, album?: string, sourceId?: string, coverUrl?: string | null }} t */
function buildAddToSubmenu(t) {
  const addRow = document.createElement("div");
  addRow.className = "ctx-menu__row--sub";
  const fly = document.createElement("div");
  fly.className = "ctx-menu__fly";
  fly.textContent = "添加到";
  const sub = document.createElement("div");
  sub.className = "ctx-menu__subpanel";
  sub.appendChild(
    cmBtn("播放队列", () => {
      const qItem = {
        source_id: t.sourceId,
        title: t.title,
        artist: t.artist || "",
        album: t.album || "",
        cover_url: t.coverUrl || null,
      };
      if (!(qItem.source_id || "").trim()) {
        alert("该条没有曲库 id，无法加入播放队列。");
        return;
      }
      playQueue.push(qItem);
      renderQueuePanel();
    })
  );
  sub.appendChild(
    cmBtn("试听列表", () => {
      const qItem = {
        source_id: t.sourceId,
        title: t.title,
        artist: t.artist || "",
        album: t.album || "",
        cover_url: t.coverUrl || null,
      };
      if (!(qItem.source_id || "").trim()) {
        alert("该条没有曲库 id，无法加入播放队列。");
        return;
      }
      playQueue.push(qItem);
      renderQueuePanel();
    })
  );
  sub.appendChild(cmSep());
  sub.appendChild(
    cmBtn("添加到新歌单", async () => {
      const name = window.prompt("歌单名称（将写入 library.db）", "新歌单");
      if (!name || !name.trim()) return;
      const pid = await invoke("create_playlist", { name: name.trim() });
      await invoke("append_playlist_import_items", {
        playlistId: pid,
        items: [{ title: t.title, artist: t.artist || "", album: t.album || "" }],
      });
      await refreshSidebarPlaylists();
      await refreshPlaylistSelect();
    })
  );
  sub.appendChild(cmSep());
  return { addRow, fly, sub };
}

async function openSearchRowContextMenu(ev, rowIdx) {
  ev.preventDefault();
  if (rowIdx < 0 || rowIdx >= searchState.results.length) return;
  const r = searchState.results[rowIdx];
  const qItem = searchResultToQueueItem(r);
  const pls = await listPlaylistsCached();

  const root = document.createElement("div");
  root.appendChild(cmBtn("播放", () => playFromSearchRow(rowIdx)));
  root.appendChild(
    cmBtn("下一首播放", () => {
      if (!playQueue.length) {
        playQueue = [qItem];
        void playFromQueueIndex(0);
      } else {
        playQueue.splice(playIndex + 1, 0, qItem);
      }
      renderQueuePanel();
    })
  );
  root.appendChild(cmSep());

  const { addRow, fly, sub } = buildAddToSubmenu({
    title: r.title,
    artist: r.artist,
    album: r.album,
    sourceId: r.source_id,
    coverUrl: r.cover_url,
  });
  let any = false;
  for (const p of pls) {
    const pid = p.id;
    if (pid == null) continue;
    any = true;
    const name = (p.name || "").trim() || `#${pid}`;
    sub.appendChild(
      cmBtn(name, async () => {
        await invoke("append_playlist_import_items", {
          playlistId: pid,
          items: [{ title: r.title, artist: r.artist || "", album: r.album || "" }],
        });
        await refreshSidebarPlaylists();
      })
    );
  }
  if (!any) sub.appendChild(cmBtn("（暂无歌单，请先新建）", () => {}, true));
  addRow.appendChild(fly);
  addRow.appendChild(sub);
  root.appendChild(addRow);

  root.appendChild(
    buildDownloadSubmenu({ sourceId: r.source_id, title: r.title, artist: r.artist })
  );
  root.appendChild(cmBtn("分享", () => {}, true));
  root.appendChild(cmBtn("查看评论", () => {}, true));
  root.appendChild(cmSep());
  root.appendChild(
    cmBtn("复制歌曲信息", () =>
      copyImportTrackInfoToClipboard({
        title: r.title,
        artist: r.artist,
        album: r.album,
        sourceId: r.source_id,
        coverUrl: r.cover_url,
      })
    )
  );

  mountContextMenuAt(ev.clientX, ev.clientY, root);
}

async function openSidebarPlaylistContextMenu(ev, pl) {
  ev.preventDefault();
  const root = document.createElement("div");
  root.appendChild(
    cmBtn("播放", async () => {
      const rows = await invoke("list_playlist_import_items", { playlistId: pl.id });
      const playable = (rows || []).filter((x) => (x.pjmp3_source_id || "").trim());
      if (!playable.length) {
        alert("歌单为空或没有可播放条目（导入条目需含 pjmp3 曲库 id）。");
        return;
      }
      playQueue = playable.map((row) => ({
        source_id: (row.pjmp3_source_id || "").trim(),
        title: row.title,
        artist: row.artist || "",
        album: row.album || "",
        cover_url: (row.cover_url || "").trim() || null,
      }));
      playFromQueueIndex(0);
      renderQueuePanel();
    })
  );
  root.appendChild(
    cmBtn("重命名", async () => {
      const name = window.prompt("歌单名称", pl.name || "");
      if (!name || !name.trim()) return;
      await invoke("rename_playlist", { playlistId: pl.id, name: name.trim() });
      if (selectedPlaylistId === pl.id) selectedPlaylistName = name.trim();
      await refreshSidebarPlaylists();
      await refreshPlaylistSelect();
    })
  );
  root.appendChild(
    cmBtn("删除歌单", async () => {
      if (!window.confirm(`确定删除歌单「${(pl.name || "").trim() || pl.id}」？`)) return;
      await invoke("delete_playlist", { playlistId: pl.id });
      if (selectedPlaylistId === pl.id) {
        selectedPlaylistId = null;
        selectedPlaylistName = "";
      }
      await refreshSidebarPlaylists();
      await refreshPlaylistSelect();
      const plPage = document.querySelector('.page[data-page="playlist"]');
      if (plPage?.classList.contains("page-active")) setPage("discover");
    })
  );
  mountContextMenuAt(ev.clientX, ev.clientY, root);
}

async function openPlaylistDetailRowContextMenu(ev, rowIdx) {
  ev.preventDefault();
  const r = playlistDetailRows[rowIdx];
  if (!r) return;
  const sid = (r.pjmp3_source_id || "").trim();
  const item = playlistImportRowToQueueItem(r);
  const pls = await listPlaylistsCached();
  const ex = selectedPlaylistId;

  const root = document.createElement("div");
  root.appendChild(
    cmBtn(
      "播放",
      () => {
        if (!item) {
          alert("该条没有曲库 id，请使用「发现」搜索歌名后播放。");
          return;
        }
        playQueue = [item];
        playFromQueueIndex(0);
        renderQueuePanel();
      },
      !sid
    )
  );
  root.appendChild(
    cmBtn(
      "下一首播放",
      () => {
        if (!item) {
          alert("该条没有曲库 id，无法插播。");
          return;
        }
        if (!playQueue.length) {
          playQueue = [item];
          void playFromQueueIndex(0);
        } else {
          playQueue.splice(playIndex + 1, 0, item);
          renderQueuePanel();
        }
      },
      !sid
    )
  );
  root.appendChild(cmSep());

  const { addRow, fly, sub } = buildAddToSubmenu({
    title: r.title,
    artist: r.artist,
    album: r.album,
    sourceId: r.pjmp3_source_id,
    coverUrl: r.cover_url,
  });
  let any = false;
  for (const p of pls) {
    const pid = p.id;
    if (pid == null) continue;
    if (ex != null && Number(pid) === Number(ex)) continue;
    any = true;
    const name = (p.name || "").trim() || `#${pid}`;
    sub.appendChild(
      cmBtn(name, async () => {
        await invoke("append_playlist_import_items", {
          playlistId: pid,
          items: [{ title: r.title, artist: r.artist || "", album: r.album || "" }],
        });
        await refreshSidebarPlaylists();
      })
    );
  }
  if (!any) sub.appendChild(cmBtn("（暂无其它歌单）", () => {}, true));
  addRow.appendChild(fly);
  addRow.appendChild(sub);
  root.appendChild(addRow);

  root.appendChild(
    buildDownloadSubmenu({ sourceId: r.pjmp3_source_id, title: r.title, artist: r.artist })
  );
  root.appendChild(cmBtn("分享", () => {}, true));
  root.appendChild(cmBtn("查看评论", () => {}, true));
  root.appendChild(cmSep());
  root.appendChild(
    cmBtn("复制歌曲信息", () =>
      copyImportTrackInfoToClipboard({
        title: r.title,
        artist: r.artist,
        album: r.album,
        sourceId: r.pjmp3_source_id,
        coverUrl: r.cover_url,
      })
    )
  );

  if (r.id != null && r.id > 0 && selectedPlaylistId != null) {
    root.appendChild(cmSep());
    root.appendChild(
      cmBtn("删除", async () => {
        if (!window.confirm("从当前歌单中删除该条目？")) return;
        await invoke("delete_playlist_import_item", {
          playlistId: selectedPlaylistId,
          itemId: r.id,
        });
        await loadPlaylistDetail(selectedPlaylistId, selectedPlaylistName);
        await refreshPlaylistSelect();
      })
    );
  }

  mountContextMenuAt(ev.clientX, ev.clientY, root);
}

/** 本地曲库行 → 播放队列项 */
function localLibraryRowToQueueItem(r) {
  return {
    title: r.title || "",
    artist: r.artist || "",
    local_path: (r.file_path || "").trim(),
    cover_url: null,
  };
}

async function openLocalLibraryRowContextMenu(ev, rowIdx) {
  ev.preventDefault();
  const r = localLibraryRows[rowIdx];
  if (!r) return;
  const item = localLibraryRowToQueueItem(r);
  const pathOk = !!(item.local_path || "").trim();
  const pls = await listPlaylistsCached();

  const root = document.createElement("div");
  root.appendChild(
    cmBtn(
      "播放",
      () => {
        if (!pathOk) {
          alert("无有效本地文件路径。");
          return;
        }
        playQueue = [item];
        void playFromQueueIndex(0);
        renderQueuePanel();
      },
      !pathOk
    )
  );
  root.appendChild(
    cmBtn(
      "下一首播放",
      () => {
        if (!pathOk) {
          alert("无有效本地文件路径，无法插播。");
          return;
        }
        if (!playQueue.length) {
          playQueue = [item];
          void playFromQueueIndex(0);
        } else {
          playQueue.splice(playIndex + 1, 0, item);
        }
        renderQueuePanel();
      },
      !pathOk
    )
  );
  root.appendChild(cmSep());

  const addRow = document.createElement("div");
  addRow.className = "ctx-menu__row--sub";
  const fly = document.createElement("div");
  fly.className = "ctx-menu__fly";
  fly.textContent = "添加到";
  const sub = document.createElement("div");
  sub.className = "ctx-menu__subpanel";
  sub.appendChild(
    cmBtn("播放队列", () => {
      if (!pathOk) {
        alert("无有效本地文件路径。");
        return;
      }
      playQueue.push(item);
      renderQueuePanel();
    })
  );
  sub.appendChild(
    cmBtn("试听列表", () => {
      if (!pathOk) {
        alert("无有效本地文件路径。");
        return;
      }
      playQueue.push(item);
      renderQueuePanel();
    })
  );
  sub.appendChild(cmSep());
  sub.appendChild(
    cmBtn("添加到新歌单", async () => {
      const name = window.prompt("歌单名称（将写入 library.db）", "新歌单");
      if (!name || !name.trim()) return;
      const pid = await invoke("create_playlist", { name: name.trim() });
      await invoke("append_playlist_import_items", {
        playlistId: pid,
        items: [{ title: r.title, artist: r.artist || "", album: r.album || "" }],
      });
      await refreshSidebarPlaylists();
      await refreshPlaylistSelect();
    })
  );
  sub.appendChild(cmSep());
  let any = false;
  for (const p of pls) {
    const pid = p.id;
    if (pid == null) continue;
    any = true;
    const name = (p.name || "").trim() || `#${pid}`;
    sub.appendChild(
      cmBtn(name, async () => {
        await invoke("append_playlist_import_items", {
          playlistId: pid,
          items: [{ title: r.title, artist: r.artist || "", album: r.album || "" }],
        });
        await refreshSidebarPlaylists();
      })
    );
  }
  if (!any) sub.appendChild(cmBtn("（暂无歌单，请先新建）", () => {}, true));
  addRow.appendChild(fly);
  addRow.appendChild(sub);
  root.appendChild(addRow);

  root.appendChild(cmBtn("下载", () => {}, true));
  root.appendChild(cmBtn("分享", () => {}, true));
  root.appendChild(cmBtn("查看评论", () => {}, true));
  root.appendChild(cmSep());
  root.appendChild(
    cmBtn("复制歌曲信息", () =>
      copyImportTrackInfoToClipboard({
        title: r.title,
        artist: r.artist,
        album: r.album,
        sourceId: "",
        coverUrl: null,
        localPath: r.file_path,
      })
    )
  );

  mountContextMenuAt(ev.clientX, ev.clientY, root);
}

/** 歌词：与 Rust `eprintln!("[lyrics] …")` 对应，便于在控制台过滤 */
function lyricsLog(...args) {
  console.info("[lyrics]", ...args);
}

function parseLrc(text) {
  const lines = [];
  /**
   * 与 amll_lyric stringify_lrc 一致：`[mm:ss.mmm]`，分钟可为任意位数（≥100 时旧版 \d{1,2} 会匹配失败）。
   * 小数部分用 `.` 或 `,`（部分 LRC 使用逗号作小数点）。
   */
  const timeRe = /\[(\d+):(\d{1,2})(?:[.,](\d{1,3}))?\]/;
  const raw = String(text || "").replace(/^\uFEFF/, "");
  for (let line of raw.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    const m = line.match(timeRe);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    let sec = parseInt(m[2], 10);
    if (sec > 59) sec = 59;
    const frac = m[3] ? m[3].padEnd(3, "0").slice(0, 3) : "000";
    const ms = parseInt(frac, 10);
    const t = min * 60 + sec + ms / 1000;
    const afterTag = line.slice(line.indexOf(m[0]) + m[0].length).trim();
    let rest = afterTag.replace(/^\[[^\]]+\]\s*/g, "").trim();
    if (!rest) rest = afterTag;
    /** 纯时间戳行也要保留，否则 instrumental / amll 空词行会变成「0 行」无法缓存 */
    lines.push({ t, text: rest });
  }
  lines.sort((a, b) => a.t - b.t);
  lyricsLog("parseLrc: timed lines", lines.length, "raw length", (text && text.length) || 0);
  return lines;
}

/** 桌面歌词：左上 / 右下两行布局不变；第 1、3、5… 句在左上逐字唱，第 2、4、6… 句在右下逐字唱，另一行显示上一句（全高亮）或下一句预览（全未唱色）。 */
function lyricDisplayForDesktop(ct) {
  const cur = playQueue[playIndex];
  const t = Number(ct) || 0;
  if (!cur) {
    return {
      line1: "—",
      line2: "—",
      activeSlot: 1,
      line1StartT: 0,
      line1EndT: 1,
      line2StartT: 0,
      line2EndT: 1,
      line1Words: null,
      line2Words: null,
      audioNow: t,
    };
  }
  if (!lrcEntries.length) {
    return {
      line1: cur.title || "—",
      line2: cur.artist || "在线试听",
      activeSlot: 1,
      line1StartT: 0,
      line1EndT: 1,
      line2StartT: 0,
      line2EndT: 1,
      line1Words: null,
      line2Words: null,
      audioNow: t,
    };
  }
  let idx = 0;
  for (let k = 0; k < lrcEntries.length; k++) {
    if (lrcEntries[k].t <= t + 0.12) idx = k;
    else break;
  }
  const curLine = lrcEntries[idx];
  const prevLine = idx > 0 ? lrcEntries[idx - 1] : null;
  const nextLine = lrcEntries[idx + 1];
  const startT = curLine?.t ?? 0;
  const endT = nextLine ? nextLine.t : startT + 4;
  const wl = wordLines;

  if (idx % 2 === 0) {
    const line1 = curLine?.text || "—";
    const line2 = nextLine?.text || "\u00a0";
    return {
      line1,
      line2,
      activeSlot: 1,
      line1StartT: startT,
      line1EndT: endT,
      line2StartT: 0,
      line2EndT: 0,
      line1Words: wl?.[idx] ?? null,
      line2Words: nextLine ? wl?.[idx + 1] ?? null : null,
      audioNow: t,
    };
  }
  const line1 = prevLine?.text || "\u00a0";
  const line2 = curLine?.text || "—";
  return {
    line1,
    line2,
    activeSlot: 2,
    line1StartT: 0,
    line1EndT: 0,
    line2StartT: startT,
    line2EndT: endT,
    line1Words: prevLine ? wl?.[idx - 1] ?? null : null,
    line2Words: wl?.[idx] ?? null,
    audioNow: t,
  };
}

const LYRICS_WW_TARGET = { kind: "WebviewWindow", label: "lyrics" };

async function broadcastDesktopLyricsLock() {
  /** 同步锁定状态到歌词子窗；歌词窗内 `setIgnoreCursorEvents` 实现完全穿透，解锁仅本菜单 */
  if (desktopLyricsOpen) {
    try {
      /** `WebviewWindow.emit` 走全局 broadcast，子 Webview 常收不到；`emitTo(WebviewWindow)` 定向投递 */
      await emitTo(LYRICS_WW_TARGET, "desktop-lyrics-lock", { locked: desktopLyricsLocked });
    } catch (e) {
      console.warn("emit desktop-lyrics-lock", e);
    }
  }
}

async function broadcastDesktopLyricsColors() {
  if (!desktopLyricsOpen) return;
  try {
    const s = await invoke("get_settings");
    await emitTo(LYRICS_WW_TARGET, "desktop-lyrics-colors", {
      base: s.desktop_lyrics_color_base || s.desktopLyricsColorBase || "#ffffff",
      highlight: s.desktop_lyrics_color_highlight || s.desktopLyricsColorHighlight || "#ffb7d4",
    });
  } catch (e) {
    console.warn("emit desktop-lyrics-colors", e);
  }
}

function refreshLyricsLockMenuLabel() {
  const btn = document.getElementById("btn-more-lyrics-lock");
  if (!btn) return;
  btn.textContent = desktopLyricsLocked
    ? "桌面歌词：已锁定（穿透点击）— 点此解锁"
    : "桌面歌词：未锁定（可拖动）— 点此锁定";
}

async function pushDesktopLyricsLines({
  line1,
  line2,
  activeSlot = 1,
  line1StartT,
  line1EndT,
  line2StartT,
  line2EndT,
  line1Words = null,
  line2Words = null,
  audioNow,
}) {
  if (!desktopLyricsOpen) return;
  try {
    const win = desktopLyricsWindow || (await WebviewWindow.getByLabel("lyrics"));
    if (win) desktopLyricsWindow = win;
    await emitTo(LYRICS_WW_TARGET, "desktop-lyrics-lines", {
      line1: line1 || "—",
      line2: line2 || "—",
      activeSlot: activeSlot === 2 ? 2 : 1,
      line1StartT: Number(line1StartT) || 0,
      line1EndT: Number(line1EndT) || 0,
      line2StartT: Number(line2StartT) || 0,
      line2EndT: Number(line2EndT) || 0,
      line1Words: line1Words ?? null,
      line2Words: line2Words ?? null,
      audioNow: Number(audioNow) || 0,
    });
  } catch (e) {
    console.warn("emit lyrics", e);
    desktopLyricsOpen = false;
    desktopLyricsWindow = null;
    document.getElementById("btn-dock-lyrics")?.classList.remove("is-on");
  }
}

/**
 * @param {number | undefined} loadGen 传入发起播放时的 `playLoadGeneration`，用于丢弃过期异步结果；省略则仅按当前队列校验
 */
async function ensureLrcLoadedForCurrentTrack(loadGen) {
  const cur = playQueue[playIndex];
  if (!cur) {
    lyricsLog("ensureLrc: no current track");
    const a = audioEl();
    await pushDesktopLyricsLines({
      line1: "—",
      line2: "—",
      activeSlot: 1,
      line1StartT: 0,
      line1EndT: 1,
      line2StartT: 0,
      line2EndT: 0,
      audioNow: a?.currentTime ?? 0,
    });
    return;
  }
  const cacheKey = cur.local_path ? `local:${cur.local_path}` : (cur.source_id || "").trim();
  if (lrcCacheKey === cacheKey) {
    lyricsLog("ensureLrc: cache hit", cacheKey);
    return;
  }
  try {
    const a = audioEl();
    const dur = a && a.duration && isFinite(a.duration) && a.duration > 0 ? a.duration : null;
    lyricsLog("ensureLrc: fetching", {
      cacheKey,
      title: cur.title,
      artist: cur.artist,
      sourceId: (cur.source_id || "").trim() || null,
      localPath: cur.local_path || null,
      durationSeconds: dur,
      loadGen: loadGen ?? "(omit)",
    });
    const raw = await invoke("fetch_song_lrc_enriched", {
      req: {
        pjmp3SourceId: cur.local_path ? null : (cur.source_id || "").trim() || null,
        title: cur.title || "",
        artist: cur.artist || "",
        album: cur.album || "",
        localPath: cur.local_path || null,
        durationSeconds: dur,
      },
    });
    if (loadGen !== undefined && loadGen !== playLoadGeneration) return;
    const cur2 = playQueue[playIndex];
    if (!isSamePlayableIdentity(cur2, cur)) {
      lyricsLog("ensureLrc: stale generation or track changed after fetch, discard");
      return;
    }
    if (raw && typeof raw === "object" && raw.lrcText != null) {
      const lt = String(raw.lrcText);
      lyricsLog("ensureLrc: got payload chars", lt.length, "wordLines", raw.wordLines?.length ?? 0);
      lrcEntries = parseLrc(lt);
      wordLines = Array.isArray(raw.wordLines) ? raw.wordLines : null;
      lyricsLog("ensureLrc: lrcEntries length", lrcEntries.length);
      if (lrcEntries.length > 0) {
        lrcCacheKey = cacheKey;
      } else {
        wordLines = null;
        lyricsLog("ensureLrc: parse produced 0 lines, not caching (will retry on next load)");
      }
    } else if (raw && typeof raw === "string") {
      lyricsLog("ensureLrc: got raw string chars", raw.length);
      lrcEntries = parseLrc(raw);
      wordLines = null;
      lyricsLog("ensureLrc: lrcEntries length", lrcEntries.length);
      if (lrcEntries.length > 0) {
        lrcCacheKey = cacheKey;
      } else {
        lyricsLog("ensureLrc: parse produced 0 lines, not caching (will retry on next load)");
      }
    } else {
      lrcCacheKey = cacheKey;
      lrcEntries = [];
      wordLines = null;
      lyricsLog("ensureLrc: no raw lyrics (null/empty)");
    }
  } catch (e) {
    console.warn("[lyrics] fetch_song_lrc_enriched", e);
    if (loadGen !== undefined && loadGen !== playLoadGeneration) return;
    const cur2 = playQueue[playIndex];
    if (!isSamePlayableIdentity(cur2, cur)) {
      lyricsLog("ensureLrc: error path discard (track changed)");
      return;
    }
    lrcCacheKey = cacheKey;
    lrcEntries = [];
    wordLines = null;
    lyricsLog("ensureLrc: error, cleared lrcEntries");
  }
}

async function syncDesktopLyrics() {
  if (!desktopLyricsOpen) return;
  const ct = audioEl()?.currentTime ?? 0;
  const data = lyricDisplayForDesktop(ct);
  await pushDesktopLyricsLines(data);
}

async function setDockLyricsActive(on) {
  document.getElementById("btn-dock-lyrics")?.classList.toggle("is-on", on);
}

function isSamePlayableIdentity(a, b) {
  if (!a || !b) return false;
  return (
    (a.local_path || "") === (b.local_path || "") &&
    (a.source_id || "").trim() === (b.source_id || "").trim()
  );
}

function formatNowPlayingSubtitle(track) {
  if (track?.local_path) {
    return track?.artist ? `${track.artist} · 本地` : "本地音乐";
  }
  return track?.artist ? `${track.artist} · 在线试听` : "在线试听";
}

function formatLoadingSubtitle(track) {
  const base = track?.local_path
    ? track?.artist
      ? `${track.artist}`
      : "本地音乐"
    : track?.artist
      ? `${track.artist}`
      : "在线试听";
  return `${base} · ${track?.local_path ? "正在加载本地文件…" : "正在拉取音频…"}`;
}

function scheduleDesktopLyricsStyleSync() {
  queueMicrotask(() => {
    void broadcastDesktopLyricsLock();
    void broadcastDesktopLyricsColors();
  });
}

function defaultDesktopLyricsBounds() {
  const width = Math.min(720, window.screen.availWidth - 40);
  const x = Math.max(0, Math.floor((window.screen.availWidth - width) / 2));
  return { x, y: 48, width, height: 132 };
}

/** @param {any} s settings 对象（get_settings 返回值） */
function desktopLyricsBoundsFromSettings(s) {
  const d = defaultDesktopLyricsBounds();
  let x = typeof s?.desktop_lyrics_x === "number" ? s.desktop_lyrics_x : d.x;
  let y = typeof s?.desktop_lyrics_y === "number" ? s.desktop_lyrics_y : d.y;
  let width = typeof s?.desktop_lyrics_width === "number" ? s.desktop_lyrics_width : d.width;
  let height = typeof s?.desktop_lyrics_height === "number" ? s.desktop_lyrics_height : d.height;
  const maxW = Math.max(320, window.screen.availWidth - 8);
  const maxH = Math.max(88, window.screen.availHeight - 8);
  width = Math.max(320, Math.min(Math.round(width), maxW));
  height = Math.max(88, Math.min(Math.round(height), maxH));
  x = Math.min(Math.max(0, Math.round(x)), Math.max(0, window.screen.availWidth - 48));
  y = Math.min(Math.max(0, Math.round(y)), Math.max(0, window.screen.availHeight - 48));
  return { x, y, width, height };
}

async function persistDesktopLyricsVisible(visible) {
  try {
    await invoke("save_settings", { patch: { desktop_lyrics_visible: visible } });
  } catch (e) {
    console.warn("save_settings desktop_lyrics_visible", e);
  }
}

function desktopLyricsWindowOptions(bounds) {
  return {
    url: "/desktop_lyrics.html",
    title: "桌面歌词",
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    resizable: true,
    maximizable: false,
    alwaysOnTop: true,
    decorations: false,
    transparent: true,
    /** 无边框窗口在 Windows 上默认可能有系统阴影，易看成「白边」 */
    shadow: false,
    skipTaskbar: true,
    focus: true,
  };
}

async function onDesktopLyricsShown(persistVisible) {
  desktopLyricsOpen = true;
  await setDockLyricsActive(true);
  if (persistVisible) {
    await persistDesktopLyricsVisible(true);
  }
  lrcCacheKey = null;
  await ensureLrcLoadedForCurrentTrack(playLoadGeneration);
  await syncDesktopLyrics();
  scheduleDesktopLyricsStyleSync();
}

function bindDesktopLyricsWindowLifecycle(
  win,
  { persistVisibleOnCreate = false, showCreateAlert = false } = {}
) {
  win.once("tauri://error", (e) => {
    console.error(e);
    if (showCreateAlert) {
      alert("无法创建桌面歌词窗口（请确认已授予 webview 创建权限）。");
    }
  });
  win.once("tauri://created", async () => {
    desktopLyricsWindow = win;
    win.once("tauri://destroyed", async () => {
      desktopLyricsOpen = false;
      desktopLyricsWindow = null;
      await setDockLyricsActive(false);
      await persistDesktopLyricsVisible(false);
    });
    await onDesktopLyricsShown(persistVisibleOnCreate);
  });
}

/** 启动时若上次为显示状态则打开歌词窗 */
async function openDesktopLyricsFromSettingsIfNeeded(s) {
  if (!s?.desktop_lyrics_visible) return;
  const existing = await WebviewWindow.getByLabel("lyrics");
  if (existing) {
    desktopLyricsWindow = existing;
    const vis = await existing.isVisible();
    if (!vis) await existing.show();
    await existing.setFocus();
    await onDesktopLyricsShown(false);
    return;
  }
  const b = desktopLyricsBoundsFromSettings(s);
  const win = new WebviewWindow("lyrics", desktopLyricsWindowOptions(b));
  bindDesktopLyricsWindowLifecycle(win, { persistVisibleOnCreate: false });
}

async function toggleDesktopLyrics() {
  const existing = desktopLyricsWindow || (await WebviewWindow.getByLabel("lyrics"));
  if (existing) desktopLyricsWindow = existing;
  if (existing) {
    const vis = await existing.isVisible();
    if (vis) {
      await existing.hide();
      desktopLyricsOpen = false;
      await setDockLyricsActive(false);
      await persistDesktopLyricsVisible(false);
      return;
    }
    await existing.show();
    await existing.setFocus();
    await onDesktopLyricsShown(true);
    return;
  }

  let bounds = defaultDesktopLyricsBounds();
  try {
    const s = await invoke("get_settings");
    bounds = desktopLyricsBoundsFromSettings(s);
  } catch (e) {
    console.warn("get_settings for lyrics bounds", e);
  }

  const win = new WebviewWindow("lyrics", desktopLyricsWindowOptions(bounds));
  bindDesktopLyricsWindowLifecycle(win, { persistVisibleOnCreate: true, showCreateAlert: true });
}

async function refreshPlaylistSelect() {
  const sel = document.getElementById("import-merge-playlist");
  const mergeBtn = document.getElementById("btn-import-merge");
  if (!sel) {
    await refreshSidebarPlaylists();
    return;
  }
  sel.innerHTML = "";
  const pls = await listPlaylistsCached();
  for (const p of pls) {
    const o = document.createElement("option");
    o.value = String(p.id);
    o.textContent = `${p.name} (id=${p.id})`;
    sel.appendChild(o);
  }
  const hasPl = pls.length > 0;
  sel.disabled = !hasPl;
  if (mergeBtn) mergeBtn.disabled = !hasPl || importTracks.length === 0;
  await refreshSidebarPlaylists();
}

async function refreshSidebarPlaylists() {
  const ul = document.getElementById("sidebar-playlist-list");
  if (!ul) return;
  ul.innerHTML = "";
  let pls = [];
  try {
    pls = await invoke("list_playlists");
  } catch (e) {
    warnRequestFailed(e, "list_playlists sidebar");
    const li = document.createElement("li");
    li.className = "sidebar-pl-empty muted";
    li.textContent = MSG_REQUEST_FAILED;
    ul.appendChild(li);
    return;
  }
  if (!pls.length) {
    const li = document.createElement("li");
    li.className = "sidebar-pl-empty muted";
    li.textContent =
      "暂无歌单 · 与 Py 版共用 ~/.cloudplayer/library.db · 在此页「保存为新歌单」即可出现";
    ul.appendChild(li);
    return;
  }
  for (const p of pls) {
    const li = document.createElement("li");
    li.className = "sidebar-pl-item";
    if (selectedPlaylistId === p.id) li.classList.add("is-active");
    li.textContent = p.name?.trim() || `歌单 ${p.id}`;
    li.title = `id=${p.id} · 查看导入曲目`;
    li.addEventListener("click", () => {
      selectedPlaylistId = p.id;
      selectedPlaylistName = p.name || "";
      ul.querySelectorAll(".sidebar-pl-item").forEach((x) => x.classList.remove("is-active"));
      li.classList.add("is-active");
      setPage("playlist");
    });
    li.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      void openSidebarPlaylistContextMenu(ev, p);
    });
    ul.appendChild(li);
  }
}

async function loadPlaylistDetail(id, name) {
  selectedPlaylistId = id;
  selectedPlaylistName = name || "";
  const titleEl = document.getElementById("playlist-page-title");
  if (titleEl) titleEl.textContent = name || "歌单";
  try {
    const rows = await invoke("list_playlist_import_items", { playlistId: id });
    playlistDetailRows = rows || [];
  } catch (e) {
    playlistDetailRows = [];
    alertRequestFailed(e, "list_playlist_import_items");
  }
  renderPlaylistDetailTable();
}

function renderPlaylistDetailTable() {
  const tbody = document.querySelector("#playlist-detail-table tbody");
  const btnAll = document.getElementById("btn-playlist-play-all");
  const coverEl = document.getElementById("playlist-hero-cover");
  const countEl = document.getElementById("playlist-track-count");
  const hintEl = document.getElementById("playlist-page-hint");
  if (!tbody) return;
  tbody.innerHTML = "";
  const playable = playlistDetailRows.filter((r) => (r.pjmp3_source_id || "").trim());
  if (btnAll) btnAll.disabled = playable.length === 0;
  if (countEl) countEl.textContent = `共 ${playlistDetailRows.length} 首导入曲目`;
  if (hintEl) hintEl.textContent = `CloudPlayer · ${selectedPlaylistName || "导入歌单"}`;
  const heroCover =
    playlistDetailRows.find((r) => (r.cover_url || "").trim())?.cover_url ||
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect fill='%23d1d5db' width='120' height='120' rx='12'/%3E%3C/svg%3E";
  if (coverEl) coverEl.src = heroCover;

  if (!playlistDetailRows.length) {
    setTableMutedMessage(tbody, 5, "暂无导入曲目，或请从左侧选择其它歌单。");
    return;
  }

  playlistDetailRows.forEach((r, i) => {
    const tr = document.createElement("tr");
    const sid = (r.pjmp3_source_id || "").trim();
    const ok = !!sid;
    const cover = (r.cover_url || "").trim();
    const liked = ok && likedIds.has(sid);
    const dur = formatDurationMs(r.duration_ms);
    const titleHtml = r.artist
      ? `<span class="t-title">${escapeHtml(r.title || "—")}</span><span class="t-art">${escapeHtml(r.artist)}</span>`
      : `<span class="t-title">${escapeHtml(r.title || "—")}</span>`;
    const coverHtml = cover
      ? `<img class="row-cover" src="${escapeHtml(cover)}" alt="" width="40" height="40" loading="lazy" />`
      : `<div class="row-cover-ph" aria-hidden="true"></div>`;
    tr.innerHTML = `
      <td class="col-cover">${coverHtml}</td>
      <td>${titleHtml}</td>
      <td class="muted">${escapeHtml(r.album || "—")}</td>
      <td class="col-like muted">${liked ? "♥" : "♡"}</td>
      <td class="muted col-dur">${dur}</td>`;
    tr.style.cursor = ok ? "pointer" : "default";
    tr.title = ok ? "双击从该曲起播整单（仅含曲库 id 的曲目入队）" : "无曲库 id：请到「发现」搜索后播放";
    if (ok) {
      tr.addEventListener("dblclick", () => playFromPlaylistRow(i));
    }
    tr.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      void openPlaylistDetailRowContextMenu(ev, i);
    });
    tbody.appendChild(tr);
  });
}

function playFromPlaylistRow(rowIdx) {
  const r = playlistDetailRows[rowIdx];
  const sid = (r?.pjmp3_source_id || "").trim();
  if (!sid) {
    alert("该条没有曲库 id，请使用顶栏搜索歌名后播放。");
    return;
  }
  const queue = playlistDetailRows
    .filter((row) => (row.pjmp3_source_id || "").trim())
    .map((row) => ({
      source_id: (row.pjmp3_source_id || "").trim(),
      title: row.title,
      artist: row.artist || "",
      album: row.album || "",
      cover_url: (row.cover_url || "").trim() || null,
    }));
  if (!queue.length) {
    alert("没有可播放条目（导入条目需含 pjmp3 曲库 id）。");
    return;
  }
  let startInQueue = 0;
  for (let i = 0; i < rowIdx; i++) {
    if ((playlistDetailRows[i].pjmp3_source_id || "").trim()) startInQueue++;
  }
  playQueue = queue;
  playFromQueueIndex(startInQueue);
  renderQueuePanel();
}

function wirePlaylistPage() {
  document.getElementById("btn-playlist-back")?.addEventListener("click", () => {
    setPage("discover");
  });
  document.getElementById("btn-playlist-play-all")?.addEventListener("click", () => {
    const playable = playlistDetailRows.filter((r) => (r.pjmp3_source_id || "").trim());
    if (!playable.length) {
      alert("没有可播放条目（导入条目需含 pjmp3 曲库 id；可先使用「发现」搜索）。");
      return;
    }
    playQueue = playable.map((r) => ({
      source_id: (r.pjmp3_source_id || "").trim(),
      title: r.title,
      artist: r.artist || "",
      album: r.album || "",
      cover_url: (r.cover_url || "").trim() || null,
    }));
    playFromQueueIndex(0);
    renderQueuePanel();
  });
}

function renderImportTable() {
  const tbody = document.querySelector("#import-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  importTracks.forEach((t, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-idx">${i + 1}</td>
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(t.artist)}</td>
      <td class="muted">${escapeHtml(t.album || "—")}</td>`;
    tbody.appendChild(tr);
  });
  const has = importTracks.length > 0;
  document.getElementById("btn-import-export-txt")?.toggleAttribute("disabled", !has);
  document.getElementById("btn-import-export-csv")?.toggleAttribute("disabled", !has);
  document.getElementById("btn-import-save-new")?.toggleAttribute("disabled", !has);
  const mergeBtn = document.getElementById("btn-import-merge");
  const sel = document.getElementById("import-merge-playlist");
  const nOpt = sel && sel.options ? sel.options.length : 0;
  if (mergeBtn) mergeBtn.disabled = !has || !nOpt;
}

function wireImportPage() {
  document.getElementById("btn-import-parse")?.addEventListener("click", async () => {
    const raw = document.getElementById("import-text")?.value?.trim() ?? "";
    if (!raw) return;
    const fmt = document.getElementById("import-fmt")?.value ?? "auto";
    try {
      const rows = await invoke("parse_import_text", { text: raw, fmt });
      importTracks = rows || [];
      importShareSuggestedName = "";
      const shareSt = document.getElementById("import-share-status");
      if (shareSt) shareSt.textContent = "";
      renderImportTable();
      await refreshPlaylistSelect();
      alert(`共解析 ${importTracks.length} 条。`);
    } catch (e) {
      alertRequestFailed(e, "parse_import_text");
    }
  });

  document.getElementById("btn-import-export-txt")?.addEventListener("click", () => {
    if (!importTracks.length) return;
    triggerBlobDownload("playlist.txt", buildImportTxtBlob(importTracks));
  });

  document.getElementById("btn-import-export-csv")?.addEventListener("click", () => {
    if (!importTracks.length) return;
    triggerBlobDownload("playlist.csv", buildImportCsvBlobUtf8(importTracks));
  });

  document.getElementById("btn-import-save-new")?.addEventListener("click", async () => {
    if (!importTracks.length) return;
    const defaultName = (importShareSuggestedName && importShareSuggestedName.trim()) || "导入歌单";
    const name = window.prompt("歌单名称（将写入 library.db）", defaultName);
    if (!name || !name.trim()) return;
    try {
      const id = await invoke("create_playlist", { name: name.trim() });
      await invoke("replace_playlist_import_items", {
        playlistId: id,
        items: importTracks.map((t) => ({
          title: t.title,
          artist: t.artist,
          album: t.album || "",
        })),
      });
      alert(`已创建歌单「${name.trim()}」，共 ${importTracks.length} 首导入条目。`);
      await refreshPlaylistSelect();
    } catch (e) {
      alertRequestFailed(e, "import save playlist");
    }
  });

  document.getElementById("btn-import-share")?.addEventListener("click", async () => {
    const input = document.getElementById("import-share-url");
    const url = input?.value?.trim() ?? "";
    const st = document.getElementById("import-share-status");
    const btn = document.getElementById("btn-import-share");
    if (!url) {
      alert("请先粘贴分享链接。");
      return;
    }
    if (st) st.textContent = "正在拉取歌单，请稍候…";
    if (btn) btn.disabled = true;
    try {
      const res = await invoke("fetch_share_playlist", { url });
      importTracks = res.tracks || [];
      importShareSuggestedName = res.playlist_name || res.playlistName || "";
      renderImportTable();
      await refreshPlaylistSelect();
      const n = importTracks.length;
      const pn = importShareSuggestedName || "—";
      if (st) st.textContent = `已拉取 ${n} 首 · ${pn}`;
      alert(`已拉取「${pn}」共 ${n} 首。可导出、保存为新歌单或合并到已有歌单。`);
    } catch (e) {
      if (st) st.textContent = "";
      alertRequestFailed(e, "fetch_share_playlist");
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById("import-share-url")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("btn-import-share")?.click();
    }
  });

  document.getElementById("btn-import-merge")?.addEventListener("click", async () => {
    if (!importTracks.length) return;
    const sel = document.getElementById("import-merge-playlist");
    const pid = sel && sel.value ? Number(sel.value) : NaN;
    if (!Number.isFinite(pid)) {
      alert("请先用「保存为新歌单」创建歌单，或检查合并目标下拉框。");
      return;
    }
    try {
      await invoke("append_playlist_import_items", {
        playlistId: pid,
        items: importTracks.map((t) => ({
          title: t.title,
          artist: t.artist,
          album: t.album || "",
        })),
      });
      alert(`已向所选歌单追加 ${importTracks.length} 首。`);
      await refreshSidebarPlaylists();
      if (selectedPlaylistId === pid) {
        void loadPlaylistDetail(pid, selectedPlaylistName);
      }
    } catch (e) {
      alertRequestFailed(e, "append_playlist_import_items");
    }
  });
}

function audioEl() {
  return document.getElementById("audio-player");
}

function formatTime(sec) {
  if (sec == null || !isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDurationMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "--";
  return formatTime(n / 1000);
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function renderSidebar() {
  const el = document.getElementById("sidebar");
  el.innerHTML = "";
  const logo = document.createElement("div");
  logo.className = "sidebar-logo";
  logo.textContent = "CloudPlayer";
  el.appendChild(logo);
  for (const item of NAV) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-item";
    btn.dataset.page = item.id;
    btn.textContent = item.label;
    btn.addEventListener("click", () => setPage(item.id));
    el.appendChild(btn);
  }
  const div = document.createElement("div");
  div.className = "sidebar-divider";
  el.appendChild(div);
  const plWrap = document.createElement("div");
  plWrap.className = "sidebar-playlist-section";
  const plHead = document.createElement("div");
  plHead.className = "sidebar-playlist-header";
  const plTitle = document.createElement("div");
  plTitle.className = "sidebar-playlist-title";
  plTitle.textContent = "我的歌单";
  const btnAdd = document.createElement("button");
  btnAdd.type = "button";
  btnAdd.id = "btn-sidebar-new-playlist";
  btnAdd.className = "sidebar-pl-add";
  btnAdd.title = "新建歌单";
  btnAdd.setAttribute("aria-label", "新建歌单");
  btnAdd.textContent = "+";
  btnAdd.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = window.prompt("新歌单名称", "新歌单");
    if (name == null || !String(name).trim()) return;
    try {
      await invoke("create_playlist", { name: name.trim() });
      await refreshSidebarPlaylists();
    } catch (err) {
      alertRequestFailed(err, "create_playlist sidebar");
    }
  });
  plHead.appendChild(plTitle);
  plHead.appendChild(btnAdd);
  const ul = document.createElement("ul");
  ul.id = "sidebar-playlist-list";
  ul.className = "sidebar-playlist-list";
  plWrap.appendChild(plHead);
  plWrap.appendChild(ul);
  el.appendChild(plWrap);
  void refreshSidebarPlaylists();
}

function clearSidebarPlaylistHighlight() {
  document.querySelectorAll(".sidebar-pl-item.is-active").forEach((el) => el.classList.remove("is-active"));
}

/** 主导航页面（非歌单详情）：离开歌单上下文时清除侧栏选中与歌单 id，避免刷新列表时再次高亮 */
const MAIN_NAV_PAGE_IDS = new Set(["discover", "recent", "download", "import", "settings"]);

function setPage(pageId) {
  if (pageId !== "playlist") {
    clearSidebarPlaylistHighlight();
    if (MAIN_NAV_PAGE_IDS.has(pageId)) {
      selectedPlaylistId = null;
      selectedPlaylistName = "";
    }
  }
  document.querySelectorAll(".nav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === pageId);
  });
  document.querySelectorAll(".page").forEach((p) => {
    p.classList.toggle("page-active", p.dataset.page === pageId);
  });
  if (pageId === "recent") {
    renderRecentPlaysTable();
  }
  if (pageId === "download") {
    const activeTab = document.querySelector("[data-download-tab].page-tab--active");
    const tid = activeTab?.getAttribute("data-download-tab") || "local";
    if (tid === "local") void refreshLocalLibraryTable();
    if (tid === "saved") void refreshDownloadedSongsTable();
    if (tid === "active") renderDownloadActiveTable();
  }
  if (pageId === "import") {
    void refreshPlaylistSelect();
  }
  if (pageId === "settings") {
    void (async () => {
      try {
        const s = await invoke("get_settings");
        mainWindowCloseAction = normalizeCloseAction(s?.main_window_close_action ?? s?.mainWindowCloseAction);
        fillSettingsFormFromSettings(s);
      } catch (e) {
        console.warn("get_settings", e);
      }
    })();
  }
  if (pageId === "playlist") {
    if (selectedPlaylistId == null) {
      selectedPlaylistName = "";
      const titleEl = document.getElementById("playlist-page-title");
      if (titleEl) titleEl.textContent = "歌单";
      playlistDetailRows = [];
      renderPlaylistDetailTable();
    } else {
      void loadPlaylistDetail(selectedPlaylistId, selectedPlaylistName);
    }
  }
}

function updateSearchToolbar() {
  const n = searchState.results.length;
  const info = document.getElementById("search-page-info");
  const prev = document.getElementById("btn-prev-page");
  const next = document.getElementById("btn-next-page");
  const playAll = document.getElementById("btn-play-all");
  if (info) {
    info.textContent =
      !searchState.keyword.trim()
        ? ""
        : `共 ${n} 条 · 第 ${searchState.page} 页${searchState.hasNext ? " · 有下一页" : " · 已到末页"}`;
  }
  if (prev) prev.disabled = searchState.page <= 1 || searchState.busy;
  if (next) next.disabled = !searchState.hasNext || searchState.busy;
  if (playAll) playAll.disabled = !n || searchState.busy;
}

function renderSearchTable() {
  const tbody = document.querySelector("#search-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const rows = searchState.results;
  if (!rows.length) {
    setTableMutedMessage(tbody, 5, "无结果（或站点 HTML 已变化）。");
    return;
  }
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const tr = document.createElement("tr");
    const coverHtml = r.cover_url
      ? `<img class="row-cover" src="${escapeHtml(r.cover_url)}" alt="" width="40" height="40" loading="lazy" />`
      : `<div class="row-cover-ph" aria-hidden="true"></div>`;
    const titleBlock = r.artist
      ? `<span class="t-title">${escapeHtml(r.title)}</span><span class="t-art">${escapeHtml(r.artist)}</span>`
      : `<span class="t-title">${escapeHtml(r.title)}</span>`;
    tr.innerHTML = `
      <td class="col-idx">${i + 1}</td>
      <td class="col-cover">${coverHtml}</td>
      <td>${titleBlock}</td>
      <td class="muted">${escapeHtml(r.album || "—")}</td>
      <td class="muted col-dur">—</td>
    `;
    tr.style.cursor = "pointer";
    tr.title = "双击试听";
    tr.addEventListener("dblclick", () => playFromSearchRow(i));
    tr.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      void openSearchRowContextMenu(ev, i);
    });
    tbody.appendChild(tr);
  }
}

async function fetchSearchPage() {
  const kw = searchState.keyword.trim();
  if (!kw) return;
  searchState.busy = true;
  updateSearchToolbar();
  const tbody = document.querySelector("#search-table tbody");
  setTableMutedMessage(tbody, 5, "搜索中…");
  try {
    const res = await invoke("search_songs", { keyword: kw, page: searchState.page });
    searchState.results = res.results || [];
    searchState.hasNext = !!res.has_next;
    renderSearchTable();
  } catch (e) {
    warnRequestFailed(e, "search_songs");
    setTableMutedMessage(tbody, 5, MSG_REQUEST_FAILED);
    searchState.results = [];
    searchState.hasNext = false;
  } finally {
    searchState.busy = false;
    updateSearchToolbar();
  }
}

function wireDiscoverToolbar() {
  document.getElementById("btn-prev-page")?.addEventListener("click", () => {
    if (searchState.page <= 1 || searchState.busy) return;
    if (!searchState.keyword.trim()) return;
    searchState.page -= 1;
    fetchSearchPage();
  });
  document.getElementById("btn-next-page")?.addEventListener("click", () => {
    if (searchState.busy || !searchState.hasNext) return;
    if (!searchState.keyword.trim()) return;
    searchState.page += 1;
    fetchSearchPage();
  });
  document.getElementById("btn-play-all")?.addEventListener("click", () => {
    if (!searchState.results.length) return;
    playQueue = searchState.results.map((r) => ({
      source_id: r.source_id,
      title: r.title,
      artist: r.artist || "",
      album: r.album || "",
      cover_url: r.cover_url || null,
    }));
    playFromQueueIndex(0);
  });
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
}

/**
 * 无封面时请求 Lrc.cx `https://api.lrc.cx/cover`（后端跟随重定向得到图片 URL）。
 * @param {number} generation
 * @param {number} queueIndex
 */
async function maybeFillCoverFromLrcCx(generation, queueIndex) {
  if (generation !== playLoadGeneration) return;
  const it = playQueue[queueIndex];
  if (!it) return;
  if ((it.cover_url || "").trim()) return;
  try {
    const url = await invoke("fetch_lrc_cx_cover", {
      title: it.title || "",
      artist: it.artist || "",
      album: it.album ?? null,
    });
    if (generation !== playLoadGeneration) return;
    const cur = playQueue[queueIndex];
    if (!cur) return;
    if (cur.title !== it.title) return;
    if (!isSamePlayableIdentity(cur, it)) return;
    if (url && typeof url === "string" && url.trim()) {
      cur.cover_url = url.trim();
      if (queueIndex === playIndex) {
        const sub = formatNowPlayingSubtitle(cur);
        updatePlayerChrome({ title: cur.title, sub, coverUrl: cur.cover_url });
      }
      renderQueuePanel();
    }
  } catch (e) {
    console.warn("fetch_lrc_cx_cover", e);
  }
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
}

async function persistRecentPlaySnapshot(snap) {
  try {
    if (snap.local_path) {
      await invoke("record_recent_play", {
        row: {
          kind: "local",
          title: snap.title,
          artist: snap.artist || "",
          cover_url: null,
          pjmp3_source_id: null,
          file_path: snap.local_path,
        },
      });
    } else {
      await invoke("record_recent_play", {
        row: {
          kind: "online",
          title: snap.title,
          artist: snap.artist || "",
          cover_url: snap.cover_url ?? null,
          pjmp3_source_id: snap.source_id,
          file_path: null,
          play_url: snap.play_url && String(snap.play_url).trim() ? String(snap.play_url).trim() : null,
        },
      });
    }
  } catch (e) {
    console.warn("record_recent_play", e);
  }
}

/**
 * @param {string | null} [onlinePlayUrl] 在线曲目本次实际使用的 http(s) 试听直链（非 asset 本地文件）
 */
function pushSessionRecentFromCurrentTrack(onlinePlayUrl = null) {
  const it = playQueue[playIndex];
  if (!it) return;
  /** @type {{ source_id?: string, title: string, artist: string, album?: string, cover_url?: string | null, local_path?: string, play_url?: string }} */
  let snap;
  if (it.local_path) {
    snap = { title: it.title, artist: it.artist || "", local_path: it.local_path };
  } else {
    const sid = (it.source_id || "").trim();
    if (!sid) return;
    const pu = onlinePlayUrl && String(onlinePlayUrl).trim() ? String(onlinePlayUrl).trim() : "";
    snap = {
      source_id: sid,
      title: it.title,
      artist: it.artist || "",
      album: it.album || "",
      cover_url: it.cover_url || null,
      ...(pu ? { play_url: pu } : {}),
    };
  }
  const key = snap.local_path ? `L:${snap.local_path}` : `O:${snap.source_id}`;
  sessionRecentPlays = sessionRecentPlays.filter((x) => {
    const k = x.local_path ? `L:${x.local_path}` : `O:${(x.source_id || "").trim()}`;
    return k !== key;
  });
  sessionRecentPlays.unshift(snap);
  if (sessionRecentPlays.length > RECENT_SESSION_MAX) sessionRecentPlays.length = RECENT_SESSION_MAX;
  void persistRecentPlaySnapshot(snap);
  if (document.querySelector('.page[data-page="recent"]')?.classList.contains("page-active")) {
    renderRecentPlaysTable();
  }
}

async function loadRecentPlaysFromDb() {
  try {
    const rows = await invoke("list_recent_plays");
    if (!Array.isArray(rows) || !rows.length) return;
    sessionRecentPlays = rows.map((r) => {
      const fp = r.filePath || r.file_path;
      if ((r.kind || "") === "local" && fp) {
        return { title: r.title, artist: r.artist || "", local_path: fp };
      }
      return {
        source_id: r.pjmp3SourceId || r.pjmp3_source_id || "",
        title: r.title,
        artist: r.artist || "",
        cover_url: r.coverUrl ?? r.cover_url ?? null,
      };
    });
    if (document.querySelector('.page[data-page="recent"]')?.classList.contains("page-active")) {
      renderRecentPlaysTable();
    }
  } catch (e) {
    console.warn("list_recent_plays", e);
  }
}

/** 右侧「正在下载」：排队中、进行中、失败 */
function renderDownloadActiveTable() {
  const tbody = document.querySelector("#download-active-table tbody");
  if (!tbody) return;
  const list = [...downloadTasksBySourceId.values()].filter((t) => {
    const st = t.status || "";
    return st === "queued" || st === "downloading" || st === "failed";
  });
  if (!list.length) {
    setTableMutedMessage(tbody, 4, "当前没有进行中的下载。在「发现」或歌单右键选择「下载」。");
    return;
  }
  tbody.innerHTML = "";
  for (const t of list) {
    const tr = document.createElement("tr");
    const pct = Math.round((t.progress ?? 0) * 100);
    const tit = t.title || "";
    const art = t.artist || "";
    const qu = t.quality || "";
    const st = t.status || "";
    const rawMsg = (t.message && String(t.message)) || "";
    if (st === "failed" && rawMsg) {
      const sid = t.sourceId ?? t.source_id;
      console.error("[download] failed", { sourceId: sid, title: tit, message: rawMsg });
    }
    const msg = st === "failed" && rawMsg ? `${MSG_REQUEST_FAILED}（见日志文件）` : rawMsg;
    tr.title = st === "failed" && rawMsg ? rawMsg : "";
    tr.innerHTML = `<td>${escapeHtml(st)}</td><td>${escapeHtml(`${tit} — ${art}`)}</td><td>${escapeHtml(qu)}</td><td>${escapeHtml(String(pct))}%${msg ? ` · ${escapeHtml(msg)}` : ""}</td>`;
    tbody.appendChild(tr);
  }
}

/** 「下载歌曲」：库中持久化的已下载文件（与内存队列无关） */
async function refreshDownloadedSongsTable() {
  const tbody = document.querySelector("#download-completed-table tbody");
  if (!tbody) return;
  setTableMutedMessage(tbody, 4, "加载中…");
  try {
    const rows = await invoke("list_downloaded_songs");
    downloadedSongsRows = Array.isArray(rows) ? rows : [];
    tbody.innerHTML = "";
    if (!downloadedSongsRows.length) {
      setTableMutedMessage(tbody, 4, "暂无记录。成功下载的歌曲会出现在这里（重启后仍会保留）。");
      return;
    }
    downloadedSongsRows.forEach((r) => {
      const tr = document.createElement("tr");
      const titleHtml = r.artist
        ? `<span class="t-title">${escapeHtml(r.title || "—")}</span><span class="t-art">${escapeHtml(r.artist)}</span>`
        : `<span class="t-title">${escapeHtml(r.title || "—")}</span>`;
      const dur = formatDurationMs(r.durationMs ?? r.duration_ms);
      const sz = formatFileSize(r.fileSize ?? r.file_size);
      const fp = String(r.filePath || r.file_path || "").trim();
      tr.title = fp || "";
      tr.innerHTML = `<td>${titleHtml}</td><td class="muted">${escapeHtml(r.album || "—")}</td><td class="muted col-dur">${escapeHtml(dur)}</td><td class="muted col-size">${escapeHtml(sz)}</td>`;
      tr.addEventListener("dblclick", () => {
        if (!fp) return;
        playQueue = [{ title: r.title, artist: r.artist || "", local_path: fp, cover_url: null }];
        void playFromQueueIndex(0);
        renderQueuePanel();
      });
      tbody.appendChild(tr);
    });
  } catch (e) {
    warnRequestFailed(e, "list_downloaded_songs");
    setTableMutedMessage(tbody, 4, MSG_REQUEST_FAILED);
    downloadedSongsRows = [];
  }
}

function renderDownloadTables() {
  renderDownloadActiveTable();
  void refreshDownloadedSongsTable();
}

function updateDownloadFolderHint(path) {
  const el = document.getElementById("download-folder-hint");
  if (!el) return;
  el.textContent = path && String(path).trim() ? `当前：${path}` : "默认：用户音乐/CloudPlayer";
}

function playFromRecentRow(rowIdx) {
  const snap = sessionRecentPlays[rowIdx];
  if (!snap) return;
  if (snap.local_path) {
    playQueue = [{ title: snap.title, artist: snap.artist || "", local_path: snap.local_path, cover_url: null }];
  } else {
    playQueue = [
      {
        source_id: snap.source_id,
        title: snap.title,
        artist: snap.artist || "",
        album: snap.album || "",
        cover_url: snap.cover_url || null,
      },
    ];
  }
  void playFromQueueIndex(0);
  renderQueuePanel();
}

function renderRecentPlaysTable() {
  const tbody = document.querySelector("#recent-plays-table tbody");
  if (!tbody) return;
  if (!sessionRecentPlays.length) {
    setTableMutedMessage(tbody, 4, "暂无记录。在「发现」或「本地」播放曲目后将显示在此处。");
    return;
  }
  tbody.innerHTML = "";
  sessionRecentPlays.forEach((snap, i) => {
    const tr = document.createElement("tr");
    const title = snap.title || "—";
    const artist = snap.artist || "—";
    const src = snap.local_path ? "本地" : "在线";
    tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(title)}</td><td>${escapeHtml(artist)}</td><td>${escapeHtml(src)}</td>`;
    tr.addEventListener("dblclick", () => playFromRecentRow(i));
    tbody.appendChild(tr);
  });
}

async function refreshLocalLibraryTable() {
  const tbody = document.querySelector("#local-library-table tbody");
  if (!tbody) return;
  setTableMutedMessage(tbody, 4, "加载中…");
  try {
    const rows = await invoke("list_local_songs");
    localLibraryRows = Array.isArray(rows) ? rows : [];
    tbody.innerHTML = "";
    if (!localLibraryRows.length) {
      setTableMutedMessage(tbody, 4, "暂无本地曲库。请点击「选择文件夹并扫描」。");
      return;
    }
    localLibraryRows.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(r.title || "")}</td><td>${escapeHtml(r.artist || "")}</td><td class="col-path" title="${escapeHtml(r.file_path || "")}">${escapeHtml(r.file_path || "")}</td>`;
      tr.addEventListener("dblclick", () => {
        playQueue = [{ title: r.title, artist: r.artist || "", local_path: r.file_path, cover_url: null }];
        void playFromQueueIndex(0);
        renderQueuePanel();
      });
      tr.addEventListener("contextmenu", (ev) => void openLocalLibraryRowContextMenu(ev, i));
      tbody.appendChild(tr);
    });
  } catch (e) {
    warnRequestFailed(e, "list_local_songs");
    setTableMutedMessage(tbody, 4, MSG_REQUEST_FAILED);
  }
}

function wireDownloadPage() {
  document.querySelectorAll("[data-download-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-download-tab");
      document.querySelectorAll("[data-download-tab]").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("page-tab--active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll("[data-download-panel]").forEach((p) => {
        const show = p.getAttribute("data-download-panel") === id;
        p.classList.toggle("page-tab-panel--active", show);
      });
      if (id === "local") void refreshLocalLibraryTable();
      if (id === "saved") void refreshDownloadedSongsTable();
      if (id === "active") renderDownloadActiveTable();
    });
  });

  document.getElementById("btn-pick-download-folder")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("download-folder-hint");
    try {
      const s = await invoke("get_settings");
      const def = ((s && (s.download_folder || s.downloadFolder)) || "").trim();
      const picked = await open({
        directory: true,
        multiple: false,
        defaultPath: def || undefined,
        title: "选择下载保存目录",
      });
      if (picked == null) return;
      const folder = Array.isArray(picked) ? picked[0] : picked;
      if (!folder || !String(folder).trim()) return;
      const path = String(folder).trim();
      await invoke("save_settings", { patch: { download_folder: path } });
      updateDownloadFolderHint(path);
    } catch (e) {
      if (statusEl) statusEl.textContent = MSG_REQUEST_FAILED;
      alertRequestFailed(e, "pick download folder");
    }
  });

  document.getElementById("btn-scan-library-folder")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("local-library-status");
    try {
      const s = await invoke("get_settings");
      const def = ((s && s.last_library_folder) || lastLibraryFolder || "").trim();
      const picked = await open({
        directory: true,
        multiple: false,
        defaultPath: def || undefined,
        title: "选择音乐文件夹",
      });
      if (picked == null) return;
      const folder = Array.isArray(picked) ? picked[0] : picked;
      if (!folder || !String(folder).trim()) return;
      const path = String(folder).trim();
      lastLibraryFolder = path;
      await invoke("save_settings", { patch: { last_library_folder: path } }).catch(() => {});
      if (statusEl) statusEl.textContent = "正在扫描…";
      const res = await invoke("scan_music_folder", { path });
      if (statusEl) {
        statusEl.textContent = `已扫描 ${res.audio_files_seen} 个音频文件，写入/更新 ${res.rows_written} 条。`;
      }
      await refreshLocalLibraryTable();
    } catch (e) {
      if (statusEl) statusEl.textContent = MSG_REQUEST_FAILED;
      alertRequestFailed(e, "scan_music_folder");
    }
  });
}

async function playFromQueueIndex(idx) {
  if (!playQueue.length || idx < 0 || idx >= playQueue.length) return;
  const generation = ++playLoadGeneration;
  playIndex = idx;
  const item = playQueue[idx];
  updatePlayerChrome({
    title: item.title,
    sub: formatLoadingSubtitle(item),
    touchCover: false,
  });
  const playBtn = document.getElementById("btn-player-play");
  const a = audioEl();
  /** 在线且最终走直链时写入最近播放，供下次「播放记录试听链接」优先 */
  let onlineResolvedPlayUrl = null;
  try {
    let assetUrl;
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
      /** 后端顺序：本地曲库 songs → 下载目录同名文件 → 试听缓存 → 最近播放直链 → 拉取试听/直链 */
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
    }
    if (generation !== playLoadGeneration) return;
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
      sub: formatNowPlayingSubtitle(item),
      coverUrl: item.cover_url || null,
    });
    void maybeFillCoverFromLrcCx(generation, idx);
    if (playBtn) {
      playBtn.textContent = "⏸";
      playBtn.disabled = false;
    }
    setPlayerNavEnabled();
    syncSeekUi();
    renderQueuePanel();
    refreshFavButton();
    lrcCacheKey = null;
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
  playQueue = searchState.results.map((r) => ({
    source_id: r.source_id,
    title: r.title,
    artist: r.artist || "",
    album: r.album || "",
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
  a.addEventListener("loadedmetadata", () => syncSeekUi());
  a.addEventListener("durationchange", () => syncSeekUi());
  a.addEventListener("canplay", () => syncSeekUi());
  a.addEventListener("ended", () => {
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
  });
  a.addEventListener("pause", () => {
    if (playBtn) playBtn.textContent = "▶";
  });
  a.addEventListener("error", () => {
    const err = a.error;
    if (err && err.code === 1) return;
    if (audioSourceGeneration !== playLoadGeneration) return;
    const sub = document.getElementById("dock-sub");
    const cur = playQueue[playIndex];
    if (sub && err) {
      sub.textContent = MSG_REQUEST_FAILED;
    }
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

function submitGlobalSearch() {
  const gs = document.getElementById("global-search");
  if (!gs) return;
  const v = gs.value.trim();
  setPage("discover");
  if (!v) {
    searchState.keyword = "";
    searchState.page = 1;
    searchState.results = [];
    searchState.hasNext = false;
    const tbody = document.querySelector("#search-table tbody");
    if (tbody) tbody.innerHTML = "";
    updateSearchToolbar();
    return;
  }
  searchState.keyword = v;
  searchState.page = 1;
  fetchSearchPage();
}

function wireGlobalSearch() {
  const gs = document.getElementById("global-search");
  if (!gs) return;
  gs.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    submitGlobalSearch();
  });
  document.getElementById("btn-global-search")?.addEventListener("click", () => submitGlobalSearch());
}

async function loadSettings() {
  try {
    const s = await invoke("get_settings");
    mainWindowCloseAction = normalizeCloseAction(s?.main_window_close_action ?? s?.mainWindowCloseAction);
    fillSettingsFormFromSettings(s);
    const vol = document.getElementById("volume");
    if (s && typeof s.volume === "number") {
      vol.value = String(Math.round(s.volume * 100));
    }
    const a = audioEl();
    if (a && s && typeof s.volume === "number") {
      a.volume = s.volume;
    }
    if (s && typeof s.desktop_lyrics_locked === "boolean") {
      desktopLyricsLocked = s.desktop_lyrics_locked;
    }
    if (s && typeof s.last_library_folder === "string") {
      lastLibraryFolder = s.last_library_folder.trim();
    }
    const df = s && (s.download_folder || s.downloadFolder);
    if (typeof df === "string" && df.trim()) {
      updateDownloadFolderHint(df);
    } else {
      updateDownloadFolderHint("");
    }
    refreshLyricsLockMenuLabel();
    if (desktopLyricsOpen) {
      scheduleDesktopLyricsStyleSync();
    }
    if (s?.desktop_lyrics_visible) {
      queueMicrotask(() => {
        void openDesktopLyricsFromSettingsIfNeeded(s);
      });
    }
  } catch (e) {
    console.warn("get_settings", e);
  }
  try {
    const st = await invoke("db_status");
    console.info(st);
  } catch (e) {
    console.warn("db_status", e);
  }
}

function toggleQueuePanel() {
  const panel = document.getElementById("queue-panel");
  const btn = document.getElementById("queue-toggle");
  panel.classList.toggle("collapsed");
  btn.textContent = panel.classList.contains("collapsed") ? "展开" : "收起";
  renderQueuePanel();
}

function wireQueueToggle() {
  document.getElementById("queue-toggle").addEventListener("click", () => toggleQueuePanel());
}

function wireVolume() {
  const vol = document.getElementById("volume");
  const persist = async () => {
    const v = Number(vol.value) / 100;
    try {
      await invoke("save_settings", { patch: { volume: v } });
    } catch (e) {
      console.warn("save_settings", e);
    }
  };
  vol.addEventListener("input", () => {
    const v = Number(vol.value) / 100;
    const a = audioEl();
    if (a) a.volume = v;
  });
  vol.addEventListener("change", persist);
}

function bootDesktop() {
  renderSidebar();
  setPage("discover");
  wireQueueToggle();
  wireDockBar();
  wireDownloadPage();
  wireImportPage();
  wirePlaylistPage();
  wireVolume();
  wirePreferencesModals();
  wireGlobalSearch();
  wireDiscoverToolbar();
  wireAudio();
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
  /** 歌词窗内点「锁定」：与底栏 ⋯ 同源，由主窗写 settings + 广播 + 原生穿透（子页 invoke 易失效） */
  listen("download-task-changed", (e) => {
    const p = e?.payload;
    const sid = p?.source_id ?? p?.sourceId;
    if (sid != null && String(sid) !== "") {
      downloadTasksBySourceId.set(String(sid), p);
    }
    renderDownloadTables();
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
    const a = mainWindowCloseAction;
    if (a === "quit") {
      try {
        await invoke("quit_app");
      } catch (e) {
        alertRequestFailed(e, "close flow");
      }
      return;
    }
    if (a === "tray") {
      try {
        await invoke("hide_main_window");
      } catch (e) {
        alertRequestFailed(e, "close flow");
      }
      return;
    }
    openCloseConfirmModal();
  });
  void loadRecentPlaysFromDb();
  loadSettings();
}

export function startDesktop() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootDesktop);
  } else {
    bootDesktop();
  }
}
