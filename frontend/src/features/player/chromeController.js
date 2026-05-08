import { setCoverImageSource } from "../../app/helpers/covers.js";
import { getPlaybackSeekDisplay } from "./pendingPlaybackUi.js";

// Player chrome helpers keep dock text, seek UI and prev/next enablement consistent.
export function createPlayerChromeController(deps) {
  const {
    broadcastTrayPlayerState,
    formatTime,
    getAudioEl,
    getPlayIndex,
    getPlayQueue,
    getSeekDragging,
  } = deps;

  function updatePlayerChrome(patch = {}) {
    const { title, sub, coverUrl, touchCover = true } = patch;
    const titleEl = document.getElementById("dock-title");
    const subEl = document.getElementById("dock-sub");
    const coverEl = document.getElementById("dock-cover");
    const immersiveTitleEl = document.getElementById("immersive-title");
    const immersiveArtistEl = document.getElementById("immersive-artist");
    const immersiveAlbumEl = document.getElementById("immersive-album");
    const immersiveCoverEl = document.getElementById("immersive-cover");
    if (title !== undefined && titleEl) titleEl.textContent = title;
    if (title !== undefined && immersiveTitleEl) immersiveTitleEl.textContent = title;
    if (sub !== undefined && subEl) subEl.textContent = sub;
    if (sub !== undefined && immersiveArtistEl) immersiveArtistEl.textContent = sub;
    if (touchCover && coverEl && coverUrl !== undefined) setCoverImageSource(coverEl, coverUrl, { size: 52, radius: 10 });
    if (touchCover && immersiveCoverEl && coverUrl !== undefined) setCoverImageSource(immersiveCoverEl, coverUrl, { size: 320, radius: 32 });
    if (immersiveAlbumEl && patch.album !== undefined) immersiveAlbumEl.textContent = patch.album || "正在聆听";
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
    const track = getPlayQueue()[getPlayIndex()] || null;
    const { currentTimeMs, durationMs } = getPlaybackSeekDisplay(audio, track);
    current.textContent = formatTime(currentTimeMs / 1000);
    total.textContent = durationMs > 0 ? formatTime(durationMs / 1000) : "0:00";
    if (durationMs > 0 && !getSeekDragging()) {
      seek.value = String(Math.min(1000, Math.floor((currentTimeMs / durationMs) * 1000)));
    } else if (!getSeekDragging()) {
      seek.value = "0";
    }
    seek.disabled = !audio.src;
    seek.style.setProperty("--seek-progress", `${Number(seek.value) / 10}%`);
  }

  function setPlayerNavEnabled() {
    const prev = document.getElementById("btn-player-prev");
    const next = document.getElementById("btn-player-next");
    const length = getPlayQueue().length;
    if (!length) {
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
    }
    if (prev) prev.disabled = !length;
    if (next) next.disabled = !length;
    queueMicrotask(() => {
      void broadcastTrayPlayerState();
    });
  }

  return { setPlayerNavEnabled, syncSeekUi, updatePlayerChrome };
}
