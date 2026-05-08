import { setCoverImageSource } from "../../app/helpers/covers.js";
import { renderTrackTableRows } from "./trackTableRenderer.js";
import { createPlaylistBatchController } from "./playlistBatchController.js";
import { createPlaylistEnrichHelpers } from "./playlistEnrichHelpers.js";
import { playPlaylistRows, searchLocalPlaylists as searchLocalPlaylistsHelper } from "./playlistRowHelpers.js";
import { triggerTrackSearch } from "./trackSearchShortcut.js";
import { syncLikedIdsFromPlaylist, syncLikedIdsFromRows } from "./favoriteState.js";
import { toggleFavoriteTrack } from "./favoriteToggle.js";
import { renderPlaylistTableLoading, renderSidebarPlaylistLoading } from "./playlistLoadingView.js";
import { buildSidebarPlaylistItem, playlistSidebarEmptyText } from "./playlistSidebarView.js";
// Playlist controller handles sidebar, hero metadata, and playlist search helpers.
export function createPlaylistController(deps) {
    const {
      alertRequestFailed,
      escapeHtml,
      formatDurationMs,
      getImportTracks,
      getLikedIds,
      getMusicOnlineModeEnabled,
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
  const batch = createPlaylistBatchController({
    alertRequestFailed,
    getMusicOnlineModeEnabled,
    getPlaylistDetailRows,
    getSelectedPlaylistId,
    getSelectedPlaylistName,
    invoke,
    loadPlaylistDetail,
    playFromQueueIndex,
    refreshPlaylistSelect,
    refreshSidebarPlaylists,
    renderPlaylistDetailTable,
    renderQueuePanel,
    setPlayQueue,
  });
  let cachedSidebarPlaylists = [];
  let playlistDetailLoading = false;
  function currentSelectedPlaylist() {
    return cachedSidebarPlaylists.find((item) => Number(item.id) === Number(getSelectedPlaylistId())) || null;
  }
  function shouldRefreshLikedPlaylist(playlist) {
    return !!playlist && (playlist.is_builtin === true || playlist.is_favorites === true);
  }
  function refreshPlaylistActionState() {
    const playlist = currentSelectedPlaylist();
    const renameBtn = document.getElementById("btn-playlist-rename");
    const enrichBtn = document.getElementById("btn-playlist-enrich");
    if (!renameBtn) return;
    const builtin = playlist?.is_builtin === true;
    const cloudMode = !!getMusicOnlineModeEnabled?.() || playlist?.is_cloud === true;
    renameBtn.disabled = getSelectedPlaylistId() == null || builtin;
    renameBtn.hidden = builtin;
    if (enrichBtn) enrichBtn.hidden = builtin || cloudMode;
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
    renderSidebarPlaylistLoading(force ? "正在刷新歌单…" : "正在加载歌单…");
    let playlists = [];
    try {
      playlists = await invoke(force ? "refresh_playlists" : "list_playlists");
    } catch (error) {
      warnRequestFailed(error, "list_playlists sidebar");
      list.innerHTML = `<li class="sidebar-pl-empty muted">${escapeHtml(MSG_REQUEST_FAILED)}</li>`;
      return;
    }
    if (!playlists.length) {
      list.innerHTML = `<li class="sidebar-pl-empty muted">${escapeHtml(playlistSidebarEmptyText(getMusicOnlineModeEnabled?.()))}</li>`;
      return;
    }
    list.innerHTML = "";
    cachedSidebarPlaylists = Array.isArray(playlists) ? playlists : [];
    playlists.forEach((playlist) => {
      void syncLikedIdsFromPlaylist(playlist, invoke, getLikedIds).catch((error) => {
        console.warn("sync favorite ids from sidebar playlist", error);
      });
      const li = buildSidebarPlaylistItem(playlist, escapeHtml);
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
    return searchLocalPlaylistsHelper(invoke, keyword);
  }

  async function loadPlaylistDetail(id, name, force = false) {
    setSelectedPlaylist(id, name || "");
    syncSidebarPlaylistActiveState(id, true);
    playlistDetailLoading = true;
    batch.clearSelection();
    batch.updatePlaylistToolbar({ busy: true });
    const titleEl = document.getElementById("playlist-page-title");
    if (titleEl) titleEl.textContent = name || "歌单";
    renderPlaylistTableLoading(force ? "正在刷新歌单内容…" : "正在加载歌单内容…");
    const hintEl = document.getElementById("playlist-page-hint");
    if (hintEl) hintEl.textContent = "";
    try {
      const rows = await invoke(force ? "refresh_playlist_import_items" : "list_playlist_import_items", { playlistId: id });
      const orderedRows = Array.isArray(rows) ? rows : [];
      setPlaylistDetailRows(orderedRows);
      if (currentSelectedPlaylist()?.is_builtin || currentSelectedPlaylist()?.is_favorites) {
        syncLikedIdsFromRows(orderedRows, getLikedIds);
      }
      if (!currentSelectedPlaylist()?.is_builtin && !currentSelectedPlaylist()?.is_cloud) void enrich.maybeEnrichPlaylist(id, orderedRows);
    } catch (error) {
      setPlaylistDetailRows([]);
      alertRequestFailed(error, "list_playlist_import_items");
    } finally {
      playlistDetailLoading = false;
    }
    renderPlaylistDetailTable();
    refreshPlaylistActionState();
  }

  function renderPlaylistDetailTable() {
    if (playlistDetailLoading) return;
    const tbody = document.querySelector("#playlist-detail-table tbody");
    if (!tbody) return;
    const rows = getPlaylistDetailRows();
    const selectedPlaylist = currentSelectedPlaylist();
    const playable = rows.filter((row) => (row.pjmp3_source_id || "").trim());
    document.getElementById("btn-playlist-play-all")?.toggleAttribute("disabled", playable.length === 0);
    const countEl = document.getElementById("playlist-track-count");
    const hintEl = document.getElementById("playlist-page-hint");
    const coverEl = document.getElementById("playlist-hero-cover");
    if (countEl) countEl.textContent = `共 ${rows.length} 首曲目`;
    if (hintEl && !selectedPlaylist?.is_cloud) hintEl.textContent = "";
    setCoverImageSource(coverEl, rows.find((row) => (row.cover_url || "").trim())?.cover_url || "", { size: 120, radius: 12 });
    renderTrackTableRows(tbody, rows.map((row) => ({
      ...row,
      like_source_id: row.pjmp3_source_id,
      playable: !!(row.pjmp3_source_id || "").trim(),
    })), {
      batchMode: batch.isBatchMode(),
      emptyMessage: "暂无导入曲目，或请从左侧选择其它歌单。",
      escapeHtml,
      forceLiked: selectedPlaylist?.is_builtin === true || selectedPlaylist?.is_favorites === true,
      formatDurationMs,
      getRowSelectionKey: batch.rowSelectionKey,
      getLikedIds,
      includeCheck: true,
      isSelected: batch.isSelected,
      onAlbumClick: (album) => triggerTrackSearch(album),
      onArtistClick: (artist) => triggerTrackSearch(artist),
      onFavoriteClick: (row) => toggleFavoriteTrack(row, {
        alertRequestFailed,
        getLikedIds,
        invoke,
        onAfterToggle: async () => {
          if (!shouldRefreshLikedPlaylist(selectedPlaylist)) return;
          await loadPlaylistDetail(selectedPlaylist.id, selectedPlaylist.name || "", true);
        },
      }),
      onClick: (index) => playFromPlaylistRow(index),
      onContextMenu: (event, index) => openPlaylistDetailRowContextMenu(event, index),
      onToggleSelected: (row, index, selected) => batch.setRowSelected(row, index, selected),
      rowTitle: (row) => (row.playable ? "" : "无曲库 id：请到「搜索」搜索后播放"),
    });
    batch.updatePlaylistToolbar();
  }

  function playFromPlaylistRow(rowIdx) {
    playPlaylistRows(getPlaylistDetailRows(), rowIdx, { alert, playFromQueueIndex, renderQueuePanel, setPlayQueue });
  }

  function wirePlaylistPage() {
    batch.wirePlaylistBatchToolbar();
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
    batch,
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
