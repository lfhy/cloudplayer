import "./mobile-ui.css";
import {
  buildImportCsvBlobUtf8,
  buildImportTxtBlob,
  triggerBlobDownload,
} from "./export-playlist.js";
import { convertFileSrc, invoke as invokeTauri } from "@tauri-apps/api/core";

/** 是否在 Tauri WebView 内（浏览器 ?cp_mobile=1 预览时无 IPC） */
function hasTauriIpc() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function invoke(cmd, args) {
  if (!hasTauriIpc()) {
    throw new Error(
      "仅在 CloudPlayer 应用内可用。开发调试请用：npm run android:dev（真机/模拟器热重载）；浏览器可访问 ?cp_mobile=1 仅预览布局。",
    );
  }
  if (args === undefined) return invokeTauri(cmd);
  return invokeTauri(cmd, args);
}

function errText(e) {
  if (typeof e === "string") return e;
  if (e && typeof e.message === "string" && e.message) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** 供 `log_play_event` 写入 cloudplayer.log，与 Rust `pj-play` 对照 */
function audioDiagPayload(a) {
  let bufferedEnd = null;
  try {
    if (a.buffered && a.buffered.length > 0) {
      bufferedEnd = a.buffered.end(a.buffered.length - 1);
    }
  } catch {
    /* ignore */
  }
  return {
    currentTime: a.currentTime,
    duration: a.duration,
    readyState: a.readyState,
    networkState: a.networkState,
    bufferedEnd,
  };
}

async function logPlayEventMobile(stage, { url = null, error_code = null, message = null, extra = null } = {}) {
  if (!hasTauriIpc()) return;
  try {
    await invoke("log_play_event", {
      stage,
      url,
      error_code,
      message,
      extra: extra != null ? (typeof extra === "string" ? extra : JSON.stringify(extra)) : null,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Android WebView：`convertFileSrc` 对本地音频只缓冲开头，约 30s 停播（tauri-apps/tauri#14776）。
 * 应用内整文件读入后 `Blob` + `URL.createObjectURL` 可完整播放。
 */
let lastAudioObjectUrl = null;

function revokeMobileAudioObjectUrl() {
  if (lastAudioObjectUrl) {
    try {
      URL.revokeObjectURL(lastAudioObjectUrl);
    } catch {
      /* ignore */
    }
    lastAudioObjectUrl = null;
  }
}

function mimeForAudioPath(p) {
  const low = String(p || "").toLowerCase();
  if (low.endsWith(".mp3")) return "audio/mpeg";
  if (low.endsWith(".m4a")) return "audio/mp4";
  if (low.endsWith(".aac")) return "audio/aac";
  if (low.endsWith(".flac")) return "audio/flac";
  if (low.endsWith(".ogg")) return "audio/ogg";
  if (low.endsWith(".wav")) return "audio/wav";
  return "audio/mpeg";
}

function bytesToUint8(raw) {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (Array.isArray(raw)) return new Uint8Array(raw);
  return new Uint8Array(raw);
}

/** @param {string} path */
async function playableUrlFromLocalPath(path) {
  if (!hasTauriIpc()) {
    return convertFileSrc(path);
  }
  const raw = await invoke("read_file_bytes", { path });
  const u8 = bytesToUint8(raw);
  revokeMobileAudioObjectUrl();
  const blob = new Blob([u8], { type: mimeForAudioPath(path) });
  lastAudioObjectUrl = URL.createObjectURL(blob);
  return lastAudioObjectUrl;
}

/** 与桌面 `persistRecentPlaySnapshot` 一致：写入 DB，供 `resolve_online_play` 的「最近播放直链」分支 */
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
 * 在线曲目成功开播后写入最近播放（含本次 http 直链，便于下次优先解析）
 * @param {string | null} [onlinePlayUrl]
 */
function pushMobileRecentFromCurrentTrack(onlinePlayUrl = null) {
  const it = playQueue[playIndex];
  if (!it) return;
  if (it.local_path) {
    void persistRecentPlaySnapshot({ title: it.title, artist: it.artist || "", local_path: it.local_path });
    return;
  }
  const sid = (it.source_id || "").trim();
  if (!sid) return;
  const pu = onlinePlayUrl && String(onlinePlayUrl).trim() ? String(onlinePlayUrl).trim() : "";
  void persistRecentPlaySnapshot({
    source_id: sid,
    title: it.title,
    artist: it.artist || "",
    album: it.album || "",
    cover_url: it.cover_url || null,
    ...(pu ? { play_url: pu } : {}),
  });
}

/** 补全曲库 id 后更新歌单详情行样式（与桌面更新表格类似） */
function patchPlaylistDetailRowAfterFill(itemId, _fid) {
  const li = document.querySelector(`#cp-m-pl-tracks-ul li[data-item-id="${itemId}"]`);
  if (!li) return;
  li.style.opacity = "1";
  const row = playlistDetailRows.find((r) => Number(r.id) === Number(itemId));
  const sub = li.querySelector(".cp-m-li-sub");
  if (sub && row) {
    sub.textContent = row.artist || "";
  }
}

const PLACEHOLDER_COVER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect fill='%23e5e7eb' width='48' height='48'/%3E%3C/svg%3E";

/**
 * @type {Array<{
 *   source_id?: string;
 *   title: string;
 *   artist: string;
 *   album?: string;
 *   cover_url?: string | null;
 *   local_path?: string;
 *   import_playlist_id?: number | null;
 *   import_item_id?: number | null;
 * }>}
 */
let playQueue = [];
let playIndex = 0;
let playLoadGeneration = 0;
let audioSourceGeneration = 0;
let seekDragging = false;
/** `progress` 上报节流：最多每秒一条 */
let audioProgressLogLastTs = 0;

/** @type {{ id: number; name: string } | null} */
let openPlaylistCtx = null;

/** 当前歌单详情曲目（与桌面 `playlistDetailRows` 对齐） @type {any[]} */
let playlistDetailRows = [];
let detailSelectMode = false;
/** @type {Set<number>} */
let selectedDetailIds = new Set();
let detailTrackLongPressTimer = 0;
let detailTrackLongPressSuppressClick = false;

/** 当前搜索页结果（多选与播放共用） @type {any[]} */
let searchResultRows = [];
let searchSelectMode = false;
/** @type {Set<number>} */
let selectedSearchIndices = new Set();
let searchRowLongPressTimer = 0;
let searchRowLongPressSuppressClick = false;

const DETAIL_LONG_MS = 520;

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

/** 导入歌单页已解析条目（与桌面 `main.js` importTracks 对齐） @type {{ title: string, artist: string, album: string }[]} */
let importTracks = [];
/** 分享链接拉取成功后建议的歌单名 */
let importShareSuggestedName = "";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatTime(sec) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function audioEl() {
  return document.getElementById("audio-player");
}

function setChrome({ title, sub, coverUrl }) {
  const t = document.getElementById("cp-m-dock-title");
  const s = document.getElementById("cp-m-dock-sub");
  const c = document.getElementById("cp-m-dock-cover");
  if (title !== undefined && t) t.textContent = title;
  if (sub !== undefined && s) s.textContent = sub;
  if (coverUrl && c) c.src = coverUrl;
  else if (c && coverUrl === null) c.src = PLACEHOLDER_COVER;
}

function syncSeekUi() {
  const a = audioEl();
  const seek = document.getElementById("cp-m-seek");
  const cur = document.getElementById("cp-m-time-cur");
  const tot = document.getElementById("cp-m-time-tot");
  if (!a || !seek || !cur || !tot) return;
  const d = a.duration;
  if (d && Number.isFinite(d) && d > 0) {
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

function exitSearchSelectMode() {
  searchSelectMode = false;
  selectedSearchIndices.clear();
  const panel = document.getElementById("cp-m-search-panel");
  const bar = document.getElementById("cp-m-search-batch-bar");
  const head = document.getElementById("cp-m-search-select-head");
  panel?.classList.remove("cp-m-search-panel--select");
  bar?.classList.add("hidden");
  head?.classList.add("hidden");
  document.querySelectorAll("#cp-m-discover-ul .cp-m-search-row").forEach((el) => {
    el.classList.remove("is-selected");
  });
  syncSearchBarDisabled();
}

function updateSearchSelectUi() {
  const nEl = document.getElementById("cp-m-search-select-n");
  const allBtn = document.getElementById("cp-m-search-select-all");
  const n = selectedSearchIndices.size;
  if (nEl) nEl.textContent = String(n);
  const len = searchResultRows.length;
  const allOn = len > 0 && [...Array(len).keys()].every((i) => selectedSearchIndices.has(i));
  if (allBtn) allBtn.textContent = allOn ? "全不选" : "全选";
  syncSearchBarDisabled();
}

function syncSearchBarDisabled() {
  const empty = selectedSearchIndices.size === 0;
  for (const id of ["cp-m-search-act-addto", "cp-m-search-act-download", "cp-m-search-act-like"]) {
    document.getElementById(id)?.toggleAttribute("disabled", empty);
  }
}

function refreshSearchRowSelectionClasses() {
  document.querySelectorAll("#cp-m-discover-ul li.cp-m-search-row").forEach((li) => {
    const idx = Number(li.dataset.rowIndex);
    if (!Number.isFinite(idx)) return;
    li.classList.toggle("is-selected", selectedSearchIndices.has(idx));
  });
}

function enterSearchSelectMode(firstIndex) {
  searchSelectMode = true;
  selectedSearchIndices.clear();
  if (firstIndex >= 0) selectedSearchIndices.add(firstIndex);
  const panel = document.getElementById("cp-m-search-panel");
  const bar = document.getElementById("cp-m-search-batch-bar");
  const head = document.getElementById("cp-m-search-select-head");
  panel?.classList.add("cp-m-search-panel--select");
  bar?.classList.remove("hidden");
  head?.classList.remove("hidden");
  refreshSearchRowSelectionClasses();
  updateSearchSelectUi();
}

function toggleSearchRowSelection(rowIndex, li) {
  if (rowIndex < 0) return;
  if (selectedSearchIndices.has(rowIndex)) selectedSearchIndices.delete(rowIndex);
  else selectedSearchIndices.add(rowIndex);
  li.classList.toggle("is-selected", selectedSearchIndices.has(rowIndex));
  updateSearchSelectUi();
}

function toggleSearchSelectAll() {
  const len = searchResultRows.length;
  const allIdx = [...Array(len).keys()];
  const allOn = len > 0 && allIdx.every((i) => selectedSearchIndices.has(i));
  if (allOn) selectedSearchIndices.clear();
  else allIdx.forEach((i) => selectedSearchIndices.add(i));
  refreshSearchRowSelectionClasses();
  updateSearchSelectUi();
}

function getSelectedSearchRows() {
  return [...selectedSearchIndices]
    .sort((a, b) => a - b)
    .map((i) => searchResultRows[i])
    .filter(Boolean);
}

function openSearchPanel() {
  exitDetailSelectMode();
  const p = document.getElementById("cp-m-search-panel");
  const inp = document.getElementById("cp-m-search");
  if (p) p.classList.remove("hidden");
  inp?.focus();
}

function closeSearchPanel() {
  exitSearchSelectMode();
  document.getElementById("cp-m-search-panel")?.classList.add("hidden");
}

function updateImportActionState() {
  const has = importTracks.length > 0;
  const sel = document.getElementById("cp-m-import-merge-pl");
  const nOpt = !!(sel && !sel.disabled && sel.options && sel.options.length > 0);
  document.getElementById("cp-m-import-save-new")?.toggleAttribute("disabled", !has);
  document.getElementById("cp-m-import-export-txt")?.toggleAttribute("disabled", !has);
  document.getElementById("cp-m-import-export-csv")?.toggleAttribute("disabled", !has);
  document.getElementById("cp-m-import-merge-btn")?.toggleAttribute("disabled", !has || !nOpt);
}

function renderImportResultList() {
  const ul = document.getElementById("cp-m-import-ul");
  const hint = document.getElementById("cp-m-import-hint");
  if (!ul) return;
  ul.innerHTML = "";
  importTracks.forEach((t) => {
    const li = document.createElement("li");
    const sub = [t.artist || "", t.album || ""].filter(Boolean).join(" · ");
    li.innerHTML = `<div><div class="cp-m-li-title">${escapeHtml(t.title || "—")}</div><div class="cp-m-li-sub">${escapeHtml(sub || "—")}</div></div>`;
    ul.appendChild(li);
  });
  if (hint) {
    hint.textContent = importTracks.length ? `共 ${importTracks.length} 条` : "解析结果将显示在下方";
  }
  updateImportActionState();
}

async function refreshImportMergeSelect() {
  const sel = document.getElementById("cp-m-import-merge-pl");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = "";
  let pls = [];
  try {
    pls = await invoke("list_playlists");
  } catch (e) {
    console.warn("list_playlists", e);
  }
  for (const p of pls) {
    const o = document.createElement("option");
    o.value = String(p.id);
    o.textContent = p.name?.trim() || `歌单 ${p.id}`;
    sel.appendChild(o);
  }
  const hasPl = pls.length > 0;
  sel.disabled = !hasPl;
  if (hasPl && prev) {
    const still = [...sel.options].some((o) => o.value === prev);
    if (still) sel.value = prev;
  }
  updateImportActionState();
}

function openImportPanel() {
  document.getElementById("cp-m-import-panel")?.classList.remove("hidden");
  void refreshImportMergeSelect();
}

function closeImportPanel() {
  document.getElementById("cp-m-import-panel")?.classList.add("hidden");
}

function wireImportPanel() {
  document.getElementById("cp-m-import-close")?.addEventListener("click", () => closeImportPanel());

  document.getElementById("cp-m-import-parse-btn")?.addEventListener("click", async () => {
    const raw = document.getElementById("cp-m-import-text")?.value?.trim() ?? "";
    if (!raw) {
      alert("请先粘贴文本。");
      return;
    }
    const fmt = document.getElementById("cp-m-import-fmt")?.value ?? "auto";
    try {
      const rows = await invoke("parse_import_text", { text: raw, fmt });
      importTracks = rows || [];
      importShareSuggestedName = "";
      const st = document.getElementById("cp-m-import-share-status");
      if (st) st.textContent = "";
      renderImportResultList();
      await refreshImportMergeSelect();
      alert(`共解析 ${importTracks.length} 条。`);
    } catch (e) {
      console.warn("parse_import_text", e);
      alert(`解析失败：${errText(e)}`);
    }
  });

  document.getElementById("cp-m-import-share-btn")?.addEventListener("click", async () => {
    const input = document.getElementById("cp-m-import-share-url");
    const url = input?.value?.trim() ?? "";
    const st = document.getElementById("cp-m-import-share-status");
    const btn = document.getElementById("cp-m-import-share-btn");
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
      renderImportResultList();
      await refreshImportMergeSelect();
      const n = importTracks.length;
      const pn = importShareSuggestedName || "—";
      if (st) st.textContent = `已拉取 ${n} 首 · ${pn}`;
      alert(`已拉取「${pn}」共 ${n} 首。`);
    } catch (e) {
      if (st) st.textContent = "";
      console.warn("fetch_share_playlist", e);
      alert(`拉取失败：${errText(e)}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById("cp-m-import-share-url")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("cp-m-import-share-btn")?.click();
    }
  });

  document.getElementById("cp-m-import-export-txt")?.addEventListener("click", () => {
    if (!importTracks.length) return;
    triggerBlobDownload("playlist.txt", buildImportTxtBlob(importTracks));
  });

  document.getElementById("cp-m-import-export-csv")?.addEventListener("click", () => {
    if (!importTracks.length) return;
    triggerBlobDownload("playlist.csv", buildImportCsvBlobUtf8(importTracks));
  });

  document.getElementById("cp-m-import-save-new")?.addEventListener("click", async () => {
    if (!importTracks.length) return;
    const defaultName = (importShareSuggestedName && importShareSuggestedName.trim()) || "导入歌单";
    const name = window.prompt("歌单名称（将写入资料库）", defaultName);
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
      alert(`已创建歌单「${name.trim()}」，共 ${importTracks.length} 首。`);
      await refreshImportMergeSelect();
      void refreshPlaylists();
    } catch (e) {
      console.warn("save new playlist", e);
      alert(`保存失败：${errText(e)}`);
    }
  });

  document.getElementById("cp-m-import-merge-btn")?.addEventListener("click", async () => {
    if (!importTracks.length) return;
    const sel = document.getElementById("cp-m-import-merge-pl");
    const pid = sel && sel.value ? Number(sel.value) : NaN;
    if (!Number.isFinite(pid)) {
      alert("请先通过「保存为新歌单」创建歌单，或选择合并目标。");
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
      void refreshPlaylists();
    } catch (e) {
      console.warn("append_playlist_import_items", e);
      alert(`合并失败：${errText(e)}`);
    }
  });
}

/** 歌单列表：长按删除后抑制紧随其后的 click 打开详情 */
let playlistRowLongPressHandled = false;
let playlistRowLongPressTimer = 0;

async function confirmDeletePlaylistRow(p, displayName) {
  const name = displayName || `歌单 ${p.id}`;
  if (!window.confirm(`确定删除歌单「${name}」？`)) {
    playlistRowLongPressHandled = false;
    return;
  }
  try {
    await invoke("delete_playlist", { playlistId: Number(p.id) });
    if (openPlaylistCtx && openPlaylistCtx.id === Number(p.id)) {
      closePlaylistDetail();
    }
    await refreshPlaylists();
  } catch (e) {
    console.warn("delete_playlist", e);
    alert(`删除失败：${errText(e)}`);
  } finally {
    playlistRowLongPressHandled = false;
  }
}

function wirePlaylistRowInteractions(li, p, displayName) {
  const pid = Number(p.id);
  const openDetail = () => {
    if (playlistRowLongPressHandled) {
      playlistRowLongPressHandled = false;
      return;
    }
    void openPlaylistDetail(pid, displayName);
  };

  const LONG_MS = 520;
  const clearTimer = () => {
    if (playlistRowLongPressTimer) {
      window.clearTimeout(playlistRowLongPressTimer);
      playlistRowLongPressTimer = 0;
    }
  };

  li.addEventListener(
    "touchstart",
    () => {
      clearTimer();
      playlistRowLongPressTimer = window.setTimeout(() => {
        playlistRowLongPressTimer = 0;
        playlistRowLongPressHandled = true;
        void confirmDeletePlaylistRow(p, displayName);
      }, LONG_MS);
    },
    { passive: true },
  );
  li.addEventListener("touchend", clearTimer);
  li.addEventListener("touchmove", clearTimer);
  li.addEventListener("touchcancel", clearTimer);

  li.addEventListener("click", openDetail);

  li.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    playlistRowLongPressHandled = true;
    void confirmDeletePlaylistRow(p, displayName);
  });
}

async function refreshPlaylists() {
  const ul = document.getElementById("cp-m-playlist-ul");
  const empty = document.getElementById("cp-m-pl-empty");
  if (!ul) return;
  ul.innerHTML = "";
  let rows = [];
  try {
    rows = await invoke("list_playlists_summary");
  } catch (e) {
    console.warn("list_playlists_summary", e);
    if (empty) {
      empty.hidden = false;
      empty.textContent = errText(e);
    }
    return;
  }
  if (!rows.length) {
    if (empty) {
      empty.hidden = false;
      empty.textContent = "暂无歌单。点上方「导入歌单」解析链接或文本后保存即可。";
    }
    return;
  }
  if (empty) empty.hidden = true;
  for (const p of rows) {
    const n = Number(p.track_count) || 0;
    const cover = ((p.cover_url || "") + "").trim() || PLACEHOLDER_COVER;
    const displayName = String(p.name || "").trim() || `歌单 ${p.id}`;
    const li = document.createElement("li");
    li.className = "cp-m-pl-row";
    const thumb = document.createElement("div");
    thumb.className = "cp-m-pl-thumb";
    const img = document.createElement("img");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.src = cover;
    if (cover !== PLACEHOLDER_COVER) {
      img.addEventListener("error", () => {
        img.src = PLACEHOLDER_COVER;
      });
    }
    thumb.appendChild(img);
    const meta = document.createElement("div");
    meta.className = "cp-m-pl-card-meta";
    meta.innerHTML = `<div class="cp-m-li-title">${escapeHtml(p.name || `歌单 ${p.id}`)}</div>
      <div class="cp-m-li-sub">歌单 · ${n} 首 · 长按删除</div>`;
    li.appendChild(thumb);
    li.appendChild(meta);
    wirePlaylistRowInteractions(li, p, displayName);
    ul.appendChild(li);
  }
}

function recentRowToQueueItem(r) {
  const kind = (r.kind || "").trim();
  if (kind === "local") {
    const fp = (r.file_path || "").trim();
    if (!fp) return null;
    return {
      local_path: fp,
      title: r.title || "本地音频",
      artist: r.artist || "",
      album: "",
      cover_url: r.cover_url || null,
    };
  }
  const sid = (r.pjmp3_source_id || "").trim();
  if (!sid) return null;
  return {
    source_id: sid,
    title: r.title || "—",
    artist: r.artist || "",
    album: "",
    cover_url: r.cover_url || null,
  };
}

async function refreshRecent() {
  const row = document.getElementById("cp-m-recent-row");
  const empty = document.getElementById("cp-m-recent-empty");
  if (!row) return;
  row.innerHTML = "";
  let rows = [];
  try {
    rows = await invoke("list_recent_plays");
  } catch (e) {
    console.warn("list_recent_plays", e);
    if (empty) {
      empty.hidden = false;
      empty.textContent = errText(e);
    }
    return;
  }
  const originals = rows || [];
  const queue = originals.map((x) => recentRowToQueueItem(x)).filter(Boolean);
  if (!queue.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  queue.forEach((item, j) => {
    const card = document.createElement("div");
    card.className = "cp-m-recent-card";
    const cover = item.cover_url || PLACEHOLDER_COVER;
    card.innerHTML = `<div class="cp-m-recent-cover"></div>
      <p class="cp-m-recent-title">${escapeHtml(item.title)}</p>
      <p class="cp-m-recent-artist">${escapeHtml(item.artist || "—")}</p>`;
    const img = document.createElement("img");
    img.alt = "";
    img.src = cover;
    img.referrerPolicy = "no-referrer";
    card.querySelector(".cp-m-recent-cover")?.appendChild(img);
    card.addEventListener("click", () => {
      playQueue = queue;
      void playFromQueueIndex(j);
    });
    row.appendChild(card);
  });
}

function exitDetailSelectMode() {
  detailSelectMode = false;
  selectedDetailIds.clear();
  const detail = document.getElementById("cp-m-pl-detail");
  const bar = document.getElementById("cp-m-pl-detail-bar");
  const head = document.getElementById("cp-m-pl-select-head");
  detail?.classList.remove("cp-m-pl-detail--select");
  bar?.classList.add("hidden");
  head?.classList.add("hidden");
  document.querySelectorAll("#cp-m-pl-tracks-ul .cp-m-pl-track").forEach((el) => {
    el.classList.remove("is-selected");
  });
  syncDetailBarDisabled();
}

function updateDetailSelectUi() {
  const nEl = document.getElementById("cp-m-pl-select-n");
  const allBtn = document.getElementById("cp-m-pl-select-all");
  const n = selectedDetailIds.size;
  if (nEl) nEl.textContent = String(n);
  const allIds = playlistDetailRows.map((r) => Number(r.id)).filter((id) => id > 0);
  const allOn = allIds.length > 0 && allIds.every((id) => selectedDetailIds.has(id));
  if (allBtn) allBtn.textContent = allOn ? "全不选" : "全选";
  syncDetailBarDisabled();
}

function syncDetailBarDisabled() {
  const empty = selectedDetailIds.size === 0;
  for (const id of ["cp-m-pl-act-delete", "cp-m-pl-act-addto", "cp-m-pl-act-download", "cp-m-pl-act-like"]) {
    document.getElementById(id)?.toggleAttribute("disabled", empty);
  }
}

function refreshDetailRowSelectionClasses() {
  document.querySelectorAll("#cp-m-pl-tracks-ul li.cp-m-pl-track").forEach((li) => {
    const id = Number(li.dataset.itemId);
    if (!Number.isFinite(id)) return;
    li.classList.toggle("is-selected", selectedDetailIds.has(id));
  });
}

function enterDetailSelectMode(firstItemId) {
  detailSelectMode = true;
  selectedDetailIds.clear();
  if (firstItemId > 0) selectedDetailIds.add(firstItemId);
  const detail = document.getElementById("cp-m-pl-detail");
  const bar = document.getElementById("cp-m-pl-detail-bar");
  const head = document.getElementById("cp-m-pl-select-head");
  detail?.classList.add("cp-m-pl-detail--select");
  bar?.classList.remove("hidden");
  head?.classList.remove("hidden");
  refreshDetailRowSelectionClasses();
  updateDetailSelectUi();
}

function toggleDetailRowSelection(itemId, li) {
  if (itemId <= 0) return;
  if (selectedDetailIds.has(itemId)) selectedDetailIds.delete(itemId);
  else selectedDetailIds.add(itemId);
  li.classList.toggle("is-selected", selectedDetailIds.has(itemId));
  updateDetailSelectUi();
}

function toggleDetailSelectAll() {
  const allIds = playlistDetailRows.map((r) => Number(r.id)).filter((id) => id > 0);
  const allOn = allIds.length > 0 && allIds.every((id) => selectedDetailIds.has(id));
  if (allOn) {
    selectedDetailIds.clear();
  } else {
    allIds.forEach((id) => selectedDetailIds.add(id));
  }
  refreshDetailRowSelectionClasses();
  updateDetailSelectUi();
}

function getSelectedDetailRows() {
  return playlistDetailRows.filter((r) => selectedDetailIds.has(Number(r.id)));
}

function isSearchPanelActiveForBatch() {
  const p = document.getElementById("cp-m-search-panel");
  return searchSelectMode && !!p && !p.classList.contains("hidden");
}

function getSelectedRowsForBatch() {
  if (isSearchPanelActiveForBatch()) return getSelectedSearchRows();
  return getSelectedDetailRows();
}

function mapRowsToAppendItems(rows) {
  return rows.map((row) => ({
    title: row.title || "",
    artist: row.artist || "",
    album: row.album || "",
    source_id: String(row.source_id ?? row.pjmp3_source_id ?? row.pjmp3SourceId ?? "").trim(),
    cover_url: String(row.cover_url ?? row.coverUrl ?? "").trim(),
    duration_ms: Math.max(0, Number(row.duration_ms ?? row.durationMs ?? 0) || 0),
    play_url: String(row.play_url ?? row.playUrl ?? "").trim(),
  }));
}

function wirePlaylistDetailTrackRow(li, r, i, rows) {
  const itemId = Number(r.id);
  li.dataset.itemId = String(itemId);

  const clearTimer = () => {
    if (detailTrackLongPressTimer) {
      window.clearTimeout(detailTrackLongPressTimer);
      detailTrackLongPressTimer = 0;
    }
  };

  const onLongPress = () => {
    detailTrackLongPressTimer = 0;
    detailTrackLongPressSuppressClick = true;
    if (!detailSelectMode) {
      enterDetailSelectMode(itemId);
    } else {
      toggleDetailRowSelection(itemId, li);
    }
  };

  li.addEventListener(
    "touchstart",
    () => {
      clearTimer();
      detailTrackLongPressTimer = window.setTimeout(onLongPress, DETAIL_LONG_MS);
    },
    { passive: true },
  );
  li.addEventListener("touchend", clearTimer);
  li.addEventListener("touchmove", clearTimer);
  li.addEventListener("touchcancel", clearTimer);

  li.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    clearTimer();
    onLongPress();
  });

  li.addEventListener("click", () => {
    if (detailTrackLongPressSuppressClick) {
      detailTrackLongPressSuppressClick = false;
      return;
    }
    if (detailSelectMode) {
      toggleDetailRowSelection(itemId, li);
      return;
    }
    const pid = openPlaylistCtx?.id;
    if (pid == null) return;
    /** 与桌面 `openSidebarPlaylistContextMenu` / `playlistImportRowToQueueItem` 一致：可无 source_id，播放时 `try_fill` */
    playQueue = rows.map((row) => ({
      source_id: (row.pjmp3_source_id || "").trim(),
      title: row.title,
      artist: row.artist || "",
      album: row.album || "",
      cover_url: (row.cover_url || "").trim() || null,
      import_playlist_id: Number(pid),
      import_item_id: row.id != null ? row.id : null,
    }));
    void playFromQueueIndex(i);
  });
}

function closeDlQualityPanel() {
  document.getElementById("cp-m-dl-quality-panel")?.classList.add("hidden");
}

function openDlQualityPanel() {
  document.getElementById("cp-m-dl-quality-panel")?.classList.remove("hidden");
}

function closeAddToPanel() {
  document.getElementById("cp-m-addto-panel")?.classList.add("hidden");
}

async function openAddToPanel() {
  const panel = document.getElementById("cp-m-addto-panel");
  const ul = document.getElementById("cp-m-addto-ul");
  if (!panel || !ul) return;
  const items = mapRowsToAppendItems(getSelectedRowsForBatch());
  if (!items.length) {
    alert("请先选择曲目。");
    return;
  }
  ul.innerHTML = "";
  let pls = [];
  try {
    pls = await invoke("list_playlists");
  } catch (e) {
    console.warn("list_playlists", e);
    alert(`读取歌单失败：${errText(e)}`);
    return;
  }
  const cur = openPlaylistCtx?.id;
  for (const p of pls) {
    const pid = Number(p.id);
    if (!Number.isFinite(pid)) continue;
    if (cur != null && pid === cur) continue;
    const li = document.createElement("li");
    li.textContent = String(p.name || "").trim() || `歌单 ${pid}`;
    li.addEventListener("click", async () => {
      const batchItems = mapRowsToAppendItems(getSelectedRowsForBatch());
      if (!batchItems.length) return;
      try {
        await invoke("append_playlist_import_items", { playlistId: pid, items: batchItems });
        closeAddToPanel();
        alert(`已添加 ${batchItems.length} 首到「${li.textContent}」`);
        void refreshPlaylists();
      } catch (e) {
        console.warn("append_playlist_import_items", e);
        alert(`添加失败：${errText(e)}`);
      }
    });
    ul.appendChild(li);
  }
  if (!ul.children.length) {
    const li = document.createElement("li");
    li.textContent = "暂无其它歌单（可点「新建歌单并添加」）";
    li.style.cursor = "default";
    ul.appendChild(li);
  }
  panel.classList.remove("hidden");
}

async function runDetailDelete() {
  const rows = getSelectedDetailRows();
  if (!rows.length || !openPlaylistCtx) {
    alert("请先选择曲目。");
    return;
  }
  if (!window.confirm(`从当前歌单删除 ${rows.length} 首？`)) return;
  const pid = openPlaylistCtx.id;
  let fail = 0;
  for (const r of rows) {
    const itemId = Number(r.id);
    if (itemId <= 0) continue;
    try {
      await invoke("delete_playlist_import_item", { playlistId: pid, itemId });
    } catch (e) {
      console.warn("delete_playlist_import_item", e);
      fail++;
    }
  }
  exitDetailSelectMode();
  await openPlaylistDetail(pid, openPlaylistCtx.name);
  if (fail) alert(`部分删除失败（${fail} 条）`);
}

async function runBatchDownloadWithQuality(quality) {
  closeDlQualityPanel();
  const fromSearch = isSearchPanelActiveForBatch();
  const rows = fromSearch ? getSelectedSearchRows() : getSelectedDetailRows();
  if (!rows.length) {
    alert("请先选择曲目。");
    return;
  }
  const playlistId = openPlaylistCtx?.id;
  let ok = 0;
  let skip = 0;
  for (const r of rows) {
    let sid = fromSearch ? String(r.source_id ?? "").trim() : String(r.pjmp3_source_id ?? "").trim();
    if (!fromSearch && !sid && r.id && playlistId) {
      try {
        const filled = await invoke("try_fill_playlist_item_source_id", {
          playlistId,
          itemId: r.id,
        });
        if (filled && String(filled).trim()) {
          sid = String(filled).trim();
          r.pjmp3_source_id = sid;
        }
      } catch (e) {
        console.warn("try_fill_playlist_item_source_id", e);
      }
    }
    if (!sid) {
      skip++;
      continue;
    }
    try {
      await invoke("enqueue_download", {
        job: {
          source_id: sid,
          title: r.title || "",
          artist: r.artist || "",
          quality,
        },
      });
      ok++;
    } catch (e) {
      console.warn("enqueue_download", e);
      skip++;
    }
  }
  alert(`已加入下载队列 ${ok} 首${skip ? `，跳过 ${skip} 首` : ""}。`);
}

function runBatchLike() {
  const fromSearch = isSearchPanelActiveForBatch();
  const rows = fromSearch ? getSelectedSearchRows() : getSelectedDetailRows();
  if (!rows.length) {
    alert("请先选择曲目。");
    return;
  }
  const likedIds = loadLikedSet();
  let n = 0;
  let skip = 0;
  for (const r of rows) {
    const sid = fromSearch
      ? String(r.source_id ?? "").trim()
      : String(r.pjmp3_source_id ?? "").trim();
    if (!sid) {
      skip++;
      continue;
    }
    likedIds.add(sid);
    n++;
  }
  saveLikedSet(likedIds);
  alert(`已标记喜欢 ${n} 首${skip ? `，${skip} 首无曲库 id 已跳过` : ""}。`);
}

async function openPlaylistDetail(id, name) {
  exitDetailSelectMode();
  exitSearchSelectMode();
  openPlaylistCtx = { id, name };
  const root = document.getElementById("mobile-app");
  const titleEl = document.getElementById("cp-m-page-title");
  const detail = document.getElementById("cp-m-pl-detail");
  const ul = document.getElementById("cp-m-pl-tracks-ul");
  if (root) root.classList.add("cp-mobile-library--detail");
  if (titleEl) titleEl.textContent = name;
  if (!ul || !detail) return;
  ul.innerHTML = "";
  detail.classList.remove("hidden");
  let rows = [];
  try {
    rows = await invoke("list_playlist_import_items", { playlistId: id });
  } catch (e) {
    console.warn("list_playlist_import_items", e);
  }
  playlistDetailRows = rows;
  const heroCover = document.getElementById("cp-m-pl-hero-cover");
  const heroTitle = document.getElementById("cp-m-pl-hero-title");
  const heroSub = document.getElementById("cp-m-pl-hero-sub");
  const firstCover =
    rows.map((r) => ((r.cover_url || "") + "").trim()).find((u) => u.length > 0) || PLACEHOLDER_COVER;
  if (heroCover) {
    heroCover.referrerPolicy = "no-referrer";
    heroCover.src = firstCover;
    heroCover.onerror = () => {
      heroCover.onerror = null;
      heroCover.src = PLACEHOLDER_COVER;
    };
  }
  if (heroTitle) heroTitle.textContent = name;
  if (heroSub) heroSub.textContent = `共 ${rows.length} 首导入曲目`;

  rows.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "cp-m-pl-track";
    const sid = (r.pjmp3_source_id || "").trim();
    const ok = !!sid;
    li.innerHTML = `<span class="cp-m-pl-track-check" aria-hidden="true"></span><div class="cp-m-pl-track-main"><div class="cp-m-li-title">${escapeHtml(r.title || "—")}</div><div class="cp-m-li-sub">${escapeHtml(r.artist || "")}${ok ? "" : " · 无曲库 id"}</div></div>`;
    if (!ok) li.style.opacity = "0.5";
    wirePlaylistDetailTrackRow(li, r, i, rows);
    ul.appendChild(li);
  });
}

function closePlaylistDetail() {
  exitDetailSelectMode();
  playlistDetailRows = [];
  openPlaylistCtx = null;
  const root = document.getElementById("mobile-app");
  const titleEl = document.getElementById("cp-m-page-title");
  const detail = document.getElementById("cp-m-pl-detail");
  if (root) root.classList.remove("cp-mobile-library--detail");
  if (titleEl) titleEl.textContent = "我的音乐";
  if (detail) detail.classList.add("hidden");
}

function wireSearchResultRow(li, r, i, results) {
  li.dataset.rowIndex = String(i);
  const clearTimer = () => {
    if (searchRowLongPressTimer) {
      window.clearTimeout(searchRowLongPressTimer);
      searchRowLongPressTimer = 0;
    }
  };
  const onLongPress = () => {
    searchRowLongPressTimer = 0;
    searchRowLongPressSuppressClick = true;
    if (!searchSelectMode) {
      enterSearchSelectMode(i);
    } else {
      toggleSearchRowSelection(i, li);
    }
  };
  li.addEventListener(
    "touchstart",
    () => {
      clearTimer();
      searchRowLongPressTimer = window.setTimeout(onLongPress, DETAIL_LONG_MS);
    },
    { passive: true },
  );
  li.addEventListener("touchend", clearTimer);
  li.addEventListener("touchmove", clearTimer);
  li.addEventListener("touchcancel", clearTimer);
  li.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    clearTimer();
    onLongPress();
  });
  li.addEventListener("click", () => {
    if (searchRowLongPressSuppressClick) {
      searchRowLongPressSuppressClick = false;
      return;
    }
    if (searchSelectMode) {
      toggleSearchRowSelection(i, li);
      return;
    }
    playQueue = results.map((x) => ({
      source_id: x.source_id,
      title: x.title,
      artist: x.artist || "",
      album: x.album || "",
      cover_url: x.cover_url || null,
    }));
    void playFromQueueIndex(i);
    closeSearchPanel();
  });
}

async function runDiscoverSearch() {
  exitSearchSelectMode();
  const inp = document.getElementById("cp-m-search");
  const kw = (inp?.value || "").trim();
  const ul = document.getElementById("cp-m-discover-ul");
  const hint = document.getElementById("cp-m-discover-hint");
  if (!kw || !ul) return;
  if (hint) hint.textContent = "搜索中…";
  ul.innerHTML = "";
  searchResultRows = [];
  try {
    const res = await invoke("search_songs", { keyword: kw, page: 1 });
    const results = res.results || [];
    searchResultRows = results;
    if (hint) hint.textContent = results.length ? `共 ${results.length} 条` : "无结果";
    results.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "cp-m-search-row";
      li.innerHTML = `<span class="cp-m-pl-track-check" aria-hidden="true"></span><div class="cp-m-pl-track-main"><div class="cp-m-li-title">${escapeHtml(r.title)}</div><div class="cp-m-li-sub">${escapeHtml(r.artist || "")}</div></div>`;
      wireSearchResultRow(li, r, i, results);
      ul.appendChild(li);
    });
  } catch (e) {
    console.warn("search_songs", e);
    if (hint) hint.textContent = `搜索失败：${errText(e)}`;
    searchResultRows = [];
  }
}

async function playFromQueueIndex(idx) {
  if (!playQueue.length || idx < 0 || idx >= playQueue.length) return;
  const generation = ++playLoadGeneration;
  revokeMobileAudioObjectUrl();
  playIndex = idx;
  let item = playQueue[idx];
  setChrome({
    title: item.title,
    sub: item.local_path ? `${item.artist || ""} · 本地` : `${item.artist || ""} · 在线`,
    coverUrl: item.cover_url || null,
  });
  const playBtn = document.getElementById("cp-m-play");
  const a = audioEl();
  /** 在线且最终走直链时写入最近播放，供 `resolve_online_play` 的 recent 分支 */
  let onlineResolvedPlayUrl = null;
  /** @type {Record<string, unknown> | null} */
  let playLogExtra = null;
  try {
    let assetUrl;
    if (item.local_path) {
      const pathOk = await invoke("local_path_accessible", { path: item.local_path });
      if (!pathOk) {
        alert("本地文件不可用");
        return;
      }
      assetUrl = await playableUrlFromLocalPath(item.local_path);
      playLogExtra = { local: true };
    } else {
      let songId = (item.source_id || "").trim();
      const iPl = item.import_playlist_id;
      const iRow = item.import_item_id;
      if (!songId && iPl != null && iRow != null) {
        setChrome({
          title: item.title,
          sub: "正在匹配曲库 id…",
          coverUrl: item.cover_url || null,
        });
        try {
          const filled = await invoke("try_fill_playlist_item_source_id", {
            playlistId: iPl,
            itemId: iRow,
          });
          if (generation !== playLoadGeneration) return;
          if (filled && String(filled).trim()) {
            const fid = String(filled).trim();
            item = { ...item, source_id: fid };
            playQueue[idx] = item;
            songId = fid;
            const match = playlistDetailRows.find((row) => Number(row.id) === Number(iRow));
            if (match) match.pjmp3_source_id = fid;
            patchPlaylistDetailRowAfterFill(Number(iRow), fid);
          }
        } catch (e) {
          console.warn("try_fill_playlist_item_source_id", e);
        }
      }
      if (generation !== playLoadGeneration) return;
      if (!songId) {
        setChrome({
          title: item.title,
          sub: "无法播放：未匹配到曲库 id",
          coverUrl: item.cover_url || null,
        });
        alert("无法匹配曲库 id。请在「发现」中搜索该曲，或确认歌名/歌手是否正确。");
        return;
      }
      /** 后端顺序：本地曲库 → 下载记录(曲库id) → 下载目录同名 → 试听缓存 → 最近播放直链 → 拉取试听/直链（与桌面相同重试） */
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
            songId,
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
        /** 仍记录直链，供 record_recent_play / 桌面端逻辑一致；与桌面 main.js 一致：直链赋给 `<audio>` */
        onlineResolvedPlayUrl = resolved.url;
        assetUrl = resolved.url;
      } else if (resolved.kind === "file" && resolved.path) {
        assetUrl = await playableUrlFromLocalPath(resolved.path);
      } else {
        throw new Error("resolve_online_play: 无效结果");
      }
      playLogExtra = {
        sid: songId,
        kind: resolved.kind,
        via: resolved.via,
      };
    }
    if (generation !== playLoadGeneration) return;
    await logPlayEventMobile("play_start", {
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
    pushMobileRecentFromCurrentTrack(onlineResolvedPlayUrl);
    setChrome({
      title: item.title,
      sub: item.local_path ? `${item.artist || ""} · 本地` : `${item.artist || ""} · 在线`,
      coverUrl: item.cover_url || null,
    });
    if (playBtn) playBtn.textContent = "⏸";
  } catch (e) {
    console.warn("playFromQueueIndex", e);
    setChrome({
      title: item.title,
      sub: "请求失败",
      coverUrl: item.cover_url || null,
    });
    alert(`无法播放：${errText(e)}`);
  }
}

function wirePlayer() {
  const a = audioEl();
  const playBtn = document.getElementById("cp-m-play");
  const seek = document.getElementById("cp-m-seek");

  a.addEventListener("timeupdate", syncSeekUi);
  a.addEventListener("loadedmetadata", () => {
    syncSeekUi();
    if (audioSourceGeneration === playLoadGeneration) {
      void logPlayEventMobile("audio_loadedmetadata", {
        url: a.src || null,
        extra: audioDiagPayload(a),
      });
    }
  });
  a.addEventListener("progress", () => {
    if (audioSourceGeneration !== playLoadGeneration) return;
    const now = Date.now();
    if (now - audioProgressLogLastTs < 1000) return;
    audioProgressLogLastTs = now;
    void logPlayEventMobile("audio_progress", {
      url: a.src || null,
      extra: audioDiagPayload(a),
    });
  });
  a.addEventListener("stalled", () => {
    if (audioSourceGeneration !== playLoadGeneration) return;
    void logPlayEventMobile("audio_stalled", {
      url: a.src || null,
      extra: audioDiagPayload(a),
    });
  });
  a.addEventListener("ended", () => {
    if (audioSourceGeneration === playLoadGeneration) {
      void logPlayEventMobile("audio_ended", {
        url: a.src || null,
        extra: audioDiagPayload(a),
      });
    }
    if (playIndex < playQueue.length - 1) {
      void playFromQueueIndex(playIndex + 1);
    } else if (playBtn) {
      playBtn.textContent = "▶";
    }
    syncSeekUi();
  });
  /** 与桌面一致：丢弃切歌过程中的 error；4 = SRC_NOT_SUPPORTED（直链/WebView 策略） */
  a.addEventListener("error", () => {
    const err = a.error;
    if (err && err.code === 1) return;
    if (audioSourceGeneration !== playLoadGeneration) return;
    void logPlayEventMobile("audio_error", {
      url: a.src || null,
      error_code: err ? err.code : null,
      message: err && err.message ? err.message : null,
      extra: audioDiagPayload(a),
    });
    const sub = document.getElementById("cp-m-dock-sub");
    if (sub && err && err.code === 4) {
      sub.textContent = "无法加载音频（可重试）";
    }
  });
  a.addEventListener("play", () => {
    if (playBtn) playBtn.textContent = "⏸";
  });
  a.addEventListener("pause", () => {
    if (playBtn) playBtn.textContent = "▶";
  });

  playBtn?.addEventListener("click", async () => {
    if (!a.src) return;
    try {
      if (a.paused) await a.play();
      else a.pause();
    } catch (e) {
      console.warn(e);
    }
  });
  document.getElementById("cp-m-prev")?.addEventListener("click", () => {
    if (playIndex > 0) void playFromQueueIndex(playIndex - 1);
  });
  document.getElementById("cp-m-next")?.addEventListener("click", () => {
    if (playIndex < playQueue.length - 1) void playFromQueueIndex(playIndex + 1);
  });

  seek?.addEventListener("pointerdown", () => {
    seekDragging = true;
  });
  seek?.addEventListener("pointerup", () => {
    seekDragging = false;
    syncSeekUi();
  });
  seek?.addEventListener("input", () => {
    const d = a.duration;
    if (d && Number.isFinite(d) && d > 0) {
      a.currentTime = (Number(seek.value) / 1000) * d;
    }
  });
}

export function startMobileApp() {
  setChrome({ title: "未播放", sub: "选择曲目开始", coverUrl: null });
  const c = document.getElementById("cp-m-dock-cover");
  if (c) c.src = PLACEHOLDER_COVER;

  document.getElementById("cp-m-pl-back")?.addEventListener("click", () => {
    if (detailSelectMode) exitDetailSelectMode();
    else closePlaylistDetail();
  });
  document.getElementById("cp-m-pl-select-all")?.addEventListener("click", () => toggleDetailSelectAll());
  document.getElementById("cp-m-pl-act-delete")?.addEventListener("click", () => void runDetailDelete());
  document.getElementById("cp-m-pl-act-addto")?.addEventListener("click", () => void openAddToPanel());
  document.getElementById("cp-m-pl-act-download")?.addEventListener("click", () => {
    if (selectedDetailIds.size === 0) {
      alert("请先选择曲目。");
      return;
    }
    openDlQualityPanel();
  });
  document.getElementById("cp-m-pl-act-like")?.addEventListener("click", () => runBatchLike());
  document.getElementById("cp-m-search-select-all")?.addEventListener("click", () => toggleSearchSelectAll());
  document.getElementById("cp-m-search-act-addto")?.addEventListener("click", () => void openAddToPanel());
  document.getElementById("cp-m-search-act-download")?.addEventListener("click", () => {
    if (selectedSearchIndices.size === 0) {
      alert("请先选择曲目。");
      return;
    }
    openDlQualityPanel();
  });
  document.getElementById("cp-m-search-act-like")?.addEventListener("click", () => runBatchLike());
  document.getElementById("cp-m-addto-close")?.addEventListener("click", () => closeAddToPanel());
  document.getElementById("cp-m-addto-new")?.addEventListener("click", async () => {
    const items = mapRowsToAppendItems(getSelectedRowsForBatch());
    if (!items.length) {
      alert("请先选择曲目。");
      return;
    }
    const name = window.prompt("新歌单名称", "新歌单");
    if (!name || !name.trim()) return;
    try {
      const pid = await invoke("create_playlist", { name: name.trim() });
      await invoke("append_playlist_import_items", { playlistId: pid, items });
      closeAddToPanel();
      alert(`已创建「${name.trim()}」并添加 ${items.length} 首。`);
      void refreshPlaylists();
    } catch (e) {
      console.warn("create_playlist / append", e);
      alert(`失败：${errText(e)}`);
    }
  });
  document.getElementById("cp-m-dl-quality-cancel")?.addEventListener("click", () => closeDlQualityPanel());
  document.querySelectorAll(".cp-m-dl-quality-btn[data-cp-quality]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-cp-quality") || "128";
      void runBatchDownloadWithQuality(q);
    });
  });
  document.getElementById("cp-m-nav-search")?.addEventListener("click", () => openSearchPanel());
  document.getElementById("cp-m-search-close")?.addEventListener("click", () => {
    if (searchSelectMode) exitSearchSelectMode();
    else closeSearchPanel();
  });
  document.getElementById("cp-m-nav-settings")?.addEventListener("click", () => {
    alert("偏好设置请在桌面端 CloudPlayer 中修改。");
  });

  document.getElementById("cp-m-qa-dl")?.addEventListener("click", () => {
    alert("下载目录与队列请在桌面端管理。");
  });
  document.getElementById("cp-m-qa-fav")?.addEventListener("click", () => {
    alert("收藏功能即将与桌面端同步。");
  });
  document.getElementById("cp-m-qa-local")?.addEventListener("click", () => {
    alert("本地音乐扫描请在桌面端「本地和下载」中操作。");
  });
  document.getElementById("cp-m-qa-import")?.addEventListener("click", () => openImportPanel());

  document.getElementById("cp-m-search-go")?.addEventListener("click", () => void runDiscoverSearch());
  document.getElementById("cp-m-search")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void runDiscoverSearch();
    }
  });

  wireImportPanel();
  wirePlayer();
  void refreshPlaylists();
  void refreshRecent();
}
