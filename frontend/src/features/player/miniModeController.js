import { setCoverImageSource } from "../../app/helpers/covers.js";
import { escapeHtml } from "../../app/helpers/text.js";
import { currentPlayableKey } from "../lyrics/model.js";
import { lineProgressRatio } from "./immersiveLyricsView.js";
import { applyActiveLyricProgress, applyLyricLineStates, captureLyricLineElements, centerActiveLyricLine } from "./lyricsMotionController.js";
import { createLyricTimingSmoother } from "./lyricTimingSmoother.js";
import { getPlaybackSeekDisplay } from "./pendingPlaybackUi.js";
import { createMiniModeWindowController } from "./miniModeWindow.js";
import { setPlayButtonIcon } from "./playButtonIcon.js";

// Mini mode keeps a compact Apple-Music-style shell in sync with the shared playback state.
export function createMiniModeController(deps) {
  const { closeImmersive, formatTime, getAudioEl, getCurrentLyricsSnapshot, getPlayIndex, getPlayQueue, getSeekDragging, readCurrentLyricsSnapshot, setSeekDragging } = deps;
  const windowMode = createMiniModeWindowController();
  const timing = createLyricTimingSmoother();
  let activeLineIndex = -1, closeTimer = 0, currentMetaKey = "", manualScrollUntil = 0, open = false, renderedKey = "", syncTimer = 0;
  let activeLineProgress = -1;
  let lyricLineElements = [];
  let lyricsSnapshot = null, snapshotKey = "", snapshotLoadingKey = "", snapshotPromise = null;

  function currentTrack() { return getPlayQueue()[getPlayIndex()] || null; }
  function panelEl() { return document.getElementById("mini-player"); }
  function lyricsEl() { return document.getElementById("mini-lyrics"); }
  function pauseAutoScroll(ms = 2200) { manualScrollUntil = Date.now() + ms; }
  function setMiniToggleUi() { document.getElementById("btn-dock-mini")?.classList.toggle("is-on", open); }

  function buildMiniLyricLineHtml(entry, index) {
    const text = escapeHtml(entry?.text || "\u00a0");
    return `<p class="mini-player__lyrics-line" data-lyric-index="${index}"><span class="mini-player__line-base">${text}</span><span class="mini-player__line-fill">${text}</span></p>`;
  }

  function applySnapshot(snapshot) {
    lyricsSnapshot = snapshot || null;
    snapshotKey = currentPlayableKey(snapshot?.currentTrack) || "";
  }

  function refreshSnapshot() {
    const snapshot = readCurrentLyricsSnapshot?.() || null;
    if (!snapshot) return;
    applySnapshot(snapshot);
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
        if ((currentPlayableKey(snapshot?.currentTrack) || "") === trackKey) {
          applySnapshot(snapshot);
          renderedKey = "";
        }
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

  async function setOpen(nextOpen) {
    const panel = panelEl();
    if (!panel || open === !!nextOpen) return;
    window.clearTimeout(closeTimer);
    open = !!nextOpen;
    setMiniToggleUi();
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) {
      closeImmersive?.();
      document.body.classList.add("mini-mode");
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add("is-visible"));
      await windowMode.enterMiniWindow();
      syncAll(true);
      scheduleLoop();
      return;
    }
    panel.classList.remove("is-visible");
    document.body.classList.remove("mini-mode");
    scheduleLoop();
    await windowMode.exitMiniWindow();
    closeTimer = window.setTimeout(() => { if (!open) panel.hidden = true; }, 180);
  }

  function close() { return setOpen(false); }
  function toggle() { return setOpen(!open); }

  function syncMeta() {
    const track = currentTrack();
    const key = currentPlayableKey(track);
    const titleEl = document.getElementById("mini-title");
    const subEl = document.getElementById("mini-sub");
    const coverEl = document.getElementById("mini-cover");
    if (titleEl) titleEl.textContent = track?.title || "未播放";
    if (subEl) subEl.textContent = track?.artist || (track ? "未知艺术家" : "选择曲目后可进入歌词 Mini 模式");
    if (coverEl) setCoverImageSource(coverEl, track?.cover_url || "", { size: 64, radius: 14 });
    if (key !== currentMetaKey) {
      currentMetaKey = key;
      renderedKey = "";
      activeLineIndex = -1;
      void ensureSnapshot(key);
    } else {
      refreshSnapshot();
    }
  }

  function syncTransport() {
    const audio = getAudioEl();
    const hasQueue = getPlayQueue().length > 0;
    setPlayButtonIcon(document.getElementById("btn-mini-play"), !!audio && !audio.paused);
    ["btn-mini-play", "btn-mini-prev", "btn-mini-next"].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = !hasQueue;
    });
  }

  function syncSeekUi() {
    const audio = getAudioEl();
    const seek = document.getElementById("mini-seek");
    const currentEl = document.getElementById("mini-time-current");
    const totalEl = document.getElementById("mini-time-total");
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

  function renderLyrics(force = false) {
    const box = lyricsEl();
    const track = currentTrack();
    const entries = Array.isArray(lyricsSnapshot?.lrcEntries) ? lyricsSnapshot.lrcEntries : [];
    const payload = lyricsSnapshot?.payload || null;
    if (!box) return;
    if (!track) {
      if (force || renderedKey !== "idle") {
        renderedKey = "idle";
        activeLineIndex = -1;
        activeLineProgress = -1;
        lyricLineElements = [];
        timing.resetProgress();
        box.innerHTML = '<p class="mini-player__lyrics-empty">播放任意歌曲后，这里会展示同步歌词。</p>';
      }
      return;
    }
    if (!entries.length || !payload) {
      const waiting = snapshotLoadingKey === currentMetaKey || snapshotKey !== currentMetaKey;
      const nextKey = waiting ? "loading" : "fallback";
      if (force || renderedKey !== nextKey) {
        renderedKey = nextKey;
        activeLineIndex = -1;
        activeLineProgress = -1;
        timing.resetProgress();
        box.innerHTML = waiting
          ? '<p class="mini-player__lyrics-empty">歌词加载中...</p>'
          : [buildMiniLyricLineHtml({ text: track.title || "当前歌曲" }, 0), buildMiniLyricLineHtml({ text: track.artist || "暂无滚动歌词" }, 1)].join("");
        lyricLineElements = captureLyricLineElements(box, ".mini-player__lyrics-line");
        if (!waiting) box.querySelector('.mini-player__lyrics-line[data-lyric-index="0"]')?.classList.add("is-active");
      }
      return;
    }
    const viewKey = `${currentMetaKey}|${entries.length}`;
    if (force || renderedKey !== viewKey) {
      renderedKey = viewKey;
      box.innerHTML = entries.map((entry, index) => buildMiniLyricLineHtml(entry, index)).join("");
      lyricLineElements = captureLyricLineElements(box, ".mini-player__lyrics-line");
      activeLineIndex = -1;
      activeLineProgress = -1;
      timing.resetProgress();
    }
    updateLyricStates(box, entries, payload);
  }

  function updateLyricStates(box, entries, payload) {
    const index = Number.isInteger(payload?.activeIndex) ? payload.activeIndex : -1;
    const token = [currentMetaKey, index, payload?.line1, payload?.line2, payload?.line1StartT, payload?.line2StartT].join("|");
    const currentTime = timing.syncedCurrentTime(token, payload);
    const wordLines = Array.isArray(lyricsSnapshot?.wordLines) ? lyricsSnapshot.wordLines : null;
    const rawRatio = lineProgressRatio({ index, activeIndex: index, entries, wordLines, currentTime });
    const activeEntry = entries[index];
    const nextEntry = entries[index + 1];
    const lineKey = `${currentMetaKey}|${index}|${activeEntry?.text || ""}|${activeEntry?.t || 0}|${nextEntry?.t || (activeEntry?.t || 0) + 4}`;
    const ratio = timing.monotonicProgress(lineKey, currentTime, rawRatio);
    if (index !== activeLineIndex) {
      applyLyricLineStates(lyricLineElements, index, ratio);
      activeLineProgress = ratio;
    } else if (Math.abs(ratio - activeLineProgress) > 0.003) {
      applyActiveLyricProgress(lyricLineElements, index, ratio);
      activeLineProgress = ratio;
    }
    if (index !== activeLineIndex) {
      activeLineIndex = index;
      if (Date.now() >= manualScrollUntil) {
        centerActiveLyricLine(box, lyricLineElements, index);
      }
    }
  }

  function syncAll(forceLyrics = false) {
    syncMeta();
    syncTransport();
    syncSeekUi();
    renderLyrics(forceLyrics);
  }

  function tick() {
    if (!open) return;
    if (currentPlayableKey(currentTrack()) !== currentMetaKey) syncMeta();
    refreshSnapshot();
    syncSeekUi();
    renderLyrics();
    syncTimer = requestAnimationFrame(tick);
  }

  function scheduleLoop() {
    if (syncTimer) cancelAnimationFrame(syncTimer);
    syncTimer = open ? requestAnimationFrame(tick) : 0;
  }

  function bindAudioEvents() {
    const observe = () => {
      const audio = getAudioEl();
      if (!audio) return void requestAnimationFrame(observe);
      audio.addEventListener("timeupdate", () => { refreshSnapshot(); if (open) renderLyrics(); });
      audio.addEventListener("play", () => { refreshSnapshot(); if (open) syncAll(); });
      audio.addEventListener("pause", () => { refreshSnapshot(); if (open) syncAll(); });
      audio.addEventListener("loadedmetadata", () => { if (open) syncAll(true); });
      audio.addEventListener("ended", () => { refreshSnapshot(); if (open) syncAll(); });
    };
    observe();
  }

  function wireSeek() {
    const seek = document.getElementById("mini-seek");
    seek?.addEventListener("pointerdown", () => setSeekDragging(true));
    seek?.addEventListener("pointerup", () => { setSeekDragging(false); syncSeekUi(); refreshSnapshot(); renderLyrics(); });
    seek?.addEventListener("input", () => {
      const audio = getAudioEl();
      const duration = audio?.duration;
      if (audio && duration && Number.isFinite(duration) && duration > 0) {
        audio.currentTime = (Number(seek.value) / 1000) * duration;
        syncSeekUi();
        refreshSnapshot();
        renderLyrics();
      }
    });
  }

  function wireLyricsScroll() {
    const lyrics = lyricsEl();
    lyrics?.addEventListener("wheel", (event) => {
      if (lyrics.scrollHeight <= lyrics.clientHeight) return;
      pauseAutoScroll();
      event.preventDefault();
      lyrics.scrollTop += event.deltaY;
    }, { passive: false });
    lyrics?.addEventListener("scroll", () => pauseAutoScroll(1600), { passive: true });
  }

  function wire() {
    document.getElementById("btn-dock-mini")?.addEventListener("click", () => { void toggle(); });
    document.getElementById("btn-mini-exit")?.addEventListener("click", () => { void close(); });
    document.getElementById("btn-mini-prev")?.addEventListener("click", () => document.getElementById("btn-player-prev")?.click());
    document.getElementById("btn-mini-play")?.addEventListener("click", () => document.getElementById("btn-player-play")?.click());
    document.getElementById("btn-mini-next")?.addEventListener("click", () => document.getElementById("btn-player-next")?.click());
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && open) void close(); });
    wireSeek();
    wireLyricsScroll();
    bindAudioEvents();
    syncAll(true);
  }

  return { close, getOpen: () => open, syncAll, toggle, wire };
}
