import { setCoverImageSource } from "../../app/helpers/covers.js";
import { currentPlayableKey } from "../lyrics/model.js";
import { buildLyricLineHtml, lineProgressRatio } from "./immersiveLyricsView.js";
import { applyActiveLyricProgress, applyLyricLineStates, captureLyricLineElements, centerActiveLyricLine } from "./lyricsMotionController.js";
import { createLyricTimingSmoother } from "./lyricTimingSmoother.js";
import { getPlaybackSeekDisplay } from "./pendingPlaybackUi.js";
import { setPlayButtonIcon } from "./playButtonIcon.js";

// Immersive mode renders from the shared lyrics snapshot using stable line-level sync.
export function createImmersiveController(deps) {
  const { formatTime, getAudioEl, getCurrentLyricsSnapshot, getPlayIndex, getPlayQueue, getSeekDragging, readCurrentLyricsSnapshot, setSeekDragging } = deps;
  const timing = createLyricTimingSmoother();
  let activeLineIndex = -1, closeTimer = 0, currentMetaKey = "", open = false, renderedWindowKey = "", syncTimer = 0;
  let lyricsSnapshot = null, snapshotKey = "", snapshotLoadingKey = "", snapshotPromise = null;
  let lyricAnchor = null;
  let lyricLineElements = [];
  let activeLineProgress = -1;
  let manualScrollUntil = 0;

  function currentTrack() { return getPlayQueue()[getPlayIndex()] || null; }
  function lyricBox() { return document.getElementById("immersive-lyrics"); }
  function panelEl() { return document.getElementById("immersive-player"); }
  function pauseAutoScroll(ms = 2400) { manualScrollUntil = Date.now() + ms; }

  function applySnapshot(snapshot) {
    lyricsSnapshot = snapshot || null;
    snapshotKey = currentPlayableKey(snapshot?.currentTrack) || "";
    lyricAnchor = lyricsSnapshot?.payload || null;
  }

  function ensureSnapshot(trackKey = currentPlayableKey(currentTrack())) {
    if (!trackKey) {
      applySnapshot(null);
      return Promise.resolve(null);
    }
    if (snapshotKey === trackKey && lyricsSnapshot) return Promise.resolve(lyricsSnapshot);
    if (snapshotLoadingKey === trackKey && snapshotPromise) return snapshotPromise;
    snapshotLoadingKey = trackKey;
    snapshotPromise = getCurrentLyricsSnapshot()
      .then((snapshot) => {
        if ((currentPlayableKey(snapshot?.currentTrack) || "") === trackKey) applySnapshot(snapshot);
        renderedWindowKey = "";
        if (open) renderLyricsFrame(true);
        return snapshot;
      })
      .finally(() => {
        if (snapshotLoadingKey === trackKey) {
          snapshotLoadingKey = "";
          snapshotPromise = null;
        }
      });
    return snapshotPromise;
  }

  function refreshSnapshot() {
    const snapshot = readCurrentLyricsSnapshot?.() || null;
    if (!snapshot) return;
    applySnapshot(snapshot);
  }

  function setOpen(nextOpen) {
    const panel = panelEl();
    if (!panel) return;
    window.clearTimeout(closeTimer);
    open = !!nextOpen;
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) {
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add("is-visible"));
      document.body.classList.add("immersive-player-open");
      manualScrollUntil = 0;
      syncMeta();
      syncTransport();
      syncSeekUi();
      renderLyricsFrame(true);
      scheduleLoop();
      return;
    }
    panel.classList.remove("is-visible");
    document.body.classList.remove("immersive-player-open");
    scheduleLoop();
    closeTimer = window.setTimeout(() => { if (!open) panel.hidden = true; }, 260);
  }

  function toggle() { setOpen(!open); }
  function close() { setOpen(false); }

  function syncMeta() {
    const track = currentTrack();
    const key = currentPlayableKey(track);
    const titleEl = document.getElementById("immersive-title");
    const artistEl = document.getElementById("immersive-artist");
    const albumEl = document.getElementById("immersive-album");
    const coverEl = document.getElementById("immersive-cover");
    if (titleEl) titleEl.textContent = track?.title || "未播放";
    if (artistEl) artistEl.textContent = track?.artist || (track ? "未知艺术家" : "选择曲目开始播放");
    if (albumEl) albumEl.textContent = track?.album || (track?.local_path ? "本地音乐" : track ? "正在聆听" : "在这里查看歌词沉浸模式");
    if (coverEl) setCoverImageSource(coverEl, track?.cover_url || "", { size: 240, radius: 24 });
    if (key !== currentMetaKey) {
      currentMetaKey = key;
      renderedWindowKey = "";
      activeLineIndex = -1;
      void ensureSnapshot(key);
    } else {
      refreshSnapshot();
    }
  }

  function syncTransport() {
    const audio = getAudioEl();
    const hasQueue = getPlayQueue().length > 0;
    setPlayButtonIcon(document.getElementById("btn-immersive-play"), !!audio && !audio.paused);
    ["btn-immersive-play", "btn-immersive-prev", "btn-immersive-next"].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = !hasQueue;
    });
  }

  function syncSeekUi() {
    const audio = getAudioEl();
    const seek = document.getElementById("immersive-seek");
    const currentEl = document.getElementById("immersive-time-current");
    const totalEl = document.getElementById("immersive-time-total");
    if (!seek || !currentEl || !totalEl) return;
    const track = getPlayQueue()[getPlayIndex()] || null;
    const { currentTimeMs, durationMs } = getPlaybackSeekDisplay(audio, track);
    currentEl.textContent = formatTime(currentTimeMs / 1000);
    totalEl.textContent = durationMs > 0 ? formatTime(durationMs / 1000) : "0:00";
    if (!getSeekDragging()) {
      seek.value = durationMs > 0 ? String(Math.min(1000, Math.floor((currentTimeMs / durationMs) * 1000))) : "0";
    }
    seek.disabled = !(audio && audio.src);
    seek.style.setProperty("--seek-progress", `${Number(seek.value) / 10}%`);
  }

  function renderLyricsFrame(force = false) {
    const box = lyricBox();
    const track = currentTrack();
    const snapshot = lyricsSnapshot;
    const anchor = lyricAnchor;
    if (!box) return;
    if (!track) {
      if (force || renderedWindowKey !== "idle") {
        renderedWindowKey = "idle";
        activeLineIndex = -1;
        activeLineProgress = -1;
        lyricLineElements = [];
        timing.resetProgress();
        box.innerHTML = '<p class="immersive-player__lyrics-empty">选择歌曲后即可进入沉浸歌词模式</p>';
      }
      return;
    }
    const entries = Array.isArray(snapshot?.lrcEntries) ? snapshot.lrcEntries : [];
    if (!entries.length || !anchor) {
      const waiting = snapshotLoadingKey === currentMetaKey || snapshotKey !== currentMetaKey;
      const mode = waiting ? "loading" : "fallback";
      if (force || renderedWindowKey !== mode) {
        renderedWindowKey = mode;
        activeLineIndex = -1;
        activeLineProgress = -1;
        timing.resetProgress();
        box.innerHTML = waiting
          ? '<p class="immersive-player__lyrics-empty">歌词加载中...</p>'
          : [buildLyricLineHtml({ text: track.title || "当前歌曲" }, 0), buildLyricLineHtml({ text: track.artist || "暂无滚动歌词" }, 1)].join("");
        lyricLineElements = captureLyricLineElements(box, ".immersive-player__lyrics-line");
        if (!waiting) box.querySelector('.immersive-player__lyrics-line[data-lyric-index="0"]')?.classList.add("is-active");
      }
      return;
    }
    const index = Number.isInteger(anchor.activeIndex) ? anchor.activeIndex : -1;
    const windowKey = `${currentMetaKey}|full|${entries.length}`;
    if (force || renderedWindowKey !== windowKey) {
      renderedWindowKey = windowKey;
      box.innerHTML = entries.map((entry, absoluteIndex) => buildLyricLineHtml(entry, absoluteIndex)).join("");
      lyricLineElements = captureLyricLineElements(box, ".immersive-player__lyrics-line");
      activeLineIndex = -1;
      activeLineProgress = -1;
      timing.resetProgress();
    }
    updateVisibleLineState(box, { entries, index, payload: anchor });
  }

  function updateVisibleLineState(box, state) {
    const token = [currentMetaKey, state.index, state?.payload?.line1, state?.payload?.line2, state?.payload?.line1StartT, state?.payload?.line2StartT].join("|");
    const currentTime = timing.syncedCurrentTime(token, state?.payload);
    const wordLines = Array.isArray(lyricsSnapshot?.wordLines) ? lyricsSnapshot.wordLines : null;
    const rawRatio = lineProgressRatio({ index: state.index, activeIndex: state.index, entries: state.entries, wordLines, currentTime });
    const activeEntry = state.entries[state.index];
    const nextEntry = state.entries[state.index + 1];
    const lineKey = `${currentMetaKey}|${state.index}|${activeEntry?.text || ""}|${activeEntry?.t || 0}|${nextEntry?.t || (activeEntry?.t || 0) + 4}`;
    const ratio = timing.monotonicProgress(lineKey, currentTime, rawRatio);
    if (state.index !== activeLineIndex) {
      applyLyricLineStates(lyricLineElements, state.index, ratio);
      activeLineProgress = ratio;
    } else if (Math.abs(ratio - activeLineProgress) > 0.003) {
      applyActiveLyricProgress(lyricLineElements, state.index, ratio);
      activeLineProgress = ratio;
    }
    if (state.index !== activeLineIndex) {
      activeLineIndex = state.index;
      if (Date.now() >= manualScrollUntil) {
        centerActiveLyricLine(box, lyricLineElements, state.index);
      }
    }
  }

  function tick() {
    if (!open) return;
    syncSeekUi();
    renderLyricsFrame();
    syncTimer = requestAnimationFrame(tick);
  }

  function scheduleLoop() {
    if (syncTimer) cancelAnimationFrame(syncTimer);
    syncTimer = open ? requestAnimationFrame(tick) : 0;
  }

  function syncAll() {
    if (!open) return;
    syncMeta();
    syncTransport();
    syncSeekUi();
    renderLyricsFrame(true);
  }

  function wire() {
    document.getElementById("btn-dock-immersive")?.addEventListener("click", toggle);
    document.getElementById("btn-immersive-close")?.addEventListener("click", close);
    panelEl()?.querySelector(".immersive-player__backdrop")?.addEventListener("click", close);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && open) close(); });
    document.getElementById("btn-immersive-play")?.addEventListener("click", () => document.getElementById("btn-player-play")?.click());
    document.getElementById("btn-immersive-prev")?.addEventListener("click", () => document.getElementById("btn-player-prev")?.click());
    document.getElementById("btn-immersive-next")?.addEventListener("click", () => document.getElementById("btn-player-next")?.click());
    const seek = document.getElementById("immersive-seek");
    const lyrics = lyricBox();
    seek?.addEventListener("pointerdown", () => setSeekDragging(true));
    seek?.addEventListener("pointerup", () => { setSeekDragging(false); syncSeekUi(); refreshSnapshot(); renderLyricsFrame(); });
    seek?.addEventListener("input", () => {
      const audio = getAudioEl();
      const duration = audio?.duration;
      if (audio && duration && Number.isFinite(duration) && duration > 0) {
        audio.currentTime = (Number(seek.value) / 1000) * duration;
        syncSeekUi();
        refreshSnapshot();
        renderLyricsFrame();
      }
    });
    lyrics?.addEventListener("wheel", (event) => {
      if (lyrics.scrollHeight <= lyrics.clientHeight) return;
      pauseAutoScroll();
      event.preventDefault();
      lyrics.scrollTop += event.deltaY;
    }, { passive: false });
    lyrics?.addEventListener("scroll", () => pauseAutoScroll(1800), { passive: true });
    const observe = () => {
      const audio = getAudioEl();
      if (!audio) return requestAnimationFrame(observe);
      audio.addEventListener("timeupdate", () => { refreshSnapshot(); if (open) renderLyricsFrame(); });
      audio.addEventListener("play", () => { refreshSnapshot(); if (open) { syncTransport(); scheduleLoop(); renderLyricsFrame(); } });
      audio.addEventListener("pause", () => { refreshSnapshot(); if (open) { syncTransport(); renderLyricsFrame(); } });
      audio.addEventListener("ended", () => { refreshSnapshot(); if (open) { syncTransport(); renderLyricsFrame(); } });
      audio.addEventListener("loadedmetadata", () => { refreshSnapshot(); if (open) syncAll(); });
    };
    observe();
  }

  return { close, getOpen: () => open, syncAll, syncMeta, syncSeekUi, syncTransport, toggle, wire };
}
