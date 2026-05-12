// Playback transition control keeps pause/resume fades separate from track loading rules.
const DEFAULT_VOLUME = 0.7;
const FADE_IN_MS = 180;
const FADE_OUT_MS = 160;

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(1, numeric));
}

export function createPlaybackTransitionController(deps) {
  const { getAudioEl } = deps;
  let preferredVolume = DEFAULT_VOLUME;
  let holdPausedSilence = false;
  let pausingViaFade = false;
  let fadeMode = "idle";
  let frameId = 0;
  let fadeToken = 0;

  function audioEl() {
    return getAudioEl?.() || null;
  }

  function cancelAnimation() {
    fadeToken += 1;
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  function stopAnimation() {
    cancelAnimation();
    fadeMode = "idle";
  }

  function runFade({ audio, from, to, durationMs, onComplete }) {
    cancelAnimation();
    const token = fadeToken;
    const startedAt = performance.now();
    const safeDuration = Math.max(1, Number(durationMs) || 1);
    audio.volume = clampVolume(from);
    return new Promise((resolve) => {
      const step = (now) => {
        if (token !== fadeToken) {
          resolve(false);
          return;
        }
        const progress = Math.min(1, (now - startedAt) / safeDuration);
        audio.volume = clampVolume(from + (to - from) * progress);
        if (progress >= 1) {
          frameId = 0;
          onComplete?.();
          resolve(true);
          return;
        }
        frameId = requestAnimationFrame(step);
      };
      frameId = requestAnimationFrame(step);
    });
  }

  function setPreferredVolume(volume) {
    preferredVolume = clampVolume(volume);
    const audio = audioEl();
    if (!audio) return preferredVolume;
    if (!audio.src || (!holdPausedSilence && fadeMode === "idle")) {
      audio.volume = preferredVolume;
      return preferredVolume;
    }
    if (fadeMode === "fading-in") return preferredVolume;
    if (!audio.paused) audio.volume = preferredVolume;
    return preferredVolume;
  }

  function prepareForDirectPlayback() {
    const audio = audioEl();
    stopAnimation();
    holdPausedSilence = false;
    pausingViaFade = false;
    if (audio) audio.volume = preferredVolume;
  }

  async function pauseWithFade() {
    const audio = audioEl();
    if (!audio?.src || audio.paused) return;
    fadeMode = "fading-out";
    const completed = await runFade({
      audio,
      from: clampVolume(audio.volume),
      to: 0,
      durationMs: FADE_OUT_MS,
      onComplete: () => {
        pausingViaFade = true;
        holdPausedSilence = true;
        audio.pause();
        audio.volume = 0;
        fadeMode = "idle";
      },
    });
    if (!completed) return;
  }

  async function resumeWithFade() {
    const audio = audioEl();
    if (!audio?.src) return;
    stopAnimation();
    holdPausedSilence = false;
    pausingViaFade = false;
    fadeMode = "fading-in";
    audio.volume = 0;
    try {
      if (audio.paused) await audio.play();
    } catch (error) {
      fadeMode = "idle";
      audio.volume = preferredVolume;
      throw error;
    }
    await runFade({
      audio,
      from: clampVolume(audio.volume),
      to: preferredVolume,
      durationMs: FADE_IN_MS,
      onComplete: () => {
        audio.volume = preferredVolume;
        fadeMode = "idle";
      },
    });
  }

  async function togglePlayPause() {
    const audio = audioEl();
    if (!audio?.src) return;
    if (fadeMode === "fading-out" || audio.paused) {
      await resumeWithFade();
      return;
    }
    await pauseWithFade();
  }

  function handlePlayEvent() {
    holdPausedSilence = false;
    pausingViaFade = false;
    if (fadeMode === "fading-in") return;
    if (fadeMode === "idle") {
      const audio = audioEl();
      if (audio) audio.volume = preferredVolume;
    }
  }

  function handlePauseEvent() {
    stopAnimation();
    if (pausingViaFade) {
      pausingViaFade = false;
      return;
    }
    holdPausedSilence = false;
    const audio = audioEl();
    if (audio && !audio.src) audio.volume = preferredVolume;
  }

  return {
    handlePauseEvent,
    handlePlayEvent,
    prepareForDirectPlayback,
    setPreferredVolume,
    togglePlayPause,
  };
}
