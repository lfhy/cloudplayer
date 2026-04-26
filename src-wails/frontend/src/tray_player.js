import { invoke } from "./wails/tauri-core.js";
import { emitTo, listen } from "./wails/tauri-event.js";

const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const FALLBACK_COVER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='92' height='92' viewBox='0 0 92 92'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23e39b79'/%3E%3Cstop offset='100%25' stop-color='%23c65c45'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='92' height='92' rx='16' fill='url(%23g)'/%3E%3C/svg%3E";

function applyTrayState(payload = {}) {
  const card = document.getElementById("tray-card");
  const cover = document.getElementById("tray-cover");
  const title = document.getElementById("tray-title");
  const sub = document.getElementById("tray-sub");
  const progress = document.getElementById("tray-progress");
  const play = document.getElementById("tray-play");
  const prev = document.getElementById("tray-prev");
  const next = document.getElementById("tray-next");

  const hasTrack = !!payload.hasTrack;
  if (card) card.classList.toggle("tray-empty", !hasTrack);
  if (cover) cover.src = payload.coverUrl || FALLBACK_COVER;
  if (title) title.textContent = payload.title || "CloudPlayer";
  if (sub) sub.textContent = payload.sub || "从菜单栏快速控制当前播放";
  if (progress) progress.style.width = `${Math.max(0, Math.min(100, Number(payload.progressPct) || 0))}%`;
  if (play) {
    play.textContent = payload.playing ? "⏸" : "▶";
    play.title = payload.playing ? "暂停" : "播放";
    play.setAttribute("aria-label", payload.playing ? "暂停" : "播放");
    play.disabled = !hasTrack;
  }
  if (prev) prev.disabled = payload.hasPrev === false;
  if (next) next.disabled = payload.hasNext === false;
}

async function requestTraySync(reason = "init") {
  try {
    await emitTo(MAIN_WW, "tray-player-request-sync", { reason });
  } catch (error) {
    console.warn("tray-player-request-sync", error);
  }
}

async function sendTrayCommand(action) {
  try {
    await emitTo(MAIN_WW, "tray-player-command", { action });
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
