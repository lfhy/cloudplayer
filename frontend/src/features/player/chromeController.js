import { setCoverImageSource } from "../../app/helpers/covers.js";

// Player chrome helpers keep dock text, seek UI and prev/next enablement consistent.
export function createPlayerChromeController(deps) {
  const {
    broadcastTrayPlayerState,
    formatTime,
    getAudioEl,
    getPlayIndex,
    getPlayModeIndex,
    getPlayQueue,
    getSeekDragging,
    playModeItems,
  } = deps;

  function updatePlayerChrome(patch = {}) {
    const { title, sub, coverUrl, touchCover = true } = patch;
    const titleEl = document.getElementById("dock-title");
    const subEl = document.getElementById("dock-sub");
    const coverEl = document.getElementById("dock-cover");
    if (title !== undefined && titleEl) titleEl.textContent = title;
    if (sub !== undefined && subEl) subEl.textContent = sub;
    if (touchCover && coverEl && coverUrl !== undefined) setCoverImageSource(coverEl, coverUrl, { size: 52, radius: 10 });
    queueMicrotask(() => {
      void broadcastTrayPlayerState();
    });
  }

  function syncSeekUi() {
    const audio = getAudioEl();
    const seek = document.getElementById("seek");
    const current = document.getElementById("time-current");
    const total = document.getElementById("time-total");
    if (!audio || !seek || !current || !total) return;
    const duration = audio.duration;
    if (duration && Number.isFinite(duration) && duration > 0) {
      total.textContent = formatTime(duration);
      if (!getSeekDragging()) {
        seek.value = String(Math.min(1000, Math.floor((audio.currentTime / duration) * 1000)));
      }
      current.textContent = formatTime(audio.currentTime);
      seek.disabled = false;
      // Reflect played progress via a CSS variable so the filled and unfilled track use different colors.
      seek.style.setProperty("--seek-progress", `${Number(seek.value) / 10}%`);
      return;
    }
    current.textContent = "0:00";
    total.textContent = "0:00";
    seek.value = "0";
    seek.disabled = !audio.src;
    seek.style.setProperty("--seek-progress", "0%");
  }

  function setPlayerNavEnabled() {
    const prev = document.getElementById("btn-player-prev");
    const next = document.getElementById("btn-player-next");
    const length = getPlayQueue().length;
    const mode = playModeItems[getPlayModeIndex()].key;
    if (!length) {
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      return;
    }
    if (mode === "loop_list" || mode === "shuffle") {
      if (prev) prev.disabled = false;
      if (next) next.disabled = false;
      return;
    }
    if (mode === "one") {
      const disabled = length <= 1;
      if (prev) prev.disabled = disabled;
      if (next) next.disabled = disabled;
      return;
    }
    if (prev) prev.disabled = getPlayIndex() <= 0;
    if (next) next.disabled = getPlayIndex() >= length - 1;
    queueMicrotask(() => {
      void broadcastTrayPlayerState();
    });
  }

  return { setPlayerNavEnabled, syncSeekUi, updatePlayerChrome };
}
