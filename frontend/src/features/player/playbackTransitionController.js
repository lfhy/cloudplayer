// Playback transition control now keeps play/pause direct so transport actions do not animate volume.
const DEFAULT_VOLUME = 0.7;

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(1, numeric));
}

export function createPlaybackTransitionController(deps) {
  const { getAudioEl } = deps;
  let preferredVolume = DEFAULT_VOLUME;

  function audioEl() {
    return getAudioEl?.() || null;
  }

  function applyPreferredVolume() {
    const audio = audioEl();
    if (!audio || audio.muted) return preferredVolume;
    audio.volume = preferredVolume;
    return preferredVolume;
  }

  function setPreferredVolume(volume) {
    preferredVolume = clampVolume(volume);
    const audio = audioEl();
    if (!audio?.src || !audio.paused) {
      applyPreferredVolume();
    }
    return preferredVolume;
  }

  function prepareForDirectPlayback() {
    applyPreferredVolume();
  }

  async function pauseDirectly() {
    const audio = audioEl();
    if (!audio?.src || audio.paused) return;
    audio.pause();
    applyPreferredVolume();
  }

  async function resumeDirectly() {
    const audio = audioEl();
    if (!audio?.src) return;
    applyPreferredVolume();
    await audio.play();
  }

  async function togglePlayPause() {
    const audio = audioEl();
    if (!audio?.src) return;
    if (audio.paused) {
      await resumeDirectly();
      return;
    }
    await pauseDirectly();
  }

  function handlePlayEvent() {
    applyPreferredVolume();
  }

  function handlePauseEvent() {
    applyPreferredVolume();
  }

  return {
    handlePauseEvent,
    handlePlayEvent,
    prepareForDirectPlayback,
    setPreferredVolume,
    togglePlayPause,
  };
}
