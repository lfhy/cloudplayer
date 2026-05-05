// Bootstrap wires DOM-ready initialization and window-level events after controllers are built.
export function bootCloudPlayerApp(deps) {
  const {
    alertRequestFailed,
    applyAppTheme,
    applyPlatformClassNames,
    applyLyricsPayload,
    broadcastDesktopLyricsLock,
    broadcastTrayPlayerState,
    emitTo,
    ensureLrcLoadedForCurrentTrack,
    getCurrentPlayableKey,
    getPlayIndex,
    getPlayLoadGeneration,
    getPlayQueue,
    getSelectedPlaylistId,
    getSelectedPlaylistName,
    getSettingsFormValues,
    invoke,
    listen,
    loadPlaylistDetail,
    loadRecentPlaysFromDb,
    loadSettings,
    lyricsReplaceTarget,
    player,
    mainWindowCloseAction,
    normalizeAppThemeMode,
    onDownloadTaskChanged,
    onLyricsLockSync,
    onSystemThemeChange,
    openLyricsReplaceWindow,
    openCloseConfirmModal,
    refreshLyricsLockMenuLabel,
    renderDailyTable,
    renderImportTable,
    renderMainShell,
    renderPlaylistSearchResults,
    renderQueuePanel,
    renderSearchTable,
    setPage,
    setSearchScope,
    syncDesktopLyricsState,
    syncTrayCommand,
    systemDarkMedia,
    updateSearchToolbar,
    updateSearchViewState,
    wireAccountCenter,
    wireAudio,
    wireDiscoverToolbar,
    wireDockBar,
    wireDownloadPage,
    wireGlobalHotkeyListener,
    wireImportPage,
    wirePlaylistPage,
    wirePreferencesModals,
    wireQueueToggle,
    wireSearchPage,
    wireVolume,
  } = deps;

  document.addEventListener("DOMContentLoaded", () => {
    renderMainShell();
    applyPlatformClassNames();
    deps.renderSidebar();
    setPage("home");
    wireHomeShortcuts(setPage, renderDailyTable, invoke);
    wireQueueToggle();
    wireAccountCenter();
    wireDockBar();
    wireDownloadPage();
    wireImportPage();
    wirePlaylistPage();
    wireVolume();
    wirePreferencesModals();
    wireSearchPage();
    wireGlobalHotkeyListener();
    wireDiscoverToolbar();
    wireAudio();
    setSearchScope(deps.searchState.scope);
    updateSearchViewState();
    renderSearchTable();
    renderPlaylistSearchResults();
    renderImportTable();
    updateSearchToolbar();
    renderQueuePanel();
    refreshLyricsLockMenuLabel();
    bindRuntimeEvents();
    void loadRecentPlaysFromDb();
    loadSettings();
    void broadcastTrayPlayerState();
  });

  function bindRuntimeEvents() {
    let enrichReloadTimer = null;
    listen("import-enrich-item-done", (event) => {
      const payload = event.payload;
      const playlistId = payload?.playlistId ?? payload?.playlist_id;
      if (playlistId == null || playlistId !== getSelectedPlaylistId()) return;
      if (enrichReloadTimer) clearTimeout(enrichReloadTimer);
      enrichReloadTimer = setTimeout(() => {
        enrichReloadTimer = null;
        void loadPlaylistDetail(getSelectedPlaylistId(), getSelectedPlaylistName());
      }, 450);
    });
    listen("import-enrich-finished", (event) => {
      const payload = event.payload;
      const playlistId = payload?.playlistId ?? payload?.playlist_id;
      if (playlistId == null || playlistId !== getSelectedPlaylistId()) return;
      void loadPlaylistDetail(getSelectedPlaylistId(), getSelectedPlaylistName());
    });
    listen("desktop-lyrics-lock-sync", (event) => {
      const locked = event?.payload?.locked;
      if (typeof locked === "boolean") onLyricsLockSync(locked);
    });
    listen("desktop-lyrics-request-sync", async () => {
      await ensureLrcLoadedForCurrentTrack(getPlayLoadGeneration());
      await syncDesktopLyricsState();
    });
    listen("tray-player-request-sync", async () => {
      await broadcastTrayPlayerState();
    });
    listen("tray-player-command", async (event) => {
      await syncTrayCommand(event?.payload?.action);
    });
    listen("download-task-changed", (event) => {
      onDownloadTaskChanged(event?.payload);
    });
    listen("desktop-lyrics-request-lock", async (event) => {
      const locked = event?.payload?.locked;
      if (typeof locked !== "boolean") return;
      onLyricsLockSync(locked);
      try {
        await invoke("save_settings", { patch: { desktop_lyrics_locked: locked } });
      } catch (error) {
        console.warn("save_settings desktop_lyrics_locked (request-lock)", error);
      }
      await broadcastDesktopLyricsLock();
    });
    listen("main-close-requested", async () => {
      await handleMainCloseRequested();
    });
    listen("lyrics-replace-apply-request", async (event) => {
      await handleLyricsReplaceApplyRequest(event);
    });
    listen("desktop-lyrics-open-replace", async () => {
      await openLyricsReplaceWindow();
    });
    listen("desktop-lyrics-close-request", async () => {
      if (typeof player.closeDesktopLyrics === "function") {
        await player.closeDesktopLyrics();
      }
    });
    if (systemDarkMedia && typeof systemDarkMedia.addEventListener === "function") {
      systemDarkMedia.addEventListener("change", () => {
        const mode = normalizeAppThemeMode(
          document.getElementById("setting-app-theme-mode")?.value ??
            document.documentElement.dataset.themeMode ??
            "system"
        );
        if (mode !== "system") return;
        const current = getSettingsFormValues();
        applyAppTheme(current.theme, current.customAccent, mode);
        onSystemThemeChange();
      });
    }
  }

  async function handleMainCloseRequested() {
    const action = mainWindowCloseAction();
    if (action === "quit") {
      try {
        await invoke("quit_app");
      } catch (error) {
        alertRequestFailed(error, "close flow");
      }
      return;
    }
    if (action === "tray") {
      try {
        await invoke("hide_main_window");
      } catch (error) {
        alertRequestFailed(error, "close flow");
      }
      return;
    }
    openCloseConfirmModal();
  }

  async function handleLyricsReplaceApplyRequest(event) {
    const requestId = String(event?.payload?.requestId || "").trim();
    const replyTarget = String(event?.payload?.replyTarget || lyricsReplaceTarget.label).trim();
    if (!requestId) return;
    const current = getPlayQueue()[getPlayIndex()] || null;
    if (!current) return reply(false, "当前没有正在播放的曲目。");
    const expectedTrackKey = String(event?.payload?.trackKey || "").trim();
    const currentTrackKey = getCurrentPlayableKey(current);
    if (expectedTrackKey && expectedTrackKey !== currentTrackKey) {
      return reply(false, "当前播放曲目已变化，请重新打开“换歌词”窗口。");
    }
    const lyricsPayload = event?.payload?.lyricsPayload;
    if (!String(lyricsPayload?.lrcText || "").trim()) {
      return reply(false, "当前候选没有可用歌词。");
    }
    const audio = player?.getAudioEl?.() ?? null;
    const durationSeconds = audio?.duration && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
    try {
      await invoke("save_lyrics_override", {
        req: {
          pjmp3SourceId: current.local_path ? null : (current.source_id || "").trim() || null,
          title: current.title || "",
          artist: current.artist || "",
          album: current.album || "",
          localPath: current.local_path || null,
          durationSeconds,
        },
        payload: lyricsPayload,
      });
    } catch (error) {
      console.warn("save_lyrics_override", error);
      return reply(false, "保存歌词失败，请重试。");
    }
    await applyLyricsPayload(lyricsPayload);
    await reply(true, "");

    async function reply(ok, message = "") {
      try {
        await emitTo({ kind: "WebviewWindow", label: replyTarget }, "lyrics-replace-apply-result", {
          requestId,
          ok,
          message,
        });
      } catch (error) {
        console.warn("lyrics-replace-apply-result", error);
      }
    }
  }
}

