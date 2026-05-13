import { setCoverImageSource } from "../../app/helpers/covers.js";
import { applyAppTheme, applyPlatformClassNames, systemDarkMedia } from "../../app/helpers/platformTheme.js";
import { escapeHtml } from "../../app/helpers/text.js";
import { miniPlayerTemplate } from "../../components/miniPlayerTemplate.js";
import { miniPauseIcon, miniPlayIcon } from "../../components/miniPlayerIcons.js";
import { lineProgressRatio } from "../../features/player/immersiveLyricsView.js";
import { emitTo, listen } from "../../wails/tauri-event.js";

const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const PLAY_ICON = miniPlayIcon();
const PAUSE_ICON = miniPauseIcon();

// Mini-player child window renders floating playback state pushed from the hidden main window.
export function bootstrapMiniPlayerWindow() {
  let activeLineIndex = -1;

  function panelEl() { return document.getElementById("mini-player"); }
  function lyricsEl() { return document.getElementById("mini-lyrics"); }

  function renderWindow() {
    const root = document.getElementById("app");
    if (!root) throw new Error("mini player root not found");
    root.innerHTML = miniPlayerTemplate();
    document.documentElement.classList.add("mini-mode");
    document.body.classList.add("mini-mode");
    panelEl()?.removeAttribute("hidden");
    panelEl()?.setAttribute("aria-hidden", "false");
    panelEl()?.classList.add("is-visible");
  }

  function setPlayButton(playing) {
    const button = document.getElementById("btn-mini-play");
    if (!button) return;
    button.dataset.playIcon = playing ? "pause" : "play";
    button.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    button.title = playing ? "暂停" : "播放";
    button.setAttribute("aria-label", playing ? "暂停" : "播放");
  }

  function setSeekProgress(input, value) {
    if (!input) return;
    input.value = String(Math.max(0, Math.min(1000, Number(value) || 0)));
    input.style.setProperty("--seek-progress", `${Number(input.value) / 10}%`);
  }

  function applyTheme(payload = {}) {
    applyAppTheme(payload.theme || "coral", payload.customAccent || "#c62f2f", payload.themeMode || "system");
  }

  function renderLyrics(payload = {}) {
    const box = lyricsEl();
    if (!box) return;
    if (!payload.hasTrack) {
      box.innerHTML = '<p class="mini-player__lyrics-empty">播放任意歌曲后，这里会展示同步歌词。</p>';
      activeLineIndex = -1;
      return;
    }
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const wordLines = Array.isArray(payload.wordLines) ? payload.wordLines : [];
    const lyricPayload = payload.lyricPayload || null;
    if (!entries.length || !lyricPayload) {
      box.innerHTML = [
        lyricLineHtml(payload.title || "当前歌曲", 0, "is-active", 1),
        lyricLineHtml(payload.sub || "暂无滚动歌词", 1, "is-future", 0),
      ].join("");
      activeLineIndex = 0;
      return;
    }
    const activeIndex = Number.isInteger(lyricPayload.activeIndex) ? lyricPayload.activeIndex : -1;
    const currentTime = Number(lyricPayload.audioNow) || 0;
    const ratio = lineProgressRatio({ index: activeIndex, activeIndex, entries, wordLines, currentTime });
    box.innerHTML = entries
      .map((entry, index) => lyricLineHtml(entry?.text || "\u00a0", index, lineClassName(index, activeIndex), index === activeIndex ? ratio : index < activeIndex ? 1 : 0))
      .join("");
    if (activeIndex !== activeLineIndex) {
      activeLineIndex = activeIndex;
      box.querySelector(`.mini-player__lyrics-line[data-lyric-index="${activeIndex}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function lineClassName(index, activeIndex) {
    if (index === activeIndex) return "is-active";
    return index < activeIndex ? "is-past" : "is-future";
  }

  function lyricLineHtml(text, index, stateClass, progressRatio) {
    const progress = Math.round(Math.max(0, Math.min(1, progressRatio)) * 1000) / 10;
    const safe = escapeHtml(text || "\u00a0");
    return `<p class="mini-player__lyrics-line ${stateClass}" data-lyric-index="${index}" style="--line-progress:${progress}%"><span class="mini-player__line-base">${safe}</span><span class="mini-player__line-fill">${safe}</span></p>`;
  }

  function applyState(payload = {}) {
    applyTheme(payload);
    panelEl()?.classList.toggle("mini-player--lyrics-hidden", payload.lyricsVisible === false);
    setCoverImageSource(document.getElementById("mini-cover"), payload.coverUrl || "", { size: 64, radius: 14 });
    const title = document.getElementById("mini-title");
    const sub = document.getElementById("mini-sub");
    if (title) title.textContent = payload.title || "未播放";
    if (sub) sub.textContent = payload.sub || "选择曲目后可进入歌词 Mini 模式";
    setPlayButton(!!payload.playing);
    ["btn-mini-play", "btn-mini-prev", "btn-mini-next"].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = !payload.hasTrack;
    });
    syncToggleButton(document.getElementById("btn-mini-desktop-lyrics"), !!payload.desktopLyricsOpen, "关闭桌面歌词", "打开桌面歌词");
    syncToggleButton(document.getElementById("btn-mini-lyrics-visibility"), payload.lyricsVisible !== false, "隐藏 Mini 歌词", "显示 Mini 歌词");
    syncToggleButton(document.getElementById("btn-mini-pin"), !!payload.alwaysOnTop, "取消 Mini 置顶", "开启 Mini 置顶");
    const seek = document.getElementById("mini-seek");
    if (seek instanceof HTMLInputElement) {
      seek.disabled = !payload.hasTrack;
      setSeekProgress(seek, payload.progressValue);
    }
    const current = document.getElementById("mini-time-current");
    const total = document.getElementById("mini-time-total");
    if (current) current.textContent = payload.currentText || "0:00";
    if (total) total.textContent = payload.totalText || "0:00";
    if (payload.lyricsVisible === false) {
      lyricsEl()?.setAttribute("hidden", "hidden");
    } else {
      lyricsEl()?.removeAttribute("hidden");
      renderLyrics(payload);
    }
  }

  function syncToggleButton(button, active, activeLabel, idleLabel) {
    if (!button) return;
    const label = active ? activeLabel : idleLabel;
    button.classList.toggle("is-on", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
  }

  async function requestSync(reason = "focus") {
    try {
      await emitTo(MAIN_WW, "mini-player-request-sync", { reason });
    } catch (error) {
      console.warn("mini-player-request-sync", error);
    }
  }

  async function sendCommand(action, extra = {}) {
    try {
      await emitTo(MAIN_WW, "mini-player-command", { action, ...extra });
    } catch (error) {
      console.warn("mini-player-command", error);
    }
  }

  function wireControls() {
    document.getElementById("btn-mini-prev")?.addEventListener("click", () => { void sendCommand("prev"); });
    document.getElementById("btn-mini-play")?.addEventListener("click", () => { void sendCommand("toggle"); });
    document.getElementById("btn-mini-next")?.addEventListener("click", () => { void sendCommand("next"); });
    document.getElementById("btn-mini-desktop-lyrics")?.addEventListener("click", () => { void sendCommand("toggle-desktop-lyrics"); });
    document.getElementById("btn-mini-lyrics-visibility")?.addEventListener("click", () => { void sendCommand("toggle-mini-lyrics"); });
    document.getElementById("btn-mini-pin")?.addEventListener("click", () => { void sendCommand("toggle-pin"); });
    document.getElementById("btn-mini-exit")?.addEventListener("click", () => { void sendCommand("exit"); });
    document.getElementById("mini-cover")?.addEventListener("dblclick", () => { void sendCommand("open-main"); });
    document.getElementById("mini-title")?.addEventListener("dblclick", () => { void sendCommand("open-main"); });
    document.getElementById("mini-seek")?.addEventListener("input", (event) => {
      const input = event.currentTarget;
      if (!(input instanceof HTMLInputElement)) return;
      setSeekProgress(input, input.value);
      void sendCommand("seek", { value: Number(input.value) || 0 });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") void sendCommand("exit");
    });
  }

  function wireThemeRefresh() {
    window.addEventListener("focus", () => { void requestSync("focus"); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) void requestSync("visibility"); });
    if (systemDarkMedia && typeof systemDarkMedia.addEventListener === "function") {
      systemDarkMedia.addEventListener("change", () => { void requestSync("system-theme"); });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyPlatformClassNames();
    renderWindow();
    wireControls();
    wireThemeRefresh();
    void listen("mini-player-state", (event) => applyState(event?.payload || {}));
    applyState({});
    void requestSync("init");
  });
}
