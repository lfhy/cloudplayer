import { setCoverImageSource } from "../../app/helpers/covers.js";
import { escapeHtml } from "../../app/helpers/text.js";
import { lyricDisplayForDesktop, parseLrc, currentPlayableKey } from "../lyrics/model.js";
import { setPlayButtonIcon } from "./playButtonIcon.js";

// Immersive controller keeps the in-app lyrics overlay synced with playback state.
export function createImmersiveController(deps) {
  const { formatTime, getAudioEl, getPlayIndex, getPlayQueue, getSeekDragging, invoke, setSeekDragging } = deps;
  let open = false, lrcEntries = [], wordLines = null, lrcCacheKey = null, lrcLoadInFlight = null;
  let currentMetaKey = "", syncTimer = 0;

  function currentTrack() { return getPlayQueue()[getPlayIndex()] || null; }

  function lrcEntriesFromWordLines(lines) {
    if (!Array.isArray(lines) || !lines.length) return [];
    return lines.map((l) => {
      const t = Number(l?.startMs);
      const text = (Array.isArray(l?.words) ? l.words : []).map((w) => String(w?.text ?? "")).join("").trim();
      return Number.isFinite(t) && t >= 0 && text ? { t: t / 1000, text } : null;
    }).filter(Boolean).sort((a, b) => a.t - b.t);
  }

  async function fetchLyricsForCurrent() {
    const track = currentTrack();
    const key = currentPlayableKey(track);
    if (!key || lrcCacheKey === key) return;
    if (lrcLoadInFlight?.key === key) { await lrcLoadInFlight.promise; return; }
    lrcEntries = []; wordLines = null;
    const p = doFetchLyrics(track, key).finally(() => { if (lrcLoadInFlight?.promise === p) lrcLoadInFlight = null; });
    lrcLoadInFlight = { key, promise: p };
    await p;
  }

  async function doFetchLyrics(track, cacheKey) {
    if (!track) { lrcCacheKey = null; return; }
    try {
      const audio = getAudioEl();
      const dur = audio?.duration && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
      const raw = await invoke("fetch_song_lrc_enriched", {
        req: {
          pjmp3SourceId: track.local_path ? null : (track.source_id || "").trim() || null,
          title: track.title || "", artist: track.artist || "", album: track.album || "",
          localPath: track.local_path || null, durationSeconds: dur,
        },
      });
      if (currentPlayableKey(currentTrack()) !== cacheKey) return;
      if (raw && typeof raw === "object") {
        const wl = Array.isArray(raw.wordLines) ? raw.wordLines : null;
        const parsed = raw.lrcText ? parseLrc(String(raw.lrcText)) : [];
        lrcEntries = parsed.length ? parsed : lrcEntriesFromWordLines(wl);
        wordLines = wl;
      } else if (typeof raw === "string") { lrcEntries = parseLrc(raw); wordLines = null; }
      lrcCacheKey = cacheKey;
    } catch { lrcCacheKey = cacheKey; lrcEntries = []; wordLines = null; }
    if (open) renderLyrics();
  }

  function setOpen(next) {
    open = !!next;
    const panel = document.getElementById("immersive-player");
    if (!panel) return;
    panel.hidden = !open;
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("immersive-player-open", open);
    if (open) syncAll();
    scheduleLoop();
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
    if (key !== currentMetaKey) { currentMetaKey = key; void fetchLyricsForCurrent(); }
  }

  function syncTransport() {
    const audio = getAudioEl();
    const has = getPlayQueue().length > 0;
    setPlayButtonIcon(document.getElementById("btn-immersive-play"), !!audio && !audio.paused);
    ["btn-immersive-play", "btn-immersive-prev", "btn-immersive-next"].forEach((id) => {
      const el = document.getElementById(id); if (el) el.disabled = !has;
    });
  }

  function syncSeekUi() {
    const audio = getAudioEl();
    const seek = document.getElementById("immersive-seek");
    const cur = document.getElementById("immersive-time-current");
    const tot = document.getElementById("immersive-time-total");
    if (!seek || !cur || !tot) return;
    const duration = audio?.duration;
    cur.textContent = formatTime(audio?.currentTime || 0);
    if (duration && Number.isFinite(duration) && duration > 0) {
      tot.textContent = formatTime(duration);
      if (!getSeekDragging()) seek.value = String(Math.min(1000, Math.floor(((audio?.currentTime || 0) / duration) * 1000)));
      seek.disabled = false;
      seek.style.setProperty("--seek-progress", `${Number(seek.value) / 10}%`);
      return;
    }
    tot.textContent = "0:00"; seek.value = "0"; seek.disabled = !(audio && audio.src);
    seek.style.setProperty("--seek-progress", "0%");
  }

  function renderLyrics() {
    const box = document.getElementById("immersive-lyrics");
    if (!box) return;
    const track = currentTrack();
    if (!track) { box.innerHTML = '<p class="immersive-player__lyrics-empty">选择歌曲后即可进入沉浸歌词模式</p>'; return; }
    if (!lrcEntries.length) {
      box.innerHTML = `<p class="immersive-player__lyrics-line is-active">${escapeHtml(track.title || "当前歌曲")}</p><p class="immersive-player__lyrics-line">${escapeHtml(track.artist || "暂无滚动歌词")}</p>`;
      return;
    }
    const now = getAudioEl()?.currentTime || 0;
    const payload = lyricDisplayForDesktop({ currentTrack: track, currentTime: now, lrcEntries, wordLines, idleLine1: "CloudPlayer", idleLine2: "让音乐陪你此刻" });
    const activeText = payload.activeSlot === 2 ? payload.line2 : payload.line1;
    const activeT = payload.activeSlot === 2 ? payload.line2StartT : payload.line1StartT;
    const idx = lrcEntries.findIndex((e) => e.text === activeText && Math.abs(e.t - activeT) < 0.25);
    const s = Math.max(0, idx - 5), end = Math.min(lrcEntries.length, idx >= 0 ? idx + 7 : 10);
    box.innerHTML = lrcEntries.slice(s, end).map((e, i) =>
      `<p class="immersive-player__lyrics-line${s + i === idx ? " is-active" : ""}">${escapeHtml(e.text || "\u00a0")}</p>`
    ).join("");
    box.querySelector(".immersive-player__lyrics-line.is-active")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function tick() { if (!open) return; syncSeekUi(); renderLyrics(); syncTimer = requestAnimationFrame(tick); }
  function scheduleLoop() { if (syncTimer) { cancelAnimationFrame(syncTimer); syncTimer = 0; } if (open) syncTimer = requestAnimationFrame(tick); }
  function syncAll() { if (!open) return; syncMeta(); syncTransport(); syncSeekUi(); renderLyrics(); }

  function applyLyricsPayload(raw) {
    const wl = Array.isArray(raw?.wordLines) ? raw.wordLines : null;
    const parsed = String(raw?.lrcText || "").trim() ? parseLrc(raw.lrcText) : [];
    lrcEntries = parsed.length ? parsed : lrcEntriesFromWordLines(wl);
    wordLines = wl; lrcCacheKey = currentPlayableKey(currentTrack()) || null;
    if (open) renderLyrics();
  }

  function clearLyrics() { lrcEntries = []; wordLines = null; lrcCacheKey = null; if (open) renderLyrics(); }

  function wire() {
    document.getElementById("btn-dock-immersive")?.addEventListener("click", toggle);
    document.getElementById("btn-immersive-close")?.addEventListener("click", close);
    document.getElementById("immersive-player")?.querySelector(".immersive-player__backdrop")?.addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) close(); });
    document.getElementById("btn-immersive-play")?.addEventListener("click", () => document.getElementById("btn-player-play")?.click());
    document.getElementById("btn-immersive-prev")?.addEventListener("click", () => document.getElementById("btn-player-prev")?.click());
    document.getElementById("btn-immersive-next")?.addEventListener("click", () => document.getElementById("btn-player-next")?.click());
    const seek = document.getElementById("immersive-seek");
    seek?.addEventListener("pointerdown", () => setSeekDragging(true));
    seek?.addEventListener("pointerup", () => { setSeekDragging(false); syncSeekUi(); renderLyrics(); });
    seek?.addEventListener("input", () => {
      const audio = getAudioEl(), dur = audio?.duration;
      if (audio && dur && Number.isFinite(dur) && dur > 0) { audio.currentTime = (Number(seek.value) / 1000) * dur; syncSeekUi(); renderLyrics(); }
    });
    // Observe audio element for play/pause/ended
    const observe = () => {
      const audio = getAudioEl();
      if (!audio) { requestAnimationFrame(observe); return; }
      audio.addEventListener("play", () => { if (open) { syncTransport(); scheduleLoop(); } });
      audio.addEventListener("pause", () => { if (open) { syncTransport(); scheduleLoop(); } });
      audio.addEventListener("ended", () => { if (open) syncTransport(); });
      audio.addEventListener("loadedmetadata", () => { if (open) syncAll(); });
    };
    observe();
  }

  return { applyLyricsPayload, clearLyrics, close, getOpen: () => open, syncAll, syncMeta, syncSeekUi, syncTransport, toggle, wire };
}
