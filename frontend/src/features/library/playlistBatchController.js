// Playlist batch controller owns selection state and bulk actions for rows.
import { buildPlayablePlaylistQueue } from "./playlistRowHelpers.js";

export function createPlaylistBatchController(deps) {
  const {
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
  } = deps;
  let batchMode = false;
  let selectedIds = new Set();
  function rowSelectionKey(row, index) {
    return String(row?.id ?? row?.pjmp3_source_id ?? row?.source_id ?? index);
  }
  function clearSelection() {
    selectedIds = new Set();
  }
  function isBatchMode() {
    return batchMode;
  }
  function getSelectedIds() {
    return selectedIds;
  }
  function isSelected(row, index) {
    return selectedIds.has(rowSelectionKey(row, index));
  }
  function updatePlaylistToolbar({ busy = false } = {}) {
    const rows = getPlaylistDetailRows();
    const selectedCount = selectedIds.size;
    const totalCount = rows.length;
    const playlistHint = document.getElementById("playlist-page-hint");
    const table = document.getElementById("playlist-detail-table");
    const selectAllCheckbox = document.getElementById("playlist-select-all-checkbox");
    const selectAllHeader = selectAllCheckbox?.closest(".col-check");
    const batchModeBtn = document.getElementById("btn-playlist-batch-mode");
    const batchDoneBtn = document.getElementById("btn-playlist-batch-done");
    const selectAllBtn = document.getElementById("btn-playlist-select-all");
    const playSelectedBtn = document.getElementById("btn-playlist-play-selected");
    const addSelectedBtn = document.getElementById("btn-playlist-add-selected");
    const deleteSelectedBtn = document.getElementById("btn-playlist-delete-selected");
    const playAllBtn = document.getElementById("btn-playlist-play-all");
    if (playlistHint) playlistHint.textContent = batchMode ? `已选 ${selectedCount} 首` : "";
    if (table) table.classList.toggle("search-table--batch-mode", batchMode);
    if (selectAllHeader) selectAllHeader.hidden = !batchMode;
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = totalCount > 0 && selectedCount === totalCount;
      selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCount;
      selectAllCheckbox.disabled = !batchMode || !totalCount || busy;
    }
    if (batchModeBtn) batchModeBtn.hidden = batchMode;
    if (batchDoneBtn) batchDoneBtn.hidden = !batchMode;
    if (selectAllBtn) selectAllBtn.hidden = !batchMode;
    if (playSelectedBtn) playSelectedBtn.hidden = !batchMode;
    if (addSelectedBtn) addSelectedBtn.hidden = !batchMode;
    if (deleteSelectedBtn) deleteSelectedBtn.hidden = !batchMode;
    if (playAllBtn) playAllBtn.hidden = batchMode;
    batchModeBtn?.toggleAttribute("disabled", !totalCount || busy);
    batchDoneBtn?.toggleAttribute("disabled", busy);
    selectAllBtn?.toggleAttribute("disabled", !totalCount || busy);
    playSelectedBtn?.toggleAttribute("disabled", selectedCount === 0 || busy);
    addSelectedBtn?.toggleAttribute("disabled", selectedCount === 0 || busy);
    deleteSelectedBtn?.toggleAttribute("disabled", selectedCount === 0 || busy || !getSelectedPlaylistId());
  }
  function enterBatchMode() {
    batchMode = true;
    clearSelection();
    updatePlaylistToolbar();
    renderPlaylistDetailTable();
  }
  function exitBatchMode() {
    batchMode = false;
    clearSelection();
    updatePlaylistToolbar();
    renderPlaylistDetailTable();
  }
  function setRowSelected(row, index, selected) {
    const next = new Set(selectedIds);
    const key = rowSelectionKey(row, index);
    if (selected) next.add(key);
    else next.delete(key);
    selectedIds = next;
    updatePlaylistToolbar();
    renderPlaylistDetailTable();
  }
  function setAllRowsSelected(selected) {
    const rows = getPlaylistDetailRows();
    selectedIds = selected ? new Set(rows.map((row, index) => rowSelectionKey(row, index))) : new Set();
    updatePlaylistToolbar();
    renderPlaylistDetailTable();
  }
  function selectedRows() {
    return getPlaylistDetailRows().filter((row, index) => isSelected(row, index));
  }
  function playSelectedRows() {
    const queue = buildPlayablePlaylistQueue(selectedRows());
    if (!queue.length) return void alert("所选条目里没有可播放的曲库 id。");
    setPlayQueue(queue);
    void playFromQueueIndex(0);
    renderQueuePanel();
  }
  async function appendSelectedToPlaylist() {
    const rows = selectedRows();
    if (!rows.length) return;
    if (getMusicOnlineModeEnabled?.() && rows.some((row) => !(row.pjmp3_source_id || "").startsWith("kugou:"))) {
      return void alert("在线模式下只能把酷狗云端歌曲添加到云歌单。");
    }
    const currentPlaylistId = getSelectedPlaylistId();
    let playlists = [];
    try {
      playlists = await invoke("list_playlists");
    } catch (error) {
      alertRequestFailed(error, "list_playlists playlist batch");
      return;
    }
    const defaultName = rows[0]?.title ? `${rows[0].title} 等` : "新歌单";
    const availablePlaylists = (Array.isArray(playlists) ? playlists : []).filter((playlist) => playlist.id != null && Number(playlist.id) !== Number(currentPlaylistId));
    const options = availablePlaylists.length
      ? `${availablePlaylists.map((playlist) => `${playlist.id}: ${playlist.name}`).join("\n")}\n留空则新建歌单`
      : "暂无其它歌单，留空将新建歌单";
    const value = window.prompt(`输入歌单 ID，或留空新建歌单：\n${options}`, "");
    let playlistId = Number(String(value || "").trim());
    if (!playlistId) {
      const name = window.prompt("新歌单名称", defaultName);
      if (!name || !name.trim()) return;
      try {
        playlistId = await invoke("create_playlist", { name: name.trim() });
      } catch (error) {
        alertRequestFailed(error, "create_playlist playlist batch");
        return;
      }
    }
    try {
      await invoke("append_playlist_import_items", {
        playlistId,
        items: rows.map((row) => ({
          title: row.title,
          artist: row.artist || "",
          album: row.album || "",
          pjmp3_source_id: row.pjmp3_source_id || "",
          cover_url: row.cover_url || "",
          duration_ms: Number(row.duration_ms || 0) || 0,
        })),
      });
      clearSelection();
      await refreshSidebarPlaylists(true);
      await refreshPlaylistSelect(true);
      updatePlaylistToolbar();
      renderPlaylistDetailTable();
    } catch (error) {
      alertRequestFailed(error, "append_playlist_import_items playlist batch");
    }
  }
  async function deleteSelectedRows() {
    const rows = selectedRows();
    if (!rows.length) return;
    if (!window.confirm("确认删除所选条目？")) return;
    const playlistId = getSelectedPlaylistId();
    for (const row of rows) {
      if (row.id == null) continue;
      await invoke("delete_playlist_import_item", { playlistId, itemId: row.id });
    }
    await loadPlaylistDetail(playlistId, getSelectedPlaylistName(), true);
    await refreshPlaylistSelect(true);
  }
  function wirePlaylistBatchToolbar() {
    document.getElementById("btn-playlist-batch-mode")?.addEventListener("click", () => enterBatchMode());
    document.getElementById("btn-playlist-batch-done")?.addEventListener("click", () => exitBatchMode());
    document.getElementById("btn-playlist-select-all")?.addEventListener("click", () => {
      setAllRowsSelected(selectedIds.size !== getPlaylistDetailRows().length);
    });
    document.getElementById("btn-playlist-play-selected")?.addEventListener("click", () => { playSelectedRows(); });
    document.getElementById("btn-playlist-add-selected")?.addEventListener("click", () => { void appendSelectedToPlaylist(); });
    document.getElementById("btn-playlist-delete-selected")?.addEventListener("click", () => { void deleteSelectedRows(); });
    document.getElementById("playlist-select-all-checkbox")?.addEventListener("change", (event) => {
      const target = event.currentTarget;
      setAllRowsSelected(target instanceof HTMLInputElement && target.checked);
    });
  }
  return {
    clearSelection,
    deleteSelectedRows,
    enterBatchMode,
    exitBatchMode,
    getSelectedIds,
    isBatchMode,
    isSelected,
    rowSelectionKey,
    setAllRowsSelected,
    setRowSelected,
    updatePlaylistToolbar,
    wirePlaylistBatchToolbar,
  };
}
