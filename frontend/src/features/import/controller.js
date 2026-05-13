import { createImportKugouController } from "./kugouController.js";

// Import page controller owns the multi-step UI while main.js keeps the mutable state.
export function createImportPageController(deps) {
  const {
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
    loadPlaylistDetail,
    MSG_REQUEST_FAILED,
    open,
    refreshLocalLibraryTable,
    refreshPlaylistSelect,
    refreshSidebarPlaylists,
    setImportDraft,
    setImportMethod,
    setImportStep,
    setLastLibraryFolder,
    setNeteaseCookieState,
    setPage,
    setSelectedPlaylist,
    syncNeteaseCookieUi,
  } = deps;
  const kugou = createImportKugouController({
    alertRequestFailed,
    escapeHtml,
    invoke,
    onKugouAuthChanged: deps.onKugouAuthChanged,
    refreshPlaylistSelect,
    setImportConfigHeader: deps.setImportConfigHeader,
    setImportDraft,
  });

  function renderImportTable() {
    const tracks = getImportTracks();
    const tbody = document.querySelector("#import-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!tracks.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">还没有导入结果。先选择一种导入方式开始。</td></tr>';
    }
    tracks.forEach((track, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-idx">${index + 1}</td>
        <td>${escapeHtml(track.title)}</td>
        <td>${escapeHtml(track.artist)}</td>
        <td class="muted">${escapeHtml(track.album || "—")}</td>`;
      tbody.appendChild(tr);
    });
    const hasTracks = tracks.length > 0;
    document.getElementById("btn-import-export-txt")?.toggleAttribute("disabled", !hasTracks);
    document.getElementById("btn-import-export-csv")?.toggleAttribute("disabled", !hasTracks);
    document.getElementById("btn-import-save-new")?.toggleAttribute("disabled", !hasTracks);
    const mergeBtn = document.getElementById("btn-import-merge");
    const playlistSelect = document.getElementById("import-merge-playlist");
    const optionCount = playlistSelect?.options?.length || 0;
    if (mergeBtn) mergeBtn.disabled = !hasTracks || !optionCount;
  }

  function downloadBlob(filename, text, mime) {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([text], { type: mime }));
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  function toImportItemPayload(track) {
    // Preserve provider-specific IDs and remote artwork so imported online playlists stay playable after save.
    return {
      title: track.title,
      artist: track.artist,
      album: track.album || "",
      pjmp3_source_id: track.pjmp3_source_id || "",
      cover_url: track.cover_url || "",
      duration_ms: Number(track.duration_ms || 0) || 0,
    };
  }

  function refreshImportPageState() {
    if (getImportMethod() !== "kugou") return Promise.resolve(null);
    return kugou.refreshKugouImport();
  }

  function wireImportPage() {
    const cookieEnableEl = document.getElementById("opt-netease-cookie-enabled");
    const cookieInputEl = document.getElementById("opt-netease-cookie");
    const persistCookieSettings = async () => {
      const cookie = getNeteaseCookieState();
      try {
        await invoke("save_settings", {
          patch: {
            share_netease_cookie_enabled: !!cookie.enabled,
            share_netease_cookie: cookie.value || "",
          },
        });
      } catch (error) {
        console.warn("save_settings share_netease_cookie", error);
      }
    };
    cookieEnableEl?.addEventListener("change", () => {
      setNeteaseCookieState({ enabled: !!cookieEnableEl.checked, value: getNeteaseCookieState().value });
      syncNeteaseCookieUi();
      void persistCookieSettings();
    });
    cookieInputEl?.addEventListener("change", () => {
      setNeteaseCookieState({ enabled: getNeteaseCookieState().enabled, value: (cookieInputEl.value || "").trim() });
      void persistCookieSettings();
    });
    syncNeteaseCookieUi();

    document.querySelectorAll("[data-import-method]").forEach((button) => {
      const method = button.getAttribute("data-import-method") || "local";
      const iconSlot = button.querySelector(".import-method-card__icon");
      if (iconSlot) iconSlot.innerHTML = importMethodIconSvg(method);
      button.addEventListener("click", () => {
        setImportMethod(method);
        if (method === "kugou") void kugou.refreshKugouImport();
      });
    });
    document.querySelectorAll("[data-import-back-button]").forEach((button) => {
      const iconSlot = button.querySelector(".import-back-button__icon");
      if (iconSlot) iconSlot.innerHTML = importBackButtonIconSvg();
    });
    document.querySelectorAll("[data-import-step-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const step = button.getAttribute("data-import-step-nav") || "choose";
        if (step === "choose") {
          setImportMethod("", { syncStep: false });
          setImportStep("choose");
        }
        if (step === "config" && getImportMethod()) setImportStep("config");
        if (step === "result" && getImportTracks().length > 0) setImportStep("result");
      });
    });
    document.getElementById("btn-import-back")?.addEventListener("click", () => {
      setImportMethod("", { syncStep: false });
      setImportStep("choose");
    });
    document.getElementById("btn-import-result-back")?.addEventListener("click", () => {
      setImportStep(getImportMethod() ? "config" : "choose");
    });
    document.getElementById("btn-scan-library-folder")?.addEventListener("click", async () => {
      const statusEl = document.getElementById("local-library-status");
      try {
        const settings = await invoke("get_settings");
        const defaultDir = (settings?.last_library_folder || getLastLibraryFolder() || "").trim();
        const picked = await open({ directory: true, multiple: false, defaultPath: defaultDir || undefined, title: "选择音乐文件夹" });
        if (picked == null) return;
        const folder = Array.isArray(picked) ? picked[0] : picked;
        if (!folder || !String(folder).trim()) return;
        const path = String(folder).trim();
        setLastLibraryFolder(path);
        await invoke("save_settings", { patch: { last_library_folder: path } }).catch(() => {});
        if (statusEl) statusEl.textContent = "正在扫描…";
        const result = await invoke("scan_music_folder", { path });
        const rows = await refreshLocalLibraryTable();
        if (statusEl) statusEl.textContent = `已扫描 ${result.audio_files_seen} 个音频文件，整理出 ${rows.length} 首。`;
        setImportDraft(rows.map((row) => ({ title: (row.title || "").trim() || "未命名曲目", artist: (row.artist || "").trim(), album: "" })), {
          suggestedName: "本地导入歌单",
          method: "local",
          statusText: `已从本地目录整理出 ${rows.length} 首歌曲，可以直接保存成歌单。`,
        });
        await refreshPlaylistSelect();
      } catch (error) {
        if (statusEl) statusEl.textContent = MSG_REQUEST_FAILED;
        alertRequestFailed(error, "scan_music_folder");
      }
    });
    document.getElementById("btn-import-parse")?.addEventListener("click", async () => {
      const raw = document.getElementById("import-text")?.value?.trim() ?? "";
      if (!raw) return;
      try {
        const rows = await invoke("parse_import_text", { text: raw, fmt: document.getElementById("import-fmt")?.value ?? "auto" });
        const statusEl = document.getElementById("import-share-status");
        if (statusEl) statusEl.textContent = "";
        setImportDraft(rows || [], {
          suggestedName: "文本导入歌单",
          method: "text",
          statusText: `已解析 ${Array.isArray(rows) ? rows.length : 0} 条文本记录，请确认歌单名称后保存。`,
        });
        await refreshPlaylistSelect();
      } catch (error) {
        alertRequestFailed(error, "parse_import_text");
      }
    });
    document.getElementById("btn-import-export-txt")?.addEventListener("click", () => {
      const tracks = getImportTracks();
      if (!tracks.length) return;
      downloadBlob("playlist.txt", tracks.map((track) => (track.artist ? `${track.title} - ${track.artist}` : track.title)).join("\n"), "text/plain;charset=utf-8");
    });
    document.getElementById("btn-import-export-csv")?.addEventListener("click", () => {
      const tracks = getImportTracks();
      if (!tracks.length) return;
      const lines = ["title,artist,album"].concat(tracks.map((track) => {
        const esc = (value) => `"${String(value).replace(/"/g, '""')}"`;
        return [esc(track.title), esc(track.artist), esc(track.album || "")].join(",");
      }));
      downloadBlob("playlist.csv", lines.join("\n"), "text/csv;charset=utf-8");
    });
    document.getElementById("btn-import-save-new")?.addEventListener("click", async () => {
      const tracks = getImportTracks();
      if (!tracks.length) return;
      const name = document.getElementById("import-playlist-name")?.value?.trim() || getImportShareSuggestedName() || "导入歌单";
      try {
        const id = await invoke("create_playlist", { name });
        await invoke("replace_playlist_import_items", { playlistId: id, items: tracks.map((track) => toImportItemPayload(track)) });
        setSelectedPlaylist(id, name);
        await refreshPlaylistSelect();
        await refreshSidebarPlaylists();
        await loadPlaylistDetail(id, name);
        setPage("playlist");
      } catch (error) {
        alertRequestFailed(error, "import save playlist");
      }
    });
    document.getElementById("btn-import-share")?.addEventListener("click", async () => {
      const input = document.getElementById("import-share-url");
      const url = input?.value?.trim() ?? "";
      const statusEl = document.getElementById("import-share-status");
      const button = document.getElementById("btn-import-share");
      if (!url) return alert("请先粘贴分享链接。");
      if (statusEl) statusEl.textContent = "正在拉取歌单，请稍候…";
      if (button) button.disabled = true;
      try {
        const result = await invoke("fetch_share_playlist", { url });
        const tracks = result.tracks || [];
        const suggestedName = result.playlist_name || result.playlistName || "";
        setImportDraft(tracks, {
          suggestedName,
          method: "share",
          statusText: `已拉取「${suggestedName || "未命名歌单"}」共 ${tracks.length} 首，可直接保存或合并。`,
        });
        await refreshPlaylistSelect();
        if (statusEl) statusEl.textContent = `已拉取 ${tracks.length} 首 · ${suggestedName || "—"}`;
      } catch (error) {
        if (statusEl) statusEl.textContent = "";
        alertRequestFailed(error, "fetch_share_playlist");
      } finally {
        if (button) button.disabled = false;
      }
    });
    document.getElementById("import-share-url")?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      document.getElementById("btn-import-share")?.click();
    });
    document.getElementById("btn-import-merge")?.addEventListener("click", async () => {
      const tracks = getImportTracks();
      if (!tracks.length) return;
      const playlistSelect = document.getElementById("import-merge-playlist");
      const playlistId = playlistSelect?.value ? Number(playlistSelect.value) : NaN;
      if (!Number.isFinite(playlistId)) return alert("请先用「保存为新歌单」创建歌单，或检查合并目标下拉框。");
      try {
        await invoke("append_playlist_import_items", { playlistId, items: tracks.map((track) => toImportItemPayload(track)) });
        await refreshSidebarPlaylists();
        const playlistName = playlistSelect.options[playlistSelect.selectedIndex]?.textContent?.replace(/\s*\(id=.*\)\s*$/, "") || "";
        setSelectedPlaylist(playlistId, playlistName);
        await loadPlaylistDetail(playlistId, playlistName);
        setPage("playlist");
      } catch (error) {
        alertRequestFailed(error, "append_playlist_import_items");
      }
    });
    kugou.wireKugouImport();
  }

  return { refreshImportPageState, renderImportTable, wireImportPage };
}
