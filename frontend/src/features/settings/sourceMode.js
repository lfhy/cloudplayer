import { Events } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { isWindowsDesktop, normalizeMusicCollectionMode } from "../../app/helpers/platformTheme.js";
import { showNativeQuestionDialog } from "../window/platformDialogs.js";
import { unwrapPayload } from "../../wails/shared.js";

const ONLINE_MODE_CONFIRM_LABEL = "online-mode-confirm";
const ONLINE_MODE_CONFIRM_URL = "/online_mode_confirm.html";

// Collection-mode helpers keep mode selection and the online confirmation flow out of the main settings controller.
export function getMusicCollectionModeSelection() {
  return normalizeMusicCollectionMode(document.getElementById("setting-music-collection-mode")?.value);
}

export function setMusicCollectionModeSelection(mode) {
  const normalized = normalizeMusicCollectionMode(mode);
  const hidden = document.getElementById("setting-music-collection-mode");
  if (hidden) hidden.value = normalized;
  document.querySelectorAll("[data-music-collection-mode-card]").forEach((card) => {
    const active = card.getAttribute("data-music-collection-mode-card") === normalized;
    card.classList.toggle("is-active", active);
    card.setAttribute("aria-checked", active ? "true" : "false");
  });
}

export function setMusicCollectionModeBusy(busy, message = "") {
  const status = document.getElementById("setting-music-collection-mode-status");
  document.querySelectorAll("[data-music-collection-mode-card]").forEach((card) => {
    card.toggleAttribute("disabled", !!busy);
    card.classList.toggle("is-busy", !!busy);
  });
  if (status && message) status.textContent = message;
}

export function musicCollectionModeStatusText(mode) {
  switch (normalizeMusicCollectionMode(mode)) {
    case "online":
      return "在线模式已开启：歌单、歌单内容和收藏直接来自酷狗云端缓存。";
    case "hybrid":
      return "混合模式已开启：云歌单会 fork 到本地，能回写的操作优先回写云端，失败时保留本地。";
    default:
      return "离线模式使用本地歌单与我喜欢；刷新不会拉取云端歌单。";
  }
}

export function setMusicCollectionModeAvailability(available) {
  const wrap = document.getElementById("setting-music-collection-mode-wrap");
  if (wrap) wrap.hidden = !available;
}

export function wireMusicCollectionModeSelection(onChange) {
  document.querySelectorAll("[data-music-collection-mode-card]").forEach((card) => {
    card.addEventListener("click", () => {
      if (card.hasAttribute("disabled")) return;
      const nextMode = normalizeMusicCollectionMode(card.getAttribute("data-music-collection-mode-card"));
      if (nextMode === getMusicCollectionModeSelection()) return;
      onChange?.(nextMode);
    });
  });
}

async function confirmEnableMusicOnlineMode() {
  if (isWindowsDesktop()) {
    try {
      const result = await showNativeQuestionDialog({
        title: "开启在线模式？",
        heading: "开启在线模式？",
        message: "会切换到酷狗云歌单，并立即重新拉取云端歌单。",
      });
      return result.accepted === true;
    } catch (error) {
      console.warn("open native online mode confirm dialog", error);
      return false;
    }
  }
  return new Promise((resolve) => {
    Events.Once("settings-online-mode-confirm-result", (event) => {
      resolve(unwrapPayload(event?.data)?.accepted === true);
    });
    void DesktopService.EnsureWindow({
      label: ONLINE_MODE_CONFIRM_LABEL,
      url: ONLINE_MODE_CONFIRM_URL,
      title: "开启在线模式",
      width: 432,
      height: 188,
      center_on_main: true,
      resizable: false,
      always_on_top: true,
      decorations: true,
      transparent: false,
      shadow: true,
      skip_taskbar: true,
      focus: true,
      mac_title_bar_style: "hiddenInset",
      invisible_title_bar_height: 44,
    }).catch((error) => {
      console.warn("open online mode confirm window", error);
      resolve(false);
    });
  });
}

export async function toggleMusicCollectionMode(nextMode, deps) {
  const { alertRequestFailed, confirmBeforeEnable = true, onMusicCollectionModeChanged, persistSettingsFromForm } = deps;
  const normalized = normalizeMusicCollectionMode(nextMode);
  const previous = getMusicCollectionModeSelection();
  if (normalized === "online" && previous !== "online" && confirmBeforeEnable) {
    const accepted = await confirmEnableMusicOnlineMode();
    if (!accepted) {
      setMusicCollectionModeSelection(previous);
      return;
    }
  }
  setMusicCollectionModeSelection(normalized);
  const busyText = normalized === "offline"
    ? "正在切回离线歌单…"
    : normalized === "hybrid"
      ? "正在切换到混合模式并同步云歌单…"
      : "正在开启在线模式并同步云歌单…";
  setMusicCollectionModeBusy(true, busyText);
  try {
    await persistSettingsFromForm();
    await onMusicCollectionModeChanged?.(normalized);
    setMusicCollectionModeBusy(false, musicCollectionModeStatusText(normalized));
  } catch (error) {
    setMusicCollectionModeSelection(previous);
    setMusicCollectionModeBusy(false, "歌单模式切换失败，请稍后重试。");
    alertRequestFailed(error, "toggle music collection mode");
  }
}

export function createKugouSettingsStatusRefresher(deps) {
  const { actionButtons, getMusicCollectionModeSelection, queueSettingsAutosave, setMusicCollectionModeAvailability, setMusicCollectionModeSelection } = deps;
  return async () => {
    const status = await actionButtons?.refreshKugouSettingsStatus?.();
    const available = !!status?.logged_in;
    setMusicCollectionModeAvailability(available);
    if (!available && getMusicCollectionModeSelection() !== "offline") {
      setMusicCollectionModeSelection("offline");
      queueSettingsAutosave(true);
    }
    return status;
  };
}
