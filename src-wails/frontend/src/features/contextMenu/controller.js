// Context-menu controller composes search, playlist, and sidebar menus from shared helpers.
import { createContextMenuHelpers } from "./helpers.js";

export function createContextMenuController(deps) {
  const helpers = createContextMenuHelpers(deps);
  const {
    buildAddToSubmenu,
    buildDownloadSubmenu,
    closeContextMenu,
    cmBtn,
    cmSep,
    copyImportTrackInfoToClipboard,
    enqueueDownloadForTrack,
    listPlaylistsCached,
    mountContextMenuAt,
    playlistImportRowToQueueItem,
    searchResultToQueueItem,
  } = helpers;
  const {
    getPlayIndex,
    getPlayQueue,
    getPlaylistDetailRows,
    getSearchResults,
    getSelectedPlaylistId,
    getSelectedPlaylistName,
    invoke,
    loadPlaylistDetail,
    openDeletePlaylistModal,
    openRenamePlaylistModal,
    playFromQueueIndex,
    playFromSearchRow,
    refreshPlaylistSelect,
    refreshSidebarPlaylists,
    renderQueuePanel,
    setPage,
    setPlayQueue,
    setSelectedPlaylist,
  } = deps;

  async function openSearchRowContextMenu(event, rowIdx) {
    event.preventDefault();
    const row = getSearchResults()[rowIdx];
    if (!row) return;
    const queueItem = searchResultToQueueItem(row);
    const playlists = await listPlaylistsCached();
    const root = document.createElement("div");
    root.appendChild(cmBtn("播放", () => playFromSearchRow(rowIdx)));
    root.appendChild(cmBtn("下一首播放", () => {
      if (!getPlayQueue().length) {
        setPlayQueue([queueItem]);
        void playFromQueueIndex(0);
      } else {
        const queue = [...getPlayQueue()];
        queue.splice(getPlayIndex() + 1, 0, queueItem);
        setPlayQueue(queue);
      }
      renderQueuePanel();
    }));
    root.appendChild(cmSep());
    const addMenu = buildAddToSubmenu({ title: row.title, artist: row.artist, album: row.album, sourceId: row.source_id, coverUrl: row.cover_url });
    let hasPlaylist = false;
    playlists.forEach((playlist) => {
      if (playlist.id == null) return;
      hasPlaylist = true;
      addMenu.sub.appendChild(cmBtn((playlist.name || "").trim() || `#${playlist.id}`, async () => {
        await invoke("append_playlist_import_items", {
          playlistId: playlist.id,
          items: [{
            title: row.title,
            artist: row.artist || "",
            album: row.album || "",
            pjmp3_source_id: row.source_id || "",
            cover_url: row.cover_url || "",
          }],
        });
        await refreshSidebarPlaylists();
      }));
    });
    if (!hasPlaylist) addMenu.sub.appendChild(cmBtn("（暂无歌单，请先新建）", () => {}, true));
    addMenu.addRow.append(addMenu.fly, addMenu.sub);
    root.appendChild(addMenu.addRow);
    root.appendChild(buildDownloadSubmenu({ sourceId: row.source_id, title: row.title, artist: row.artist }));
    root.append(cmBtn("分享", () => {}, true), cmBtn("查看评论", () => {}, true), cmSep());
    root.appendChild(cmBtn("复制歌曲信息", () => copyImportTrackInfoToClipboard({ title: row.title, artist: row.artist, album: row.album, sourceId: row.source_id, coverUrl: row.cover_url })));
    mountContextMenuAt(event.clientX, event.clientY, root);
  }

  async function openSidebarPlaylistContextMenu(event, playlist) {
    event.preventDefault();
    const root = document.createElement("div");
    root.appendChild(cmBtn("播放", async () => {
      const rows = await invoke("list_playlist_import_items", { playlistId: playlist.id });
      const playable = (rows || []).filter((item) => (item.pjmp3_source_id || "").trim());
      if (!playable.length) return void alert("歌单为空或没有可播放条目（导入条目需含 pjmp3 曲库 id）。");
      setPlayQueue(playable.map((item) => ({ source_id: (item.pjmp3_source_id || "").trim(), title: item.title, artist: item.artist || "", cover_url: (item.cover_url || "").trim() || null })));
      void playFromQueueIndex(0);
      renderQueuePanel();
    }));
    root.appendChild(cmBtn("重命名", async () => {
      openRenamePlaylistModal?.(playlist.id, playlist.name || "");
    }));
    root.appendChild(cmBtn("删除歌单", async () => {
      openDeletePlaylistModal?.(playlist.id, playlist.name || "");
    }));
    mountContextMenuAt(event.clientX, event.clientY, root);
  }

  async function openPlaylistDetailRowContextMenu(event, rowIdx) {
    event.preventDefault();
    const row = getPlaylistDetailRows()[rowIdx];
    if (!row) return;
    const queueItem = playlistImportRowToQueueItem(row);
    const sourceId = (row.pjmp3_source_id || "").trim();
    const playlists = await listPlaylistsCached();
    const root = document.createElement("div");
    root.appendChild(cmBtn("播放", () => {
      if (!queueItem) return void alert("该条没有曲库 id，请使用「搜索」搜索歌名后播放。");
      setPlayQueue([queueItem]);
      void playFromQueueIndex(0);
      renderQueuePanel();
    }, !sourceId));
    root.appendChild(cmBtn("下一首播放", () => {
      if (!queueItem) return void alert("该条没有曲库 id，无法插播。");
      if (!getPlayQueue().length) {
        setPlayQueue([queueItem]);
        void playFromQueueIndex(0);
      } else {
        const queue = [...getPlayQueue()];
        queue.splice(getPlayIndex() + 1, 0, queueItem);
        setPlayQueue(queue);
        renderQueuePanel();
      }
    }, !sourceId));
    root.appendChild(cmSep());
    const addMenu = buildAddToSubmenu({ title: row.title, artist: row.artist, album: row.album, sourceId: row.pjmp3_source_id, coverUrl: row.cover_url });
    let hasPlaylist = false;
    playlists.forEach((playlist) => {
      if (playlist.id == null || (getSelectedPlaylistId() != null && Number(playlist.id) === Number(getSelectedPlaylistId()))) return;
      hasPlaylist = true;
      addMenu.sub.appendChild(cmBtn((playlist.name || "").trim() || `#${playlist.id}`, async () => {
        await invoke("append_playlist_import_items", {
          playlistId: playlist.id,
          items: [{
            title: row.title,
            artist: row.artist || "",
            album: row.album || "",
            pjmp3_source_id: row.pjmp3_source_id || "",
            cover_url: row.cover_url || "",
            duration_ms: row.duration_ms || 0,
          }],
        });
        await refreshSidebarPlaylists();
      }));
    });
    if (!hasPlaylist) addMenu.sub.appendChild(cmBtn("（暂无其它歌单）", () => {}, true));
    addMenu.addRow.append(addMenu.fly, addMenu.sub);
    root.appendChild(addMenu.addRow);
    root.appendChild(buildDownloadSubmenu({ sourceId: row.pjmp3_source_id, title: row.title, artist: row.artist }));
    root.append(cmBtn("分享", () => {}, true), cmBtn("查看评论", () => {}, true), cmSep());
    root.appendChild(cmBtn("复制歌曲信息", () => copyImportTrackInfoToClipboard({ title: row.title, artist: row.artist, album: row.album, sourceId: row.pjmp3_source_id, coverUrl: row.cover_url })));
    if (row.id != null && row.id > 0 && getSelectedPlaylistId() != null) {
      root.append(cmSep(), cmBtn("删除", async () => {
        if (!window.confirm("从当前歌单中删除该条目？")) return;
        await invoke("delete_playlist_import_item", { playlistId: getSelectedPlaylistId(), itemId: row.id });
        await loadPlaylistDetail(getSelectedPlaylistId(), getSelectedPlaylistName());
        await refreshPlaylistSelect();
      }));
    }
    mountContextMenuAt(event.clientX, event.clientY, root);
  }

  return { closeContextMenu, enqueueDownloadForTrack, openPlaylistDetailRowContextMenu, openSearchRowContextMenu, openSidebarPlaylistContextMenu };
}
