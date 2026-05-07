import { navIconSvg } from "../../app/helpers/icons.js";
import { setCoverImageSource } from "../../app/helpers/covers.js";
import { renderTrackTableRows } from "./trackTableRenderer.js";
import { createPlaylistEnrichHelpers } from "./playlistEnrichHelpers.js";

// Playlist controller handles sidebar, hero metadata, and playlist search helpers.
export function createPlaylistController(deps) {
  const {
    alertRequestFailed,
    escapeHtml,
    formatDurationMs,
    getImportTracks,
    getLikedIds,
    getPlaylistDetailRows,
    getSelectedPlaylistId,
    getSelectedPlaylistName,
    invoke,
    MSG_REQUEST_FAILED,
    openPlaylistDetailRowContextMenu,
    openSidebarPlaylistContextMenu,
    playFromQueueIndex,
    renderHomePage,
    renderQueuePanel,
    setPage,
    setPlaylistDetailRows,
    setPlayQueue,
    setSelectedPlaylist,
    showDeletePlaylistModal,
    showRenamePlaylistModal,
    warnRequestFailed,
  } = deps;
  const enrich = createPlaylistEnrichHelpers({ invoke, warnRequestFailed });

  let cachedSidebarPlaylists = [];

  function currentSelectedPlaylist() {
    return cachedSidebarPlaylists.find((item) => Number(item.id) === Number(getSelectedPlaylistId())) || null;
  }

  function refreshPlaylistActionState() {
    const playlist = currentSelectedPlaylist();
    const renameBtn = document.getElementById("btn-playlist-rename");
    const enrichBtn = document.getElementById("btn-playlist-enrich");
    const enrichAllBtn = document.getElementById("btn-playlist-enrich-all");
    if (!renameBtn) return;
    const builtin = playlist?.is_builtin === true;
    renameBtn.disabled = getSelectedPlaylistId() == null || builtin;
    renameBtn.hidden = builtin;
    if (enrichBtn) enrichBtn.hidden = builtin;
    if (enrichAllBtn) enrichAllBtn.hidden = builtin;
  }

  function syncSidebarPlaylistActiveState(playlistID = getSelectedPlaylistId(), forceActive = false) {
    const list = document.getElementById("sidebar-playlist-list");
    if (!list) return;
    const playlistPageActive =
      forceActive || document.querySelector('.page[data-page="playlist"]')?.classList.contains("page-active") === true;
    list.querySelectorAll(".sidebar-pl-item").forEach((item) => {
      const itemPlaylistID = Number(item.getAttribute("data-playlist-id") || 0);
      const active = playlistPageActive && playlistID != null && itemPlaylistID === Number(playlistID);
      item.classList.toggle("is-active", active);
    });
  }

  async function refreshPlaylistSelect(force = false) {
    const select = document.getElementById("import-merge-playlist");
    const mergeBtn = document.getElementById("btn-import-merge");
    if (!select) {
      await refreshSidebarPlaylists(force);
      return;
    }
    select.innerHTML = "";
    let playlists = [];
    try {
      playlists = await invoke(force ? "refresh_playlists" : "list_playlists");
    } catch (error) {
      console.warn("list_playlists", error);
    }
    cachedSidebarPlaylists = Array.isArray(playlists) ? playlists : [];
    playlists.forEach((playlist) => {
      const option = document.createElement("option");
      option.value = String(playlist.id);
      option.textContent = `${playlist.name} (id=${playlist.id})`;
      select.appendChild(option);
    });
    const hasPlaylists = playlists.length > 0;
    select.disabled = !hasPlaylists;
    if (mergeBtn) mergeBtn.disabled = !hasPlaylists || getImportTracks().length === 0;
    await refreshSidebarPlaylists(force);
  }

  async function refreshSidebarPlaylists(force = false) {
    const list = document.getElementById("sidebar-playlist-list");
    if (!list) return;
    list.innerHTML = "";
    let playlists = [];
    try {
      playlists = await invoke(force ? "refresh_playlists" : "list_playlists");
    } catch (error) {
      warnRequestFailed(error, "list_playlists sidebar");
      const li = document.createElement("li");
      li.className = "sidebar-pl-empty muted";
      li.textContent = MSG_REQUEST_FAILED;
      list.appendChild(li);
      return;
    }
    if (!playlists.length) {
      const li = document.createElement("li");
      li.className = "sidebar-pl-empty muted";
      li.textContent = "暂无歌单 · 与 Py 版共用 ~/.cloudplayer/library.db · 在此页「保存为新歌单」即可出现";
      list.appendChild(li);
      return;
    }
    cachedSidebarPlaylists = Array.isArray(playlists) ? playlists : [];
    playlists.forEach((playlist) => {
      const li = document.createElement("li");
      li.className = "sidebar-pl-item";
      li.setAttribute("data-playlist-id", String(playlist.id));
      li.innerHTML = `
        <span class="sidebar-pl-item__icon" aria-hidden="true">${navIconSvg(playlist.is_builtin ? "favorites" : "playlist")}</span>
        <span class="sidebar-pl-item__label">${escapeHtml(playlist.name?.trim() || `歌单 ${playlist.id}`)}</span>
      `;
      li.title = playlist.is_builtin ? `系统歌单 · id=${playlist.id} · 查看导入曲目` : `id=${playlist.id} · 查看导入曲目`;
      li.addEventListener("click", () => {
        setSelectedPlaylist(playlist.id, playlist.name || "");
        setPage("playlist");
        syncSidebarPlaylistActiveState(playlist.id);
      });
      li.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        void openSidebarPlaylistContextMenu(event, playlist);
      });
      list.appendChild(li);
    });
    syncSidebarPlaylistActiveState();
    refreshPlaylistActionState();
    if (document.querySelector('.page[data-page="home"]')?.classList.contains("page-active")) renderHomePage();
  }

  async function searchLocalPlaylists(keyword) {
    const normalized = String(keyword || "").trim().toLowerCase();
    if (!normalized) return [];
    const playlists = await invoke("list_playlists");
    const results = [];
    for (const playlist of Array.isArray(playlists) ? playlists : []) {
      const playlistName = String(playlist.name || "").trim();
      const rows = await invoke("list_playlist_import_items", { playlistId: playlist.id });
      const matchedTracks = (Array.isArray(rows) ? rows : []).filter((row) => {
        const haystack = [playlistName, row.title || "", row.artist || "", row.album || ""].join(" ").toLowerCase();
        return haystack.includes(normalized);
      });
      const playlistMatched = playlistName.toLowerCase().includes(normalized);
      if (!playlistMatched && matchedTracks.length === 0) continue;
      results.push({
        id: playlist.id,
        name: playlistName || `歌单 ${playlist.id}`,
        trackCount: Array.isArray(rows) ? rows.length : 0,
        matchedTracks,
        coverUrl: matchedTracks.find((row) => (row.cover_url || "").trim())?.cover_url || rows?.find?.((row) => (row.cover_url || "").trim())?.cover_url || null,
      });
    }
    return results;
  }

  async function loadPlaylistDetail(id, name, force = false) {
    setSelectedPlaylist(id, name || "");
    syncSidebarPlaylistActiveState(id, true);
    const titleEl = document.getElementById("playlist-page-title");
    if (titleEl) titleEl.textContent = name || "歌单";
    try {
      const rows = await invoke(force ? "refresh_playlist_import_items" : "list_playlist_import_items", { playlistId: id });
      setPlaylistDetailRows(rows || []);
      if (!currentSelectedPlaylist()?.is_builtin) void enrich.maybeEnrichPlaylist(id, rows || []);
    } catch (error) {
      setPlaylistDetailRows([]);
      alertRequestFailed(error, "list_playlist_import_items");
    }
    renderPlaylistDetailTable();
    refreshPlaylistActionState();
  }

  function renderPlaylistDetailTable() {
    const tbody = document.querySelector("#playlist-detail-table tbody");
    if (!tbody) return;
    const rows = getPlaylistDetailRows();
    const playable = rows.filter((row) => (row.pjmp3_source_id || "").trim());
    document.getElementById("btn-playlist-play-all")?.toggleAttribute("disabled", playable.length === 0);
    const countEl = document.getElementById("playlist-track-count");
    const hintEl = document.getElementById("playlist-page-hint");
    const coverEl = document.getElementById("playlist-hero-cover");
    if (countEl) countEl.textContent = `共 ${rows.length} 首导入曲目`;
    if (hintEl) hintEl.textContent = "";
    setCoverImageSource(coverEl, rows.find((row) => (row.cover_url || "").trim())?.cover_url || "", { size: 120, radius: 12 });
    renderTrackTableRows(tbody, rows.map((row) => ({
      ...row,
      like_source_id: row.pjmp3_source_id,
      playable: !!(row.pjmp3_source_id || "").trim(),
    })), {
      emptyMessage: "暂无导入曲目，或请从左侧选择其它歌单。",
      escapeHtml,
      formatDurationMs,
      getLikedIds,
      onClick: (index) => playFromPlaylistRow(index),
      onContextMenu: (event, index) => openPlaylistDetailRowContextMenu(event, index),
      rowTitle: (row) => (row.playable ? "" : "无曲库 id：请到「搜索」搜索后播放"),
    });
  }

  function playFromPlaylistRow(rowIdx) {
    const rows = getPlaylistDetailRows();
    const row = rows[rowIdx];
    const sourceId = (row?.pjmp3_source_id || "").trim();
    if (!sourceId) return void alert("该条没有曲库 id，请使用顶栏搜索歌名后播放。");
    const queue = rows
      .filter((item) => (item.pjmp3_source_id || "").trim())
      .map((item) => ({
        source_id: (item.pjmp3_source_id || "").trim(),
        title: item.title,
        artist: item.artist || "",
        album: item.album || "",
        cover_url: (item.cover_url || "").trim() || null,
        duration_ms: Number(item.duration_ms || 0) || 0,
      }));
    if (!queue.length) return void alert("没有可播放条目（导入条目需含 pjmp3 曲库 id）。");
    let startInQueue = 0;
    for (let index = 0; index < rowIdx; index += 1) {
      if ((rows[index].pjmp3_source_id || "").trim()) startInQueue += 1;
    }
    setPlayQueue(queue);
    void playFromQueueIndex(startInQueue);
    renderQueuePanel();
  }

  function wirePlaylistPage() {
    document.getElementById("btn-playlist-back")?.addEventListener("click", () => setPage("home"));
    document.getElementById("btn-playlist-refresh")?.addEventListener("click", async () => {
      const playlistID = getSelectedPlaylistId();
      if (playlistID == null) return;
      await refreshSidebarPlaylists(true);
      await loadPlaylistDetail(playlistID, getSelectedPlaylistName(), true);
    });
    document.getElementById("btn-playlist-enrich")?.addEventListener("click", async () => {
      const playlistID = getSelectedPlaylistId();
      if (playlistID == null) return;
      const started = await enrich.maybeEnrichPlaylist(playlistID, getPlaylistDetailRows(), { force: true });
      if (!started) enrich.setStatus("当前歌单没有检测到缺失的播放信息。");
    });
    document.getElementById("btn-playlist-enrich-all")?.addEventListener("click", async () => {
      await enrich.runBatchEnrich(async () => {
        if (getSelectedPlaylistId() != null) {
          await loadPlaylistDetail(getSelectedPlaylistId(), getSelectedPlaylistName());
        }
      });
    });
    document.getElementById("btn-playlist-rename")?.addEventListener("click", async () => {
      if (getSelectedPlaylistId() == null) return;
      if (currentSelectedPlaylist()?.is_builtin) return;
      showRenamePlaylistModal?.(getSelectedPlaylistId(), getSelectedPlaylistName() || "歌单");
    });
    document.getElementById("btn-playlist-play-all")?.addEventListener("click", () => {
      const playable = getPlaylistDetailRows().filter((row) => (row.pjmp3_source_id || "").trim());
      if (!playable.length) return void alert("没有可播放条目（导入条目需含 pjmp3 曲库 id；可先使用「搜索」搜索）。");
      setPlayQueue(playable.map((row) => ({
        source_id: (row.pjmp3_source_id || "").trim(),
        title: row.title,
        artist: row.artist || "",
        album: row.album || "",
        cover_url: (row.cover_url || "").trim() || null,
        duration_ms: Number(row.duration_ms || 0) || 0,
      })));
      void playFromQueueIndex(0);
      renderQueuePanel();
    });
  }

  return {
    loadPlaylistDetail,
    playFromPlaylistRow,
    refreshPlaylistSelect,
    refreshSidebarPlaylists,
    renderPlaylistDetailTable,
    searchLocalPlaylists,
    refreshPlaylistActionState,
    syncSidebarPlaylistActiveState,
    wirePlaylistPage,
  };
}
