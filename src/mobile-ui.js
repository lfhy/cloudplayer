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

const PLACEHOLDER_COVER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect fill='%23e5e7eb' width='48' height='48'/%3E%3C/svg%3E";

/** @type {Array<{ source_id?: string; title: string; artist: string; album?: string; cover_url?: string | null; local_path?: string }>} */
let playQueue = [];
let playIndex = 0;
let playLoadGeneration = 0;
let audioSourceGeneration = 0;
let seekDragging = false;

/** @type {{ id: number; name: string } | null} */
let openPlaylistCtx = null;

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

function openSearchPanel() {
  const p = document.getElementById("cp-m-search-panel");
  const inp = document.getElementById("cp-m-search");
  if (p) p.classList.remove("hidden");
  inp?.focus();
}

function closeSearchPanel() {
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

async function openPlaylistDetail(id, name) {
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
    const sid = (r.pjmp3_source_id || "").trim();
    const ok = !!sid;
    li.innerHTML = `<div><div class="cp-m-li-title">${escapeHtml(r.title || "—")}</div><div class="cp-m-li-sub">${escapeHtml(r.artist || "")}${ok ? "" : " · 无曲库 id"}</div></div>`;
    if (ok) {
      li.addEventListener("click", () => {
        const playable = rows
          .filter((row) => (row.pjmp3_source_id || "").trim())
          .map((row) => ({
            source_id: (row.pjmp3_source_id || "").trim(),
            title: row.title,
            artist: row.artist || "",
            album: row.album || "",
            cover_url: (row.cover_url || "").trim() || null,
          }));
        let start = 0;
        for (let j = 0; j < i; j++) {
          if ((rows[j].pjmp3_source_id || "").trim()) start++;
        }
        playQueue = playable;
        void playFromQueueIndex(start);
      });
    } else {
      li.style.opacity = "0.5";
    }
    ul.appendChild(li);
  });
}

function closePlaylistDetail() {
  openPlaylistCtx = null;
  const root = document.getElementById("mobile-app");
  const titleEl = document.getElementById("cp-m-page-title");
  const detail = document.getElementById("cp-m-pl-detail");
  if (root) root.classList.remove("cp-mobile-library--detail");
  if (titleEl) titleEl.textContent = "我的音乐";
  if (detail) detail.classList.add("hidden");
}

async function runDiscoverSearch() {
  const inp = document.getElementById("cp-m-search");
  const kw = (inp?.value || "").trim();
  const ul = document.getElementById("cp-m-discover-ul");
  const hint = document.getElementById("cp-m-discover-hint");
  if (!kw || !ul) return;
  if (hint) hint.textContent = "搜索中…";
  ul.innerHTML = "";
  try {
    const res = await invoke("search_songs", { keyword: kw, page: 1 });
    const results = res.results || [];
    if (hint) hint.textContent = results.length ? `共 ${results.length} 条` : "无结果";
    results.forEach((r, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<div><div class="cp-m-li-title">${escapeHtml(r.title)}</div><div class="cp-m-li-sub">${escapeHtml(r.artist || "")}</div></div>`;
      li.addEventListener("click", () => {
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
      ul.appendChild(li);
    });
  } catch (e) {
    console.warn("search_songs", e);
    if (hint) hint.textContent = `搜索失败：${errText(e)}`;
  }
}

async function playFromQueueIndex(idx) {
  if (!playQueue.length || idx < 0 || idx >= playQueue.length) return;
  const generation = ++playLoadGeneration;
  playIndex = idx;
  const item = playQueue[idx];
  setChrome({
    title: item.title,
    sub: item.local_path ? `${item.artist || ""} · 本地` : `${item.artist || ""} · 在线`,
    coverUrl: item.cover_url || null,
  });
  const playBtn = document.getElementById("cp-m-play");
  const a = audioEl();
  try {
    let assetUrl;
    if (item.local_path) {
      const pathOk = await invoke("local_path_accessible", { path: item.local_path });
      if (!pathOk) {
        alert("本地文件不可用");
        return;
      }
      assetUrl = convertFileSrc(item.local_path);
    } else {
      const resolved = await invoke("resolve_online_play", {
        songId: item.source_id,
        title: item.title || "",
        artist: item.artist || "",
      });
      if (generation !== playLoadGeneration) return;
      if (resolved.kind === "url" && resolved.url) {
        assetUrl = resolved.url;
      } else if (resolved.kind === "file" && resolved.path) {
        assetUrl = convertFileSrc(resolved.path);
      } else {
        throw new Error("无效播放地址");
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
    if (playBtn) playBtn.textContent = "⏸";
  } catch (e) {
    console.warn("playFromQueueIndex", e);
    alert("无法播放");
  }
}

function wirePlayer() {
  const a = audioEl();
  const playBtn = document.getElementById("cp-m-play");
  const seek = document.getElementById("cp-m-seek");

  a.addEventListener("timeupdate", syncSeekUi);
  a.addEventListener("loadedmetadata", syncSeekUi);
  a.addEventListener("ended", () => {
    if (playIndex < playQueue.length - 1) {
      void playFromQueueIndex(playIndex + 1);
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

  document.getElementById("cp-m-pl-back")?.addEventListener("click", () => closePlaylistDetail());
  document.getElementById("cp-m-nav-search")?.addEventListener("click", () => openSearchPanel());
  document.getElementById("cp-m-search-close")?.addEventListener("click", () => closeSearchPanel());
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