function wireHomeShortcuts(setPage, renderDailyTable, invoke) {
  document.getElementById("btn-home-search")?.addEventListener("click", () => setPage("search"));
  document.getElementById("btn-home-import")?.addEventListener("click", () => setPage("import"));
  document.getElementById("btn-home-open-recent")?.addEventListener("click", () => setPage("recent"));
  document.getElementById("btn-home-open-daily")?.addEventListener("click", () => setPage("daily"));
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("#btn-refresh-daily") : null;
    if (!target) return;
    console.info("[daily] refresh button clicked");
    void invoke?.("log_frontend_debug", {
      scope: "daily",
      stage: "refresh-click",
      detail: JSON.stringify({
        pageActive: document.querySelector('.page[data-page="daily"]')?.classList.contains("page-active") || false,
        visible: target instanceof HTMLElement ? !target.hidden : true,
      }),
    }).catch(() => {});
    void renderDailyTable(true)
      .then(() => {
        console.info("[daily] refresh completed");
        void invoke?.("log_frontend_debug", {
          scope: "daily",
          stage: "refresh-completed",
          detail: JSON.stringify({
            pageActive: document.querySelector('.page[data-page="daily"]')?.classList.contains("page-active") || false,
          }),
        }).catch(() => {});
      })
      .catch((error) => {
        console.warn("[daily] refresh failed", error);
        void invoke?.("log_frontend_debug", {
          scope: "daily",
          stage: "refresh-failed",
          detail: JSON.stringify({ message: String(error?.message || error) }),
        }).catch(() => {});
      });
  });
}
