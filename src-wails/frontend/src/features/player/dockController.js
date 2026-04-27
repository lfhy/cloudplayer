// Dock controller owns queue rendering, favorite state, and dock popovers.
export function createDockController(deps) {
  const {
    applyQuickThemeMode,
    closeContextMenu,
    enqueueDownloadForTrack,
    getLikedIds,
    getPlayIndex,
    getDesktopLyricsLocked,
    getDesktopLyricsOpen,
    getPlayModeIndex,
    getPlayQueue,
    getQualityPref,
    iconSvgByName,
    invoke,
    openLyricsReplaceWindow,
    playFromQueueIndex,
    playModeItems,
    qualityLabels,
    refreshLyricsLockMenuLabel,
    refreshQuickThemeModeUi,
    removeCurrentFromQueue,
    renderPlayerNav,
    broadcastDesktopLyricsLock,
    saveLikedIds,
    setDesktopLyricsLocked,
    setPlayModeIndex,
    setQualityPref,
    toggleQueuePanel,
    toggleDesktopLyrics,
  } = deps;

  function randomNextIndex() {
    const queue = getPlayQueue();
    const currentIndex = getPlayIndex();
    if (queue.length <= 1) return 0;
    let nextIndex = currentIndex;
    let guard = 0;
    while (nextIndex === currentIndex && guard++ < 12) nextIndex = Math.floor(Math.random() * queue.length);
    return nextIndex;
  }

  function renderQueuePanel() {
    const list = document.getElementById("queue-list");
    const queue = getPlayQueue();
    if (!list) return;
    list.innerHTML = "";
    if (!queue.length) {
      const li = document.createElement("li");
      li.textContent = "（空）去「搜索」页找歌，或从导入歌单开始建立你的播放队列";
      list.appendChild(li);
      return;
    }
    queue.forEach((item, index) => {
      const li = document.createElement("li");
      const label = item.local_path ? `${item.title}${item.artist ? ` — ${item.artist}` : ""}` : item.artist ? `${item.title} — ${item.artist}` : item.title;
      if (index === getPlayIndex()) li.classList.add("is-current");
      li.textContent = label;
      li.title = item.local_path ? String(item.local_path) : `id=${item.source_id} · 双击播放`;
      li.addEventListener("dblclick", () => void playFromQueueIndex(index));
      list.appendChild(li);
    });
  }

  function refreshFavButton() {
    const button = document.getElementById("btn-dock-fav");
    const current = getPlayQueue()[getPlayIndex()];
    if (!button) return;
    if (!current) {
      button.classList.remove("is-on");
      button.textContent = "♡";
      button.disabled = false;
      button.title = "喜欢";
      return;
    }
    const sourceId = (current.source_id || "").trim();
    const canFav = !!sourceId && !current.local_path;
    const liked = canFav && getLikedIds().has(sourceId);
    button.disabled = !canFav;
    button.title = canFav ? "喜欢" : "本地文件无曲库 id，不支持喜欢";
    button.classList.toggle("is-on", liked);
    button.textContent = liked ? "♥" : "♡";
  }

  function closeAllDockMenus() {
    document.querySelectorAll(".dock-menu").forEach((menu) => {
      menu.hidden = true;
    });
  }

  function toggleDockMenu(menuEl) {
    const willOpen = menuEl.hidden;
    closeAllDockMenus();
    menuEl.hidden = !willOpen;
  }

  function wireDockBar() {
    const modeBtn = document.getElementById("btn-play-mode");
    if (modeBtn) {
      const refreshPlayModeButton = () => {
        const mode = playModeItems[getPlayModeIndex()];
        modeBtn.innerHTML = iconSvgByName(mode.icon);
        modeBtn.title = mode.tip;
        modeBtn.setAttribute("aria-label", mode.tip);
        modeBtn.dataset.playMode = mode.key;
      };
      refreshPlayModeButton();
      modeBtn.addEventListener("click", () => {
        setPlayModeIndex((getPlayModeIndex() + 1) % playModeItems.length);
        modeBtn.classList.remove("is-switching");
        void modeBtn.offsetWidth;
        modeBtn.classList.add("is-switching");
        refreshPlayModeButton();
        window.setTimeout(() => modeBtn.classList.remove("is-switching"), 220);
        renderPlayerNav();
      });
    }
    const qualityBtn = document.getElementById("dock-quality");
    const qualityMenu = document.getElementById("popover-quality");
    if (qualityBtn && qualityMenu) {
      qualityBtn.textContent = qualityLabels[getQualityPref()] || "标准";
      qualityBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleDockMenu(qualityMenu);
      });
      qualityMenu.querySelectorAll("[data-quality]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          setQualityPref(button.getAttribute("data-quality") || "128");
          qualityBtn.textContent = qualityLabels[getQualityPref()] || "标准";
          closeAllDockMenus();
        });
      });
    }
    const themeBtn = document.getElementById("dock-theme-mode");
    if (themeBtn) {
      refreshQuickThemeModeUi();
      themeBtn.addEventListener("click", () => {
        const nextMode = deps.nextQuickThemeMode(themeBtn.dataset.quickThemeMode || deps.effectiveQuickThemeMode());
        themeBtn.classList.remove("is-switching");
        void themeBtn.offsetWidth;
        themeBtn.classList.add("is-switching");
        applyQuickThemeMode(nextMode);
        window.setTimeout(() => themeBtn.classList.remove("is-switching"), 220);
      });
    }
    document.getElementById("btn-dock-fav")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const current = getPlayQueue()[getPlayIndex()];
      if (!current) return;
      const sourceId = (current.source_id || "").trim();
      if (!sourceId || current.local_path) return void alert("仅在线试听曲目支持「喜欢」（需曲库 id）。");
      const likedIds = getLikedIds();
      if (likedIds.has(sourceId)) likedIds.delete(sourceId);
      else likedIds.add(sourceId);
      saveLikedIds(likedIds);
      refreshFavButton();
    });
    document.getElementById("btn-dock-dl")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDockMenu(document.getElementById("popover-dl"));
    });
    document.getElementById("popover-dl")?.querySelectorAll("[data-dlq]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const current = getPlayQueue()[getPlayIndex()];
        closeAllDockMenus();
        if (!current) return void alert("当前没有播放曲目。");
        void enqueueDownloadForTrack({ sourceId: current.source_id, title: current.title, artist: current.artist }, button.getAttribute("data-dlq") || "128");
      });
    });
    document.getElementById("btn-dock-lyrics-replace")?.addEventListener("click", (event) => {
      event.stopPropagation();
      closeAllDockMenus();
      void openLyricsReplaceWindow();
    });
    document.getElementById("btn-dock-more")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDockMenu(document.getElementById("popover-more"));
    });
    document.querySelector('[data-more="add-pl"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      closeAllDockMenus();
      alert("添加到歌单：待接入数据库与歌单页。");
    });
    document.querySelector('[data-more="rm-queue"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      closeAllDockMenus();
      removeCurrentFromQueue();
    });
    document.getElementById("btn-dock-lyrics")?.addEventListener("click", async (event) => {
      event.stopPropagation();
      try {
        await toggleDesktopLyrics();
      } catch (error) {
        deps.alertRequestFailed(error, "toggleDesktopLyrics");
      }
    });
    document.getElementById("btn-dock-lyrics-lock")?.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!getDesktopLyricsOpen()) return;
      setDesktopLyricsLocked(!getDesktopLyricsLocked());
      refreshLyricsLockMenuLabel();
      try {
        await invoke("save_settings", { patch: { desktop_lyrics_locked: getDesktopLyricsLocked() } });
      } catch (error) {
        console.warn("save_settings desktop_lyrics_locked", error);
      }
      await broadcastDesktopLyricsLock();
    });
    document.getElementById("btn-dock-queue")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleQueuePanel();
    });
    document.addEventListener("click", () => {
      closeAllDockMenus();
      closeContextMenu();
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest(".dock-menu-anchor") || event.target.closest(".dock-menu")) return;
      closeAllDockMenus();
    });
  }

  return { closeAllDockMenus, randomNextIndex, refreshFavButton, renderQueuePanel, toggleDockMenu, wireDockBar };
}
