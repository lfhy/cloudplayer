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

export function setMusicSourceOnlineModeAvailability(available) {
  const wrap = document.getElementById("setting-music-online-mode-wrap");
  if (wrap) wrap.hidden = !available;
}

export function wireMusicSourceOnlineModeSelection(onChange) {
  document.getElementById("btn-music-online-mode")?.addEventListener("click", () => {
    setMusicSourceOnlineModeSelection(!isMusicSourceOnlineModeSelected());
    onChange?.();
  });
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
