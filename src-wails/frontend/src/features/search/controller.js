import { createCatalogResultsController } from "./catalogResultsController.js";
import { coverImgHtml } from "../../app/helpers/covers.js";

// Search controller keeps page-level view switching thin and delegates heavy catalog logic.
export function createSearchController(deps) {
  const {
    escapeHtml,
    loadPlaylistDetail,
    searchLocalPlaylists,
    searchState,
    setPage,
    setSelectedPlaylist,
  } = deps;

  // Catalog results controller needs the page toolbar updater; pass it explicitly so
  // virtual list fetch/render work does not fail before the backend request starts.
  const catalog = createCatalogResultsController({
    ...deps,
    updateSearchToolbar,
  });

  function resetSearchState() {
    searchState.page = 1;
    searchState.results = [];
    searchState.playlistResults = [];
    searchState.hasNext = false;
    searchState.loadingMore = false;
    searchState.showBottomStatus = false;
    searchState.virtualTop = 0;
    searchState.virtualBottom = 0;
    catalog.clearSelection();
  }

  function getSearchInputs() {
    return Array.from(document.querySelectorAll("#page-search, #page-search-results"));
  }

  function getActiveSearchInput() {
    return searchState.view === "results"
      ? document.getElementById("page-search-results") || document.getElementById("page-search")
      : document.getElementById("page-search") || document.getElementById("page-search-results");
  }

  function syncSearchInputs(value = searchState.keyword) {
    getSearchInputs().forEach((input) => {
      if (input.value !== value) input.value = value;
    });
  }

  function setSearchView(view = "home") {
    searchState.view = view === "results" ? "results" : "home";
    const shell = document.querySelector('.page[data-page="search"] .search-shell');
    const homeView = document.getElementById("search-home-view");
    const resultsView = document.getElementById("search-results-view");
    if (shell) shell.setAttribute("data-search-view", searchState.view);
    if (homeView) {
      homeView.hidden = searchState.view !== "home";
      homeView.classList.toggle("is-active", searchState.view === "home");
    }
    if (resultsView) {
      resultsView.hidden = searchState.view !== "results";
      resultsView.classList.toggle("is-active", searchState.view === "results");
    }
    syncSearchInputs(searchState.keyword);
  }

  function setSearchScope(scope) {
    searchState.scope = scope === "playlists" ? "playlists" : "catalog";
    document.querySelectorAll("[data-search-scope]").forEach((button) => {
      const active = button.getAttribute("data-search-scope") === searchState.scope;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const catalogPanel = document.getElementById("search-results-catalog");
    const playlistPanel = document.getElementById("search-results-playlists");
    if (catalogPanel) catalogPanel.hidden = searchState.view !== "results" || searchState.scope !== "catalog";
    if (playlistPanel) playlistPanel.hidden = searchState.view !== "results" || searchState.scope !== "playlists";
    updateSearchViewState();
    updateSearchToolbar();
  }

  function updateSearchViewState() {
    const hasKeyword = !!searchState.keyword.trim();
    const catalogPanel = document.getElementById("search-results-catalog");
    const playlistPanel = document.getElementById("search-results-playlists");
    setSearchView(hasKeyword ? "results" : "home");
    if (catalogPanel) catalogPanel.hidden = !hasKeyword || searchState.scope !== "catalog";
    if (playlistPanel) playlistPanel.hidden = !hasKeyword || searchState.scope !== "playlists";
  }

  function updateSearchToolbar() {
    const keyword = searchState.keyword.trim();
    const resultCount = searchState.results.length;
    const selectedCount = searchState.selectedIds?.size || 0;
    const catalogStatus = searchState.loadingMore
        ? "正在加载中…"
        : !searchState.showBottomStatus || searchState.hasNext || !resultCount
          ? ""
          : `共 ${resultCount} 条`;
    const info = document.getElementById("search-page-info");
    const tail = document.getElementById("search-results-tail");
    const playlistInfo = document.getElementById("search-playlist-info");
    const summary = document.getElementById("search-results-summary");
    if (tail) tail.hidden = searchState.scope !== "catalog" || !keyword || !catalogStatus;
    if (info) info.textContent = searchState.scope !== "catalog" || !keyword || !catalogStatus ? "" : catalogStatus;
    if (playlistInfo) playlistInfo.textContent = searchState.scope !== "playlists" || !keyword ? "" : `找到 ${searchState.playlistResults.length} 张相关歌单`;
    if (summary) summary.textContent = !keyword ? "" : searchState.scope === "catalog" ? `搜索 “${keyword}”${selectedCount ? ` · 已选 ${selectedCount} 首` : ""}` : `在本地歌单中搜索 “${keyword}”`;
    document.getElementById("btn-play-all")?.toggleAttribute("disabled", searchState.scope !== "catalog" || !resultCount || searchState.busy);
    document.getElementById("btn-search-add-selected")?.toggleAttribute("disabled", searchState.scope !== "catalog" || selectedCount === 0 || searchState.busy);
    document.getElementById("btn-search-select-all")?.toggleAttribute("disabled", searchState.scope !== "catalog" || !resultCount || searchState.busy);
    const selectAllCheckbox = document.getElementById("search-select-all-checkbox");
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = resultCount > 0 && selectedCount === resultCount;
      selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < resultCount;
      selectAllCheckbox.disabled = searchState.scope !== "catalog" || !resultCount || searchState.busy;
    }
  }

  function renderPlaylistSearchResults() {
    const wrap = document.getElementById("search-playlist-list");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (searchState.scope !== "playlists" || !searchState.keyword.trim()) return;
    if (!searchState.playlistResults.length) {
      wrap.innerHTML = '<div class="search-playlist-empty muted">没有找到匹配的本地歌单或导入曲目。</div>';
      return;
    }
    searchState.playlistResults.forEach((playlist) => {
      const button = document.createElement("button");
      const matches = playlist.matchedTracks.slice(0, 3).map((track) => `<li>${escapeHtml(track.title || "—")}${track.artist ? ` · ${escapeHtml(track.artist)}` : ""}</li>`).join("");
      button.type = "button";
      button.className = "search-playlist-card";
      const cover = coverImgHtml({ src: playlist.coverUrl || "", className: "search-playlist-card__cover", width: 64, height: 64, radius: 14 });
      button.innerHTML = `
        ${cover}
        <span class="search-playlist-card__body">
          <strong>${escapeHtml(playlist.name)}</strong>
          <span>${playlist.trackCount} 首歌曲${playlist.matchedTracks.length ? ` · 命中 ${playlist.matchedTracks.length} 首` : ""}</span>
          ${matches ? `<ul>${matches}</ul>` : "<em>歌单名称命中</em>"}
        </span>`;
      button.addEventListener("click", async () => {
        setSelectedPlaylist(playlist.id, playlist.name);
        setPage("playlist");
        await loadPlaylistDetail(playlist.id, playlist.name);
      });
      wrap.appendChild(button);
    });
  }

  async function fetchSearchPage(options = {}) {
    if (searchState.scope === "catalog") {
      return catalog.fetchSearchPage(options);
    }
    const keyword = searchState.keyword.trim();
    if (!keyword) return;
    searchState.busy = true;
    updateSearchToolbar();
    try {
      searchState.playlistResults = await searchLocalPlaylists(keyword);
      searchState.results = [];
      searchState.hasNext = false;
      renderPlaylistSearchResults();
    } catch (error) {
      deps.warnRequestFailed(error, "search_local_playlists");
      document.getElementById("search-playlist-list")?.replaceChildren(Object.assign(document.createElement("div"), { className: "search-playlist-empty muted", textContent: deps.MSG_REQUEST_FAILED }));
      searchState.playlistResults = [];
    } finally {
      searchState.busy = false;
      updateSearchToolbar();
    }
  }

  function submitPageSearch(seed = null) {
    const input = getActiveSearchInput();
    if (!input) return;
    if (typeof seed === "string") {
      input.value = seed;
      syncSearchInputs(seed);
    }
    const value = input.value.trim();
    setPage("search");
    if (!value) {
      searchState.keyword = "";
      resetSearchState();
      syncSearchInputs("");
      catalog.renderSearchTable();
      renderPlaylistSearchResults();
      updateSearchViewState();
      updateSearchToolbar();
      return;
    }
    searchState.keyword = value;
    searchState.page = 1;
    syncSearchInputs(value);
    updateSearchViewState();
    void fetchSearchPage({ append: false, pageOverride: 1 });
  }

  function wireSearchPage() {
    const inputs = getSearchInputs();
    if (!inputs.length) return;
    inputs.forEach((input) => {
      input.addEventListener("input", () => {
        syncSearchInputs(input.value);
        if (!input.value.trim()) {
          searchState.keyword = "";
          resetSearchState();
          catalog.renderSearchTable();
          renderPlaylistSearchResults();
          updateSearchViewState();
          updateSearchToolbar();
        }
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        submitPageSearch();
      });
    });
    document.getElementById("btn-page-search")?.addEventListener("click", () => submitPageSearch());
    document.getElementById("btn-page-search-results")?.addEventListener("click", () => submitPageSearch());
    document.querySelectorAll("[data-search-scope]").forEach((button) => {
      button.addEventListener("click", () => {
        setSearchScope(button.getAttribute("data-search-scope") || "catalog");
        if (searchState.keyword.trim()) {
          searchState.page = 1;
          void fetchSearchPage({ append: false, pageOverride: 1 });
        } else {
          catalog.renderSearchTable();
          renderPlaylistSearchResults();
          updateSearchViewState();
        }
      });
    });
    document.querySelectorAll("[data-search-seed]").forEach((button) => {
      button.addEventListener("click", () => {
        const seed = button.getAttribute("data-search-seed") || "";
        if (seed.includes("循环")) setSearchScope("playlists");
        submitPageSearch(seed);
      });
    });
    updateSearchViewState();
  }

  return {
    fetchSearchPage,
    getActiveSearchInput,
    getSearchInputs,
    renderPlaylistSearchResults,
    renderSearchTable: catalog.renderSearchTable,
    setSearchScope,
    setSearchView,
    submitPageSearch,
    syncSearchInputs,
    updateSearchToolbar,
    updateSearchViewState,
    wireDiscoverToolbar: catalog.wireDiscoverToolbar,
    wireSearchPage,
  };
}
