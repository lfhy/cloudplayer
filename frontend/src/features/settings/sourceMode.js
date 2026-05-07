// Music-source online-mode helpers keep the Kugou-only toggle out of the main settings controller.
export function isMusicSourceOnlineModeSelected() {
  return document.getElementById("setting-music-online-mode")?.value === "1";
}

export function setMusicSourceOnlineModeSelection(enabled) {
  const active = !!enabled;
  const hidden = document.getElementById("setting-music-online-mode");
  const button = document.getElementById("btn-music-online-mode");
  if (hidden) hidden.value = active ? "1" : "0";
  if (button) {
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", active ? "true" : "false");
  }
}

export function setMusicSourceOnlineModeBusy(busy, message = "") {
  const button = document.getElementById("btn-music-online-mode");
  const status = document.getElementById("setting-music-online-mode-status");
  if (button) {
    button.disabled = !!busy;
    button.classList.toggle("is-busy", !!busy);
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
  document.getElementById("btn-music-online-mode")?.addEventListener("click", () => {
    onChange?.(!isMusicSourceOnlineModeSelected());
  });
}

export async function toggleMusicOnlineMode(nextEnabled, deps) {
  const { alertRequestFailed, isSelected, onMusicOnlineModeChanged, persistSettingsFromForm } = deps;
  if (nextEnabled && !window.confirm("开启在线模式后，会切换到酷狗云歌单并立即重新拉取云端歌单。是否继续？")) return;
  const previous = isSelected();
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
