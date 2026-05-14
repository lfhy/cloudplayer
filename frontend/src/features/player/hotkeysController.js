// Player hotkey helpers keep keyboard-triggered actions away from the runtime bootstrap.
export function createPlayerHotkeyController(deps) {
  const { getAudioEl, invoke, listen, shouldIgnoreGlobalHotkeyAction, togglePlayPauseWithTransition, warnRequestFailed } = deps;
  let volumeController = deps.volume || null;

  async function togglePlayPauseFromHotkey() {
    const audio = getAudioEl();
    if (!audio || !audio.src) return;
    try {
      await togglePlayPauseWithTransition?.();
    } catch (error) {
      warnRequestFailed(error, "togglePlayPauseFromHotkey");
    }
  }

  async function adjustPlayerVolumeDelta(delta) {
    const volume = document.getElementById("volume");
    if (!volume) return;
    const next = Math.min(1, Math.max(0, Number(volume.value) / 100 + delta));
    volumeController?.applyVolume(next, { persist: true, muted: next <= 0.001 });
  }

  function wireGlobalHotkeyListener() {
    void listen("global-hotkey", (event) => {
      if (shouldIgnoreGlobalHotkeyAction()) return;
      const action = event?.payload;
      if (action === "play_pause") void togglePlayPauseFromHotkey();
      else if (action === "prev") document.getElementById("btn-player-prev")?.click();
      else if (action === "next") document.getElementById("btn-player-next")?.click();
      else if (action === "volume_up") void adjustPlayerVolumeDelta(0.05);
      else if (action === "volume_down") void adjustPlayerVolumeDelta(-0.05);
    });
  }

  function wireVolume() {
    volumeController?.wireVolume?.();
  }

  function setVolumeController(controller) {
    volumeController = controller || null;
  }

  return { setVolumeController, wireGlobalHotkeyListener, wireVolume };
}
