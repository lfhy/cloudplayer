// Context-menu helpers centralize shared menu primitives and track-level actions.
export function createContextMenuHelpers(deps) {
  const {
    alertRequestFailed,
    getPlayQueue,
    invoke,
    refreshPlaylistSelect,
    refreshSidebarPlaylists,
    renderQueuePanel,
    setPlayQueue,
  } = deps;
  let contextMenuCleanup = null;

  function closeContextMenu() {
    if (!contextMenuCleanup) return;
    contextMenuCleanup();
    contextMenuCleanup = null;
  }

  function mountContextMenuAt(clientX, clientY, rootEl) {
    closeContextMenu();
    rootEl.className = "ctx-menu";
    document.body.appendChild(rootEl);
    const place = () => {
      const pad = 8;
      const rect = rootEl.getBoundingClientRect();
      rootEl.style.left = `${Math.max(pad, Math.min(clientX, window.innerWidth - rect.width - pad))}px`;
      rootEl.style.top = `${Math.max(pad, Math.min(clientY, window.innerHeight - rect.height - pad))}px`;
    };
    place();
    const onDown = (event) => {
      if (rootEl.contains(event.target)) return;
      closeContextMenu();
    };
    const onKey = (event) => {
      if (event.key === "Escape") closeContextMenu();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);
    contextMenuCleanup = () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      rootEl.remove();
    };
  }

  function cmSep() {
    return Object.assign(document.createElement("div"), { className: "ctx-menu__sep" });
  }

  function cmBtn(label, onClick, disabled) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ctx-menu__item";
    button.textContent = label;
    if (disabled) button.disabled = true;
    else {
      button.addEventListener("click", () => {
        closeContextMenu();
        try {
          const result = onClick();
          if (result?.then) result.catch((error) => alertRequestFailed(error, "ctx-menu"));
        } catch (error) {
          alertRequestFailed(error, "ctx-menu");
        }
      });
    }
    return button;
  }

  async function copyImportTrackInfoToClipboard({ title, artist, album, sourceId, coverUrl }) {
    const lines = [];
    if ((title || "").trim()) lines.push((title || "").trim());
    if ((artist || "").trim()) lines.push((artist || "").trim());
    if ((album || "").trim()) lines.push(`专辑：${(album || "").trim()}`);
    if ((sourceId || "").trim()) lines.push(`曲库 ID：${(sourceId || "").trim()}`);
    if ((coverUrl || "").trim()) lines.push(`封面：${(coverUrl || "").trim()}`);
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("复制以下内容：", text);
    }
  }

  function searchResultToQueueItem(row) {
    return {
      source_id: row.source_id,
      title: row.title,
      artist: row.artist || "",
      album: row.album || "",
      cover_url: row.cover_url || null,
      duration_ms: Number(row.duration_ms || 0) || 0,
    };
  }

  function playlistImportRowToQueueItem(row) {
    const sourceId = (row.pjmp3_source_id || "").trim();
    return sourceId
      ? {
          source_id: sourceId,
          title: row.title,
          artist: row.artist || "",
          album: row.album || "",
          cover_url: (row.cover_url || "").trim() || null,
          duration_ms: Number(row.duration_ms || 0) || 0,
        }
      : null;
  }

  async function listPlaylistsCached() {
    try {
      return await invoke("list_playlists");
    } catch (error) {
      console.warn("list_playlists", error);
      return [];
    }
  }

  async function enqueueDownloadForTrack(track, quality) {
    const sourceId = (track.sourceId || "").trim();
    if (!sourceId) return void alert("无曲库 id，无法下载。");
    try {
      await invoke("enqueue_download", { source_id: sourceId, title: track.title || "", artist: track.artist || "", quality });
    } catch (error) {
      alertRequestFailed(error, "enqueue_download");
    }
  }

  function buildDownloadSubmenu(track) {
    const row = document.createElement("div");
    const fly = document.createElement("div");
    const panel = document.createElement("div");
    row.className = "ctx-menu__row--sub";
    fly.className = "ctx-menu__fly";
    panel.className = "ctx-menu__subpanel";
    fly.textContent = "下载";
    [["FLAC", "flac"], ["高品质 320", "320"], ["标准 128", "128"]].forEach(([label, quality]) => {
      panel.appendChild(cmBtn(label, () => void enqueueDownloadForTrack(track, quality)));
    });
    row.append(fly, panel);
    return row;
  }

  function buildAddToSubmenu(track) {
    const row = document.createElement("div");
    const fly = document.createElement("div");
    const panel = document.createElement("div");
    row.className = "ctx-menu__row--sub";
    fly.className = "ctx-menu__fly";
    panel.className = "ctx-menu__subpanel";
    fly.textContent = "添加到";
    const appendQueueItem = () => {
      const item = {
        source_id: track.sourceId,
        title: track.title,
        artist: track.artist || "",
        album: track.album || "",
        cover_url: track.coverUrl || null,
        duration_ms: Number(track.durationMs || track.duration_ms || 0) || 0,
      };
      if (!(item.source_id || "").trim()) return void alert("该条没有曲库 id，无法加入播放队列。");
      setPlayQueue([...getPlayQueue(), item]);
      renderQueuePanel();
    };
    panel.appendChild(cmBtn("播放队列", appendQueueItem));
    panel.appendChild(cmBtn("试听列表", appendQueueItem));
    panel.appendChild(cmSep());
    panel.appendChild(cmBtn("添加到新歌单", async () => {
      const name = window.prompt("歌单名称（将写入 library.db）", "新歌单");
      if (!name || !name.trim()) return;
      const playlistId = await invoke("create_playlist", { name: name.trim() });
      await invoke("append_playlist_import_items", {
        playlistId,
        items: [{
          title: track.title,
          artist: track.artist || "",
          album: track.album || "",
          pjmp3_source_id: track.sourceId || "",
          cover_url: track.coverUrl || "",
          duration_ms: Number(track.durationMs || track.duration_ms || 0) || 0,
        }],
      });
      await refreshSidebarPlaylists();
      await refreshPlaylistSelect();
    }));
    panel.appendChild(cmSep());
    return { addRow: row, fly, sub: panel };
  }

  return {
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
  };
}
