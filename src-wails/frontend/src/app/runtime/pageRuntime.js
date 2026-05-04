import { createContextMenuController } from "../../features/contextMenu/controller.js";
import { createImportPageController } from "../../features/import/controller.js";
import { createNavigationController } from "../../features/layout/navigationController.js";
import { createHomeController } from "../../features/library/homeController.js";
import { createPlaylistController } from "../../features/library/playlistController.js";
import { createSearchController } from "../../features/search/controller.js";

// Page runtime assembles search, library, import and navigation flows around shared state.
export function createPageRuntime(deps) {
  const {
    alertRequestFailed,
    appLogoMarkSvg,
    applyQuickThemeMode,
    escapeHtml,
    formatDurationMs,
    getDownloadTaskCount,
    getImportMethod,
    getImportShareSuggestedName,
    getImportTracks,
    getLastLibraryFolder,
    getLikedIds,
    getNeteaseCookieState,
    getPlaylistDetailRows,
    getSelectedPlaylistId,
    getSelectedPlaylistName,
    getSessionRecentPlays,
    importBackButtonIconSvg,
    importMethodIconSvg,
    invoke,
    messageRequestFailed,
    navIconSvg,
    navItems,
    openAccountCenter,
    open,
    playFromQueueIndex,
    playFromRecentRow,
    playFromSearchRow,
    refreshLocalLibraryTable,
    renderDownloadQueueTable,
    renderQueuePanel,
    resetImportFlow,
    searchState,
    setImportDraft,
    setImportConfigHeader,
    setImportMethod,
    setImportStep,
    setLastLibraryFolder,
    setNeteaseCookieState,
    setPlayQueue,
    setPlaylistDetailRows,
    setSelectedPlaylist,
    sidebarMenuItems,
    syncNeteaseCookieUi,
    warnRequestFailed,
  } = deps;
  const settingsRefresh = async () => {
    await deps.refreshKugouSettingsStatus?.();
  };

  let setPage = () => {};

  const home = createHomeController({
    escapeHtml,
    getDownloadTaskCount,
    getSessionRecentPlays,
    invoke,
    playFromRecentRow,
    playSingleItem: (item) => {
      setPlayQueue(
        item.local_path
          ? [{ title: item.title, artist: item.artist || "", local_path: item.local_path, cover_url: null }]
          : [{ source_id: item.source_id, title: item.title, artist: item.artist || "", cover_url: item.cover_url || null }]
      );
      void playFromQueueIndex(0);
      renderQueuePanel();
    },
  });

  const playlist = createPlaylistController({
    alertRequestFailed,
    escapeHtml,
    formatDurationMs,
    getImportTracks,
    getLikedIds,
    getPlaylistDetailRows,
    getSelectedPlaylistId,
    getSelectedPlaylistName,
    invoke,
    MSG_REQUEST_FAILED: messageRequestFailed,
    openPlaylistDetailRowContextMenu: (...args) => context.openPlaylistDetailRowContextMenu(...args),
    openSidebarPlaylistContextMenu: (...args) => context.openSidebarPlaylistContextMenu(...args),
    playFromQueueIndex,
    renderHomePage: home.renderHomePage,
    renderQueuePanel,
    setPage: (...args) => setPage(...args),
    setPlaylistDetailRows,
    setPlayQueue,
    setSelectedPlaylist,
    warnRequestFailed,
  });

  const context = createContextMenuController({
    alertRequestFailed,
    getPlayIndex: deps.getPlayIndex,
    getPlayQueue: deps.getPlayQueue,
    getPlaylistDetailRows,
    getSearchResults: () => searchState.results,
    getSelectedPlaylistId,
    getSelectedPlaylistName,
    invoke,
    loadPlaylistDetail: playlist.loadPlaylistDetail,
    playFromQueueIndex,
    playFromSearchRow,
    refreshPlaylistSelect: playlist.refreshPlaylistSelect,
    refreshSidebarPlaylists: playlist.refreshSidebarPlaylists,
    renderQueuePanel,
    setPage: (...args) => setPage(...args),
    setPlayQueue,
    setSelectedPlaylist,
  });

  const search = createSearchController({
    escapeHtml,
    invoke,
    loadPlaylistDetail: playlist.loadPlaylistDetail,
    MSG_REQUEST_FAILED: messageRequestFailed,
    openSearchRowContextMenu: (...args) => context.openSearchRowContextMenu(...args),
    playCatalogAll: (rows) => {
      setPlayQueue(
        rows.map((row) => ({
          source_id: row.source_id,
          title: row.title,
          artist: row.artist || "",
          cover_url: row.cover_url || null,
        }))
      );
      void playFromQueueIndex(0);
    },
    playFromSearchRow,
    searchLocalPlaylists: playlist.searchLocalPlaylists,
    searchState,
    setPage: (...args) => setPage(...args),
    setSelectedPlaylist,
    setTableMutedMessage: deps.setTableMutedMessage,
    warnRequestFailed,
  });

  const importer = createImportPageController({
    alertRequestFailed,
    escapeHtml,
    getImportMethod,
    getImportShareSuggestedName,
    getImportTracks,
    getLastLibraryFolder,
    getNeteaseCookieState,
    importBackButtonIconSvg,
    importMethodIconSvg,
    invoke,
    loadPlaylistDetail: playlist.loadPlaylistDetail,
    MSG_REQUEST_FAILED: messageRequestFailed,
    open,
    refreshLocalLibraryTable,
    refreshPlaylistSelect: playlist.refreshPlaylistSelect,
    refreshSidebarPlaylists: playlist.refreshSidebarPlaylists,
    setImportDraft,
    setImportConfigHeader,
    setImportMethod,
    setImportStep,
    setLastLibraryFolder,
    setNeteaseCookieState,
    setPage: (...args) => setPage(...args),
    setSelectedPlaylist,
    syncNeteaseCookieUi,
  });

  const navigation = createNavigationController({
    alertRequestFailed,
    appLogoMarkSvg,
    applyQuickThemeMode,
    escapeHtml,
    getActiveSearchInput: search.getActiveSearchInput,
    invoke,
    navIconSvg,
    navItems,
    onDailyPage: () => home.renderDailyTable(),
    onDownloadPage: () => renderDownloadQueueTable(),
    onHomePage: () => home.renderHomePage(),
    onLoginAccount: () => {
      openAccountCenter?.("kugou");
    },
    onImportPage: () => {
      if (!getImportMethod() && !getImportTracks().length) resetImportFlow();
      void importer.refreshImportPageState();
      void playlist.refreshPlaylistSelect();
    },
    onPlaylistPage: () => {
      if (getSelectedPlaylistId() == null) {
        setSelectedPlaylist(null, "");
        const titleEl = document.getElementById("playlist-page-title");
        if (titleEl) titleEl.textContent = "歌单";
        setPlaylistDetailRows([]);
        playlist.renderPlaylistDetailTable();
        return;
      }
      void playlist.loadPlaylistDetail(getSelectedPlaylistId(), getSelectedPlaylistName());
    },
    onRecentPage: () => deps.renderRecentPlaysTable(),
    onSearchPage: () => {
      queueMicrotask(() => {
        search.getActiveSearchInput()?.focus();
      });
    },
    onSettingsPage: () => {
      void settingsRefresh();
    },
    refreshQuickThemeModeUi: deps.refreshQuickThemeModeUi,
    refreshSidebarPlaylists: playlist.refreshSidebarPlaylists,
    renderQueuePanel,
    sidebarMenuItems,
  });
  setPage = navigation.setPage;

  return {
    closeContextMenu: context.closeContextMenu,
    enqueueDownloadForTrack: context.enqueueDownloadForTrack,
    fetchSearchPage: search.fetchSearchPage,
    getActiveSearchInput: search.getActiveSearchInput,
    getSearchInputs: search.getSearchInputs,
    loadPlaylistDetail: playlist.loadPlaylistDetail,
    openPlaylistDetailRowContextMenu: context.openPlaylistDetailRowContextMenu,
    openSearchRowContextMenu: context.openSearchRowContextMenu,
    openSidebarPlaylistContextMenu: context.openSidebarPlaylistContextMenu,
    playFromPlaylistRow: playlist.playFromPlaylistRow,
    refreshPlaylistSelect: playlist.refreshPlaylistSelect,
    refreshSidebarPlaylists: playlist.refreshSidebarPlaylists,
    renderDailyTable: home.renderDailyTable,
    renderHomePage: home.renderHomePage,
    renderImportTable: importer.renderImportTable,
    renderPlaylistDetailTable: playlist.renderPlaylistDetailTable,
    renderPlaylistSearchResults: search.renderPlaylistSearchResults,
    renderSearchTable: search.renderSearchTable,
    renderSidebar: navigation.renderSidebar,
    searchLocalPlaylists: playlist.searchLocalPlaylists,
    setPage,
    setSearchScope: search.setSearchScope,
    setSearchView: search.setSearchView,
    submitPageSearch: search.submitPageSearch,
    syncSearchInputs: search.syncSearchInputs,
    toggleQueuePanel: navigation.toggleQueuePanel,
    updateSearchToolbar: search.updateSearchToolbar,
    updateSearchViewState: search.updateSearchViewState,
    wireDiscoverToolbar: search.wireDiscoverToolbar,
    wireImportPage: importer.wireImportPage,
    wirePlaylistPage: playlist.wirePlaylistPage,
    wireQueueToggle: navigation.wireQueueToggle,
    wireSearchPage: search.wireSearchPage,
  };
}
