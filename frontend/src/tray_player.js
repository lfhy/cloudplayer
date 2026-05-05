import { setCoverImageSource } from "./app/helpers/covers.js";
import { iconSvgByName } from "./app/helpers/icons.js";
import { invoke } from "./wails/tauri-core.js";
import { emitTo, listen } from "./wails/tauri-event.js";

const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const PREV_ICON = iconSvgByName("skip-previous-bold");
const NEXT_ICON = iconSvgByName("skip-next-bold");
const PLAY_ICON = iconSvgByName("play-bold");
const PAUSE_ICON = iconSvgByName("pause-bold");

function applyTrayTheme(payload = {}) {
  const root = document.documentElement;
  const accent = String(payload.accent || "").trim() || "#c62f2f";
  const accentRgb = String(payload.accentRgb || "").trim() || "198, 47, 47";
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-rgb", accentRgb);
}

function setTrayPlayButtonIcon(button, playing) {
  if (!button) return;
  button.dataset.playIcon = playing ? "pause" : "play";
  button.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
  button.title = playing ? "暂停" : "播放";
  button.setAttribute("aria-label", playing ? "暂停" : "播放");
}

function applySeekProgress(seek) {
  if (!seek) return;
  seek.style.setProperty("--seek-progress", `${Number(seek.value || 0) / 10}%`);
}

function applyTrayState(payload = {}) {
  applyTrayTheme(payload);
  const card = document.getElementById("tray-card");
  const cover = document.getElementById("tray-cover");
  const title = document.getElementById("tray-title");
  const sub = document.getElementById("tray-sub");
  const seek = document.getElementById("tray-seek");
  const play = document.getElementById("tray-play");
  const prev = document.getElementById("tray-prev");
  const next = document.getElementById("tray-next");

  const hasTrack = !!payload.hasTrack;
  if (card) card.classList.toggle("tray-empty", !hasTrack);
  setCoverImageSource(cover, payload.coverUrl, { size: 92, radius: 16 });
  if (title) title.textContent = payload.title || "CloudPlayer";
  if (sub) sub.textContent = payload.sub || "从菜单栏快速控制当前播放";
  if (seek) {
    seek.disabled = !hasTrack;
    seek.value = String(Math.max(0, Math.min(1000, Number(payload.progressValue) || 0)));
    applySeekProgress(seek);
  }
  setTrayPlayButtonIcon(play, !!payload.playing);
  if (play) play.disabled = !hasTrack;
  if (prev) {
    prev.innerHTML = PREV_ICON;
    prev.disabled = payload.hasPrev === false;
  }
  if (next) {
    next.innerHTML = NEXT_ICON;
    next.disabled = payload.hasNext === false;
  }
}

async function requestTraySync(reason = "init") {
  try {
    await emitTo(MAIN_WW, "tray-player-request-sync", { reason });
  } catch (error) {
    console.warn("tray-player-request-sync", error);
  }
}

async function sendTrayCommand(action, extra = {}) {
  try {
    await emitTo(MAIN_WW, "tray-player-command", { action, ...extra });
  } catch (error) {
    console.warn("tray-player-command", error);
  }
}

async function openMainWindow() {
  try {
    await invoke("show_main_window");
  } catch (error) {
    console.warn("show_main_window", error);
  }
}

document.getElementById("tray-prev")?.addEventListener("click", () => {
  void sendTrayCommand("prev");
});
document.getElementById("tray-play")?.addEventListener("click", () => {
  void sendTrayCommand("toggle");
});
document.getElementById("tray-next")?.addEventListener("click", () => {
  void sendTrayCommand("next");
});
document.getElementById("tray-open")?.addEventListener("click", () => {
  void openMainWindow();
});
document.getElementById("tray-cover")?.addEventListener("click", () => {
  void openMainWindow();
});
document.getElementById("tray-title")?.addEventListener("click", () => {
  void openMainWindow();
});
document.getElementById("tray-seek")?.addEventListener("input", (event) => {
  const seek = event.currentTarget;
  if (!(seek instanceof HTMLInputElement)) return;
  applySeekProgress(seek);
  void sendTrayCommand("seek", { value: Number(seek.value) || 0 });
});

void listen("tray-player-state", (event) => {
  applyTrayState(event?.payload ?? {});
});

window.addEventListener("focus", () => {
  void requestTraySync("focus");
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void requestTraySync("visibility");
});

applyTrayState({});
void requestTraySync();
