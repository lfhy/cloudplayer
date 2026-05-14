import { iconSvgByName } from "../../app/helpers/icons.js";

const ICONS = {
  loud: iconSvgByName("volume-loud-bold"),
  quiet: iconSvgByName("volume-small-bold"),
  mute: iconSvgByName("volume-cross-bold"),
};

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.7;
  return Math.max(0, Math.min(1, numeric));
}

// Volume controller keeps dock slider visuals and mute button state in sync with the audio element.
export function createVolumeController(deps) {
  const { getAudioEl, invoke, setPreferredPlaybackVolume } = deps;
  let lastNonZeroVolume = 0.7;
  let audioVolumeListener = null;

  function volumeInput() {
    return document.getElementById("volume");
  }

  function muteButton() {
    return document.getElementById("btn-volume-mute");
  }

  function currentVolume() {
    const slider = volumeInput();
    if (!slider) return lastNonZeroVolume;
    return clampVolume(Number(slider.value) / 100);
  }

  function setSliderVisual(volume, muted = false) {
    const slider = volumeInput();
    if (!slider) return;
    const percent = Math.round(clampVolume(volume) * 100);
    slider.style.setProperty("--volume-progress", `${percent}%`);
    slider.dataset.muted = muted ? "true" : "false";
  }

  function syncButton(volume, muted = false) {
    const button = muteButton();
    if (!button) return;
    const effectiveMute = muted || volume <= 0.001;
    const icon = effectiveMute ? ICONS.mute : volume < 0.45 ? ICONS.quiet : ICONS.loud;
    const label = effectiveMute ? "取消静音" : "静音";
    button.innerHTML = icon;
    button.dataset.muted = effectiveMute ? "true" : "false";
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function syncVolumeUi(volume = currentVolume(), muted = false) {
    if (!muted && volume > 0.001) lastNonZeroVolume = volume;
    setSliderVisual(volume, muted);
    syncButton(volume, muted);
  }

  async function persistVolume(volume) {
    try {
      await invoke("save_settings", { patch: { volume } });
    } catch (error) {
      console.warn("save_settings volume", error);
    }
  }

  function applyVolume(volume, { persist = false, muted = false } = {}) {
    const nextVolume = clampVolume(volume);
    const audio = getAudioEl?.();
    if (audio) {
      audio.muted = muted;
      if (!muted) audio.volume = nextVolume;
    }
    setPreferredPlaybackVolume?.(nextVolume);
    const slider = volumeInput();
    if (slider) slider.value = String(Math.round(nextVolume * 100));
    syncVolumeUi(nextVolume, muted);
    if (persist && !muted) void persistVolume(nextVolume);
  }

  function toggleMute() {
    const audio = getAudioEl?.();
    const currentlyMuted = audio?.muted === true || currentVolume() <= 0.001;
    if (currentlyMuted) {
      const restoreVolume = lastNonZeroVolume > 0.001 ? lastNonZeroVolume : 0.7;
      applyVolume(restoreVolume, { persist: true, muted: false });
      return;
    }
    const current = currentVolume();
    if (current > 0.001) lastNonZeroVolume = current;
    applyVolume(0, { persist: false, muted: true });
  }

  function wireVolume() {
    const slider = volumeInput();
    const button = muteButton();
    if (!slider || !button) return;
    if (slider.dataset.volumeWired === "true" && button.dataset.volumeWired === "true") {
      syncVolumeUi(currentVolume(), getAudioEl?.()?.muted === true);
      return;
    }
    slider.dataset.volumeWired = "true";
    button.dataset.volumeWired = "true";
    slider.addEventListener("input", () => {
      const nextVolume = clampVolume(Number(slider.value) / 100);
      const muted = nextVolume <= 0.001;
      applyVolume(nextVolume, { muted });
    });
    slider.addEventListener("change", () => {
      const nextVolume = clampVolume(Number(slider.value) / 100);
      const muted = nextVolume <= 0.001;
      if (muted) {
        if (lastNonZeroVolume <= 0.001) lastNonZeroVolume = 0.7;
        applyVolume(0, { persist: false, muted: true });
        return;
      }
      void persistVolume(nextVolume);
    });
    button.addEventListener("click", () => {
      toggleMute();
    });
    const audio = getAudioEl?.();
    if (audio) {
      if (audioVolumeListener) {
        audio.removeEventListener("volumechange", audioVolumeListener);
      }
      audioVolumeListener = () => {
        const actualVolume = audio.muted ? 0 : clampVolume(audio.volume);
        syncVolumeUi(actualVolume, audio.muted || actualVolume <= 0.001);
      };
      audio.addEventListener("volumechange", audioVolumeListener);
    }
    syncVolumeUi(currentVolume(), audio?.muted === true);
  }

  return { applyVolume, syncVolumeUi, toggleMute, wireVolume };
}
