import { coverImgHtml } from "../../app/helpers/covers.js";
import { formatDurationMs } from "../../app/helpers/time.js";
import { createCatalogMetadataController } from "./catalogMetadataController.js";

// Catalog results controller owns virtual rows, infinite loading, and multi-select actions.
export function createCatalogResultsController(deps) {
  const {
    alertRequestFailed,
    escapeHtml,
    invoke,
    openSearchRowContextMenu,
    playCatalogAll,
    playFromSearchRow,
    searchState,
    setTableMutedMessage,
    updateSearchToolbar,
    warnRequestFailed,
  } = deps;
  let searchRequestToken = 0;
  const rowHeight = 57;
  const overscanRows = 8;
  const loadMoreThreshold = Math.max(4, Math.floor(rowHeight * 0.1));
  const bottomStatusThreshold = rowHeight * 1.5;
  const metadata = createCatalogMetadataController({ invoke, renderSearchTable, searchState, warnRequestFailed });

  function clearSelection() {
    searchState.selectedIds = new Set();
  }

  function exitBatchMode() {
    searchState.batchMode = false;
    clearSelection();
    updateSearchToolbar();
    renderSearchTable();
  }

  function enterBatchMode() {
    searchState.batchMode = true;
    clearSelection();
    updateSearchToolbar();
    renderSearchTable();
  }

  function renderInitialLoadingState(tbody) {
    if (!tbody) return;
    tbody.innerHTML = `
      <tr class="search-table__loading">
        <td colspan="6">
          <div class="search-table-loading" role="status" aria-live="polite" aria-label="正在搜索">
            <div class="search-table-loading__bars" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>正在搜索…</p>
          </div>
        </td>
      </tr>`;
  }

  function syncBottomStatusVisibility() {
    const scrollWrap = document.getElementById("search-results-scroll");
    if (!scrollWrap || searchState.scope !== "catalog" || !searchState.results.length) {
      searchState.showBottomStatus = false;
      return;
    }
    const remaining = Math.max(0, scrollWrap.scrollHeight - scrollWrap.scrollTop - scrollWrap.clientHeight);
    searchState.showBottomStatus = remaining <= bottomStatusThreshold;
  }

  function renderSearchTable() {
    const tbody = document.querySelector("#search-table tbody");
    if (!tbody) return;
    if (searchState.scope !== "catalog") {
      tbody.innerHTML = "";
      searchState.showBottomStatus = false;
      return;
    }
    if (!searchState.results.length) {
      searchState.showBottomStatus = false;
      if (searchState.busy) {
        renderInitialLoadingState(tbody);
        return;
      }
      setTableMutedMessage(tbody, 6, searchState.keyword.trim() ? "没有找到匹配的在线音乐结果。" : "");
      return;
    }
    const scrollWrap = document.getElementById("search-results-scroll");
    const viewportHeight = scrollWrap?.clientHeight || 0;
    const scrollTop = scrollWrap?.scrollTop || 0;
    const totalRows = searchState.results.length;
    const batchMode = searchState.batchMode === true;
    const visibleRows = Math.max(1, Math.ceil(viewportHeight / rowHeight));
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows);
    const endIndex = Math.min(totalRows, startIndex + visibleRows + overscanRows * 2);
    const renderedRows = searchState.results.slice(startIndex, endIndex);
    searchState.virtualTop = startIndex * rowHeight;
    searchState.virtualBottom = Math.max(0, (totalRows - endIndex) * rowHeight);
    tbody.innerHTML = "";
    if (searchState.virtualTop > 0) tbody.appendChild(spacerRow(searchState.virtualTop));
    renderedRows.forEach((row, offset) => {
      const index = startIndex + offset;
      const tr = document.createElement("tr");
      const selected = searchState.selectedIds?.has(row.source_id) === true;
      const cover = coverImgHtml({ src: row.cover_url || "", className: "row-cover", width: 40, height: 40, radius: 4 });
      const title = row.artist ? `<span class="t-title">${escapeHtml(row.title)}</span><span class="t-art">${escapeHtml(row.artist)}</span>` : `<span class="t-title">${escapeHtml(row.title)}</span>`;
      tr.classList.toggle("is-selected", selected);
      tr.classList.toggle("is-batch-mode", batchMode);
      tr.innerHTML = `<td class="col-check"><label class="search-row-check"><input type="checkbox" data-search-select-row="${escapeHtml(row.source_id)}" ${selected ? "checked" : ""} aria-label="选择 ${escapeHtml(row.title)}" /></label></td><td class="col-idx">${index + 1}</td><td class="col-cover">${cover}</td><td>${title}</td><td class="muted">${escapeHtml(row.album || "—")}</td><td class="muted col-dur">${escapeHtml(formatDurationMs(row.duration_ms))}</td>`;
      tr.style.cursor = "pointer";
      tr.title = batchMode ? "选择曲目" : "单击播放";
      tr.addEventListener("click", (event) => {
        if (event.target instanceof HTMLInputElement) return;
        if (batchMode) {
          toggleResultSelected(row.source_id);
          return;
        }
        playFromSearchRow(index);
      });
      tr.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        void openSearchRowContextMenu(event, index);
      });
      tr.querySelector(`[data-search-select-row="${CSS.escape(row.source_id)}"]`)?.addEventListener("change", (event) => {
        const target = event.currentTarget;
        setResultSelected(row.source_id, target instanceof HTMLInputElement && target.checked);
      });
      tbody.appendChild(tr);
    });
    if (searchState.virtualBottom > 0) tbody.appendChild(spacerRow(searchState.virtualBottom));
    syncBottomStatusVisibility();
    updateSearchToolbar();
    maybeLoadMoreSearchResults();
    void metadata.ensureVisibleMetadata(renderedRows);
  }

  function spacerRow(height) {
    const spacer = document.createElement("tr");
    spacer.className = "search-table__spacer";
    spacer.innerHTML = `<td colspan="6" style="height:${height}px;padding:0;border-bottom:none;"></td>`;
    return spacer;
  }

  function appendSearchResults(rows, reset = false) {
    const nextRows = Array.isArray(rows) ? rows : [];
    if (reset) {
      searchState.results = nextRows;
      clearSelection();
      return;
    }
    const merged = new Map(searchState.results.map((row) => [row.source_id, row]));
    nextRows.forEach((row) => {
      if (!merged.has(row.source_id)) merged.set(row.source_id, row);
    });
    searchState.results = Array.from(merged.values());
  }

  async function fetchSearchPage({ append = false, pageOverride = null } = {}) {
    const keyword = searchState.keyword.trim();
    if (!keyword) return;
    const requestToken = ++searchRequestToken;
    const targetPage = pageOverride ?? (append ? searchState.page + 1 : 1);
    searchState.busy = !append;
    searchState.loadingMore = append;
    searchState.showBottomStatus = append;
    updateSearchToolbar();
    try {
      if (!append) {
        searchState.results = [];
        searchState.hasNext = false;
        clearSelection();
        renderSearchTable();
      }
      const result = await invoke("search_songs", { keyword, page: targetPage });
      if (requestToken !== searchRequestToken) return;
      searchState.page = targetPage;
      appendSearchResults(result?.results, !append);
      searchState.hasNext = result?.has_next === true;
      renderSearchTable();
    } catch (error) {
      if (requestToken !== searchRequestToken) return;
      warnRequestFailed(error, "search_songs");
      if (!append) {
        searchState.results = [];
        searchState.hasNext = false;
        setTableMutedMessage(document.querySelector("#search-table tbody"), 6, "请求失败");
      }
    } finally {
      if (requestToken !== searchRequestToken) return;
      searchState.busy = false;
      searchState.loadingMore = false;
      updateSearchToolbar();
    }
  }

  function maybeLoadMoreSearchResults() {
    const scrollWrap = document.getElementById("search-results-scroll");
    if (!scrollWrap || searchState.scope !== "catalog" || !searchState.hasNext || searchState.busy || searchState.loadingMore) return;
    const remaining = scrollWrap.scrollHeight - scrollWrap.scrollTop - scrollWrap.clientHeight;
    if (remaining > loadMoreThreshold) return;
    void fetchSearchPage({ append: true, pageOverride: searchState.page + 1 });
  }

  function setResultSelected(sourceId, selected) {
    if (!sourceId) return;
    if (!(searchState.selectedIds instanceof Set)) searchState.selectedIds = new Set();
    const next = new Set(searchState.selectedIds);
    if (selected) next.add(sourceId);
    else next.delete(sourceId);
    searchState.selectedIds = next;
    updateSearchToolbar();
    renderSearchTable();
  }

  function toggleResultSelected(sourceId) {
    setResultSelected(sourceId, !(searchState.selectedIds instanceof Set && searchState.selectedIds.has(sourceId)));
  }

  function setAllResultsSelected(selected) {
    searchState.selectedIds = selected ? new Set(searchState.results.map((row) => row.source_id).filter(Boolean)) : new Set();
    updateSearchToolbar();
    renderSearchTable();
  }

  async function appendSelectedToPlaylist() {
    const selectedRows = searchState.results.filter((row) => searchState.selectedIds?.has(row.source_id));
    if (!selectedRows.length) return;
    let playlists = [];
    try {
      playlists = await invoke("list_playlists");
    } catch (error) {
      alertRequestFailed(error, "list_playlists search");
      return;
    }
    const defaultName = selectedRows[0]?.title ? `${selectedRows[0].title} 等` : "新歌单";
    const options = Array.isArray(playlists) && playlists.length
      ? `${playlists.map((playlist) => `${playlist.id}: ${playlist.name}`).join("\n")}\n留空则新建歌单`
      : "暂无歌单，留空将新建歌单";
    const value = window.prompt(`输入歌单 ID，或留空新建歌单：\n${options}`, "");
    let playlistId = Number(String(value || "").trim());
    if (!playlistId) {
      const name = window.prompt("新歌单名称", defaultName);
      if (!name || !name.trim()) return;
      try {
        playlistId = await invoke("create_playlist", { name: name.trim() });
      } catch (error) {
        alertRequestFailed(error, "create_playlist search");
        return;
      }
    }
    try {
      await invoke("append_playlist_import_items", {
        playlistId,
        items: selectedRows.map((row) => ({
          title: row.title,
          artist: row.artist || "",
          album: row.album || "",
          pjmp3_source_id: row.source_id,
          cover_url: row.cover_url || "",
        })),
      });
      clearSelection();
      updateSearchToolbar();
      renderSearchTable();
    } catch (error) {
      alertRequestFailed(error, "append_playlist_import_items search");
    }
  }

  function wireDiscoverToolbar() {
    document.getElementById("btn-play-all")?.addEventListener("click", () => {
      if (searchState.results.length) playCatalogAll(searchState.results);
    });
    document.getElementById("btn-search-batch-mode")?.addEventListener("click", () => {
      enterBatchMode();
    });
    document.getElementById("btn-search-batch-done")?.addEventListener("click", () => {
      exitBatchMode();
    });
    document.getElementById("btn-search-select-all")?.addEventListener("click", () => {
      const selectedCount = searchState.selectedIds?.size || 0;
      setAllResultsSelected(selectedCount !== searchState.results.length);
    });
    document.getElementById("btn-search-add-selected")?.addEventListener("click", () => {
      void appendSelectedToPlaylist();
    });
    document.getElementById("search-select-all-checkbox")?.addEventListener("change", (event) => {
      const target = event.currentTarget;
      setAllResultsSelected(target instanceof HTMLInputElement && target.checked);
    });
    document.getElementById("search-results-scroll")?.addEventListener("scroll", () => {
      renderSearchTable();
    });
  }

  return {
    clearSelection,
    enterBatchMode,
    exitBatchMode,
    fetchSearchPage,
    renderSearchTable,
    wireDiscoverToolbar,
  };
}
