// Search controller manages the dual search views and keeps the page entry thin.
export function createSearchController(deps) {
  const {
    escapeHtml,
    invoke,
    loadPlaylistDetail,
    MSG_REQUEST_FAILED,
    openSearchRowContextMenu,
    playCatalogAll,
    playFromSearchRow,
    searchLocalPlaylists,
    searchState,
    setPage,
    setSelectedPlaylist,
    setTableMutedMessage,
    warnRequestFailed,
  } = deps;
  let autoSearchTimer = null;

  function resetSearchState() {
    searchState.page = 1;
    searchState.results = [];
    searchState.playlistResults = [];
    searchState.hasNext = false;
  }

  function queueAutoSearch() {
    if (autoSearchTimer != null) clearTimeout(autoSearchTimer);
    autoSearchTimer = setTimeout(() => {
      autoSearchTimer = null;
      submitPageSearch();
    }, 260);
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
    const info = document.getElementById("search-page-info");
    const playlistInfo = document.getElementById("search-playlist-info");
    const summary = document.getElementById("search-results-summary");
    if (info) info.textContent = searchState.scope !== "catalog" || !keyword ? "" : `共 ${resultCount} 条 · 第 ${searchState.page} 页${searchState.hasNext ? " · 有下一页" : " · 已到末页"}`;
    if (playlistInfo) playlistInfo.textContent = searchState.scope !== "playlists" || !keyword ? "" : `找到 ${searchState.playlistResults.length} 张相关歌单`;
    if (summary) summary.textContent = !keyword ? "" : searchState.scope === "catalog" ? `搜索 “${keyword}”` : `在本地歌单中搜索 “${keyword}”`;
    document.getElementById("btn-prev-page")?.toggleAttribute("disabled", searchState.scope !== "catalog" || searchState.page <= 1 || searchState.busy);
    document.getElementById("btn-next-page")?.toggleAttribute("disabled", searchState.scope !== "catalog" || !searchState.hasNext || searchState.busy);
    document.getElementById("btn-play-all")?.toggleAttribute("disabled", searchState.scope !== "catalog" || !resultCount || searchState.busy);
  }

  function renderSearchTable() {
    const tbody = document.querySelector("#search-table tbody");
    if (!tbody) return;
    if (searchState.scope !== "catalog") return void (tbody.innerHTML = "");
    if (!searchState.results.length) return setTableMutedMessage(tbody, 5, searchState.keyword.trim() ? "没有找到匹配的在线音乐结果。" : "");
    tbody.innerHTML = "";
    searchState.results.forEach((row, index) => {
      const tr = document.createElement("tr");
      const cover = row.cover_url ? `<img class="row-cover" src="${escapeHtml(row.cover_url)}" alt="" width="40" height="40" loading="lazy" />` : '<div class="row-cover-ph" aria-hidden="true"></div>';
      const title = row.artist ? `<span class="t-title">${escapeHtml(row.title)}</span><span class="t-art">${escapeHtml(row.artist)}</span>` : `<span class="t-title">${escapeHtml(row.title)}</span>`;
      tr.innerHTML = `<td class="col-idx">${index + 1}</td><td class="col-cover">${cover}</td><td>${title}</td><td class="muted">${escapeHtml(row.album || "—")}</td><td class="muted col-dur">—</td>`;
      tr.style.cursor = "pointer";
      tr.title = "双击试听";
      tr.addEventListener("dblclick", () => playFromSearchRow(index));
      tr.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        void openSearchRowContextMenu(event, index);
      });
      tbody.appendChild(tr);
    });
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
      button.innerHTML = `
        ${playlist.coverUrl ? `<img class="search-playlist-card__cover" src="${escapeHtml(playlist.coverUrl)}" alt="" />` : '<div class="search-playlist-card__cover search-playlist-card__cover--ph" aria-hidden="true"></div>'}
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

  async function fetchSearchPage() {
    const keyword = searchState.keyword.trim();
    if (!keyword) return;
    searchState.busy = true;
    updateSearchToolbar();
    try {
      if (searchState.scope === "catalog") {
        setTableMutedMessage(document.querySelector("#search-table tbody"), 5, "搜索中…");
        const result = await invoke("search_songs", { keyword, page: searchState.page });
        searchState.results = Array.isArray(result?.results) ? result.results : [];
        searchState.hasNext = result?.has_next === true;
        searchState.playlistResults = [];
        renderSearchTable();
      } else {
        searchState.playlistResults = await searchLocalPlaylists(keyword);
        searchState.results = [];
        searchState.hasNext = false;
        renderPlaylistSearchResults();
      }
    } catch (error) {
      warnRequestFailed(error, searchState.scope === "catalog" ? "search_songs" : "search_local_playlists");
      if (searchState.scope === "catalog") setTableMutedMessage(document.querySelector("#search-table tbody"), 5, MSG_REQUEST_FAILED);
      else document.getElementById("search-playlist-list")?.replaceChildren(Object.assign(document.createElement("div"), { className: "search-playlist-empty muted", textContent: MSG_REQUEST_FAILED }));
      searchState.results = [];
      searchState.playlistResults = [];
      searchState.hasNext = false;
    } finally {
      searchState.busy = false;
      updateSearchToolbar();
    }
  }

  function wireDiscoverToolbar() {
    document.getElementById("btn-prev-page")?.addEventListener("click", () => {
      if (searchState.page <= 1 || searchState.busy || !searchState.keyword.trim()) return;
      searchState.page -= 1;
      void fetchSearchPage();
    });
    document.getElementById("btn-next-page")?.addEventListener("click", () => {
      if (searchState.busy || !searchState.hasNext || !searchState.keyword.trim()) return;
      searchState.page += 1;
      void fetchSearchPage();
    });
    document.getElementById("btn-play-all")?.addEventListener("click", () => {
      if (searchState.results.length) playCatalogAll(searchState.results);
    });
  }

  function submitPageSearch(seed = null) {
    if (autoSearchTimer != null) {
      clearTimeout(autoSearchTimer);
      autoSearchTimer = null;
    }
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
      renderSearchTable();
      renderPlaylistSearchResults();
      updateSearchViewState();
      updateSearchToolbar();
      return;
    }
    searchState.keyword = value;
    searchState.page = 1;
    syncSearchInputs(value);
    updateSearchViewState();
    void fetchSearchPage();
  }

  function wireSearchPage() {
    const inputs = getSearchInputs();
    if (!inputs.length) return;
    inputs.forEach((input) => {
      input.addEventListener("input", () => {
        syncSearchInputs(input.value);
        if (input.value.trim()) {
          queueAutoSearch();
          return;
        }
        searchState.keyword = "";
        resetSearchState();
        renderSearchTable();
        renderPlaylistSearchResults();
        updateSearchViewState();
        updateSearchToolbar();
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
          void fetchSearchPage();
        } else {
          renderSearchTable();
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
    renderSearchTable,
    setSearchScope,
    setSearchView,
    submitPageSearch,
    syncSearchInputs,
    updateSearchToolbar,
    updateSearchViewState,
    wireDiscoverToolbar,
    wireSearchPage,
  };
}
