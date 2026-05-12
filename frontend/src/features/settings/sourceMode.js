import { Events, Window as RuntimeWindow } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { unwrapPayload } from "../../wails/shared.js";

const ONLINE_MODE_CONFIRM_LABEL = "online-mode-confirm";
const ONLINE_MODE_CONFIRM_URL = "/online_mode_confirm.html";

// Music-source online-mode helpers keep the Kugou-only toggle out of the main settings controller.
export function isMusicSourceOnlineModeSelected() {
  const toggle = document.getElementById("setting-music-online-mode-toggle");
  if (toggle) return toggle.checked === true;
  return document.getElementById("setting-music-online-mode")?.value === "1";
}

export function setMusicSourceOnlineModeSelection(enabled) {
  const active = !!enabled;
  const hidden = document.getElementById("setting-music-online-mode");
  const toggle = document.getElementById("setting-music-online-mode-toggle");
  const control = document.getElementById("setting-music-online-mode-switch");
  if (hidden) hidden.value = active ? "1" : "0";
  if (toggle) toggle.checked = active;
  if (control) control.setAttribute("aria-checked", active ? "true" : "false");
}

export function setMusicSourceOnlineModeBusy(busy, message = "") {
  const toggle = document.getElementById("setting-music-online-mode-toggle");
  const control = document.getElementById("setting-music-online-mode-switch");
  const status = document.getElementById("setting-music-online-mode-status");
  if (toggle) {
    toggle.disabled = !!busy;
  }
  if (control) {
    control.classList.toggle("is-busy", !!busy);
    control.setAttribute("aria-disabled", busy ? "true" : "false");
  }
  if (status && message) status.textContent = message;
}

export function musicOnlineModeStatusText(enabled) {
  return enabled
    ? "在线模式已开启：歌单、歌曲与音乐源均来自酷狗云端缓存。"
    : "开启后，全部歌单、歌单内歌曲和音乐源都会优先切到酷狗云端，并缓存 12 小时。";
}

export function setMusicSourceOnlineModeAvailability(available) {
  const wrap = document.getElementById("setting-music-online-mode-wrap");
  if (wrap) wrap.hidden = !available;
}

export function wireMusicSourceOnlineModeSelection(onChange) {
  const toggle = document.getElementById("setting-music-online-mode-toggle");
  const control = document.getElementById("setting-music-online-mode-switch");
  if (!toggle || !control) return;
  const trigger = () => {
    if (toggle.disabled) return;
    onChange?.(!isMusicSourceOnlineModeSelected());
  };
  control.addEventListener("click", (event) => {
    event.preventDefault();
    trigger();
  });
  control.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    trigger();
  });
}

async function onlineModeConfirmBounds() {
  const width = 432;
  const height = 188;
  try {
    const mainWindow = RuntimeWindow.Get("main");
    const position = await mainWindow.Position();
    const size = await mainWindow.Size();
    return {
      width,
      height,
      x: position.x + Math.round((size.width - width) / 2),
      y: position.y + Math.max(28, Math.round((size.height - height) / 3)),
    };
  } catch (error) {
    console.warn("online mode confirm bounds", error);
    return { width, height, x: 140, y: 140 };
  }
}

async function confirmEnableMusicOnlineMode() {
  const bounds = await onlineModeConfirmBounds();
  return new Promise((resolve) => {
    Events.Once("settings-online-mode-confirm-result", (event) => {
      resolve(unwrapPayload(event?.data)?.accepted === true);
    });
    void DesktopService.EnsureWindow({
      label: ONLINE_MODE_CONFIRM_LABEL,
      url: ONLINE_MODE_CONFIRM_URL,
      title: "开启在线模式",
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
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

export async function toggleMusicOnlineMode(nextEnabled, deps) {
  const { alertRequestFailed, onMusicOnlineModeChanged, persistSettingsFromForm } = deps;
  const previous = !nextEnabled;
  if (nextEnabled) {
    const accepted = await confirmEnableMusicOnlineMode();
    if (!accepted) {
      setMusicSourceOnlineModeSelection(previous);
      return;
    }
  }
  setMusicSourceOnlineModeSelection(nextEnabled);
  setMusicSourceOnlineModeBusy(true, nextEnabled ? "正在开启在线模式并同步云歌单…" : "正在关闭在线模式…");
  try {
    await persistSettingsFromForm();
    await onMusicOnlineModeChanged?.(nextEnabled);
    setMusicSourceOnlineModeBusy(false, nextEnabled ? musicOnlineModeStatusText(true) : "在线模式已关闭：已恢复本地歌单与当前默认音乐源。");
  } catch (error) {
    setMusicSourceOnlineModeSelection(previous);
    setMusicSourceOnlineModeBusy(false, "在线模式切换失败，请稍后重试。");
    alertRequestFailed(error, "toggle music online mode");
  }
}

export function createKugouSettingsStatusRefresher(deps) {
  const { actionButtons, isMusicSourceOnlineModeSelected, queueSettingsAutosave, setMusicSourceOnlineModeAvailability, setMusicSourceOnlineModeSelection } = deps;
  return async () => {
    const status = await actionButtons?.refreshKugouSettingsStatus?.();
    const available = !!status?.logged_in;
    setMusicSourceOnlineModeAvailability(available);
    if (!available && isMusicSourceOnlineModeSelected()) {
      setMusicSourceOnlineModeSelection(false);
      queueSettingsAutosave(true);
    }
    return status;
  };
}
