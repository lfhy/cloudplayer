// Player hotkey helpers keep keyboard-triggered actions away from the runtime bootstrap.
export function createPlayerHotkeyController(deps) {
  const { getAudioEl, invoke, listen, shouldIgnoreGlobalHotkeyAction, warnRequestFailed } = deps;

  async function togglePlayPauseFromHotkey() {
    const audio = getAudioEl();
    if (!audio || !audio.src) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch (error) {
      warnRequestFailed(error, "togglePlayPauseFromHotkey");
    }
  }

  async function adjustPlayerVolumeDelta(delta) {
    const volume = document.getElementById("volume");
    if (!volume) return;
    const next = Math.min(1, Math.max(0, Number(volume.value) / 100 + delta));
    volume.value = String(Math.round(next * 100));
    const audio = getAudioEl();
    if (audio) audio.volume = next;
    try {
      await invoke("save_settings", { patch: { volume: next } });
    } catch (error) {
      console.warn("save_settings volume (hotkey)", error);
    }
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
    const volume = document.getElementById("volume");
    const persist = async () => {
      try {
        await invoke("save_settings", { patch: { volume: Number(volume.value) / 100 } });
      } catch (error) {
        console.warn("save_settings", error);
      }
    };
    volume.addEventListener("input", () => {
      const audio = getAudioEl();
      if (audio) audio.volume = Number(volume.value) / 100;
    });
    volume.addEventListener("change", persist);
  }

  return { wireGlobalHotkeyListener, wireVolume };
}
