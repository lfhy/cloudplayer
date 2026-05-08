import { coverImgHtml } from "../../app/helpers/covers.js";
import { favoriteIconSvg } from "../../app/helpers/icons.js";
import { escapeHtml } from "../../app/helpers/text.js";
import { toggleFavoriteTrack } from "../library/favoriteToggle.js";

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
    playFromQueueIndex,
    playModeItems,
    qualityLabels,
    refreshLyricsLockMenuLabel,
    refreshQuickThemeModeUi,
    removeCurrentFromQueue,
    renderPlayerNav,
    broadcastDesktopLyricsLock,
    scheduleSavePlaybackState,
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
    const count = document.getElementById("queue-count");
    const queue = getPlayQueue();
    if (!list) return;
    if (count) count.textContent = `${queue.length} 首`;
    list.innerHTML = "";
    if (!queue.length) {
      const li = document.createElement("li");
      li.className = "queue-empty";
      li.textContent = "播放队列为空";
      list.appendChild(li);
      return;
    }
    queue.forEach((item, index) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      const cover = coverImgHtml({
        src: item.cover_url || "",
        className: "queue-item__cover",
        width: 48,
        height: 48,
        radius: 12,
        alt: item.title || "",
      });
      const rank = String(index + 1).padStart(2, "0");
      const sub = item.artist || (item.local_path ? "本地音乐" : "在线曲目");
      button.type = "button";
      button.className = "queue-item";
      if (index === getPlayIndex()) button.classList.add("is-current");
      button.innerHTML = `
        <span class="queue-item__idx">${rank}</span>
        ${cover}
        <span class="queue-item__meta">
          <span class="queue-item__title">${escapeHtml(item.title || "未命名曲目")}</span>
          <span class="queue-item__sub">${escapeHtml(sub)}</span>
        </span>`;
      button.addEventListener("click", () => void playFromQueueIndex(index));
      li.appendChild(button);
      list.appendChild(li);
    });
  }

  function refreshFavButton() {
    const button = document.getElementById("btn-dock-fav");
    const current = getPlayQueue()[getPlayIndex()];
    if (!button) return;
    if (!current) {
      button.classList.remove("is-on");
      button.innerHTML = favoriteIconSvg(false);
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
    button.innerHTML = favoriteIconSvg(liked);
  }

  function closeAllDockMenus() {
    document.querySelectorAll(".dock-menu").forEach((menu) => {
      menu.hidden = true;
    });
  }

  function refreshPlayModeButton() {
    const modeBtn = document.getElementById("btn-play-mode");
    if (!modeBtn) return;
    const mode = playModeItems[getPlayModeIndex()];
    modeBtn.innerHTML = iconSvgByName(mode.icon);
    modeBtn.title = mode.tip;
    modeBtn.setAttribute("aria-label", mode.tip);
    modeBtn.dataset.playMode = mode.key;
  }

  function toggleDockMenu(menuEl) {
    const willOpen = menuEl.hidden;
    closeAllDockMenus();
    menuEl.hidden = !willOpen;
  }

  function wireDockBar() {
    const modeBtn = document.getElementById("btn-play-mode");
    if (modeBtn) {
      refreshPlayModeButton();
      modeBtn.addEventListener("click", () => {
        setPlayModeIndex((getPlayModeIndex() + 1) % playModeItems.length);
        modeBtn.classList.remove("is-switching");
        void modeBtn.offsetWidth;
        modeBtn.classList.add("is-switching");
        refreshPlayModeButton();
        window.setTimeout(() => modeBtn.classList.remove("is-switching"), 220);
        renderPlayerNav();
        scheduleSavePlaybackState?.();
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
    document.getElementById("btn-dock-fav")?.addEventListener("click", async (event) => {
      event.stopPropagation();
      const current = getPlayQueue()[getPlayIndex()];
      if (!current) return;
      const changed = await toggleFavoriteTrack(current, {
        alertRequestFailed: deps.alertRequestFailed,
        getLikedIds,
        invoke,
        onAfterToggle: () => refreshFavButton(),
      });
      if (!changed) {
        if (!current.source_id || current.local_path) return void alert("仅在线试听曲目支持「喜欢」（需曲库 id）。");
      }
    });
    window.addEventListener("cloudplayer:favorites-changed", () => refreshFavButton());
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
        void enqueueDownloadForTrack({ sourceId: current.source_id, title: current.title, artist: current.artist, coverUrl: current.cover_url || "" }, button.getAttribute("data-dlq") || "128");
      });
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

  return { closeAllDockMenus, randomNextIndex, refreshFavButton, refreshPlayModeButton, renderQueuePanel, toggleDockMenu, wireDockBar };
}
