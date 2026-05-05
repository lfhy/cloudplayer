// Audio event wiring stays separate from playback loading so media element behavior is easy to test.
import { setPlayButtonIcon } from "./playButtonIcon.js";

export function createAudioEventsController(deps) {
  const {
    alertRequestFailed,
    audioDiagPayload,
    broadcastTrayPlayerState,
    getAudioEl,
    getAudioProgressLogLastTs,
    getAudioSourceGeneration,
    getPlayIndex,
    getPlayLoadGeneration,
    getPlayModeIndex,
    getPlayQueue,
    logPlayEventDesktop,
    messageRequestFailed,
    playFromQueueIndex,
    playModeItems,
    randomNextIndex,
    setAudioProgressLogLastTs,
    setSeekDragging,
    syncDesktopLyrics,
    syncSeekUi,
  } = deps;

  function wireAudio() {
    const audio = getAudioEl();
    const playButton = document.getElementById("btn-player-play");
    const seek = document.getElementById("seek");
    if (!audio) return;

    let lastTrayBroadcastTs = 0;
    audio.addEventListener("timeupdate", () => {
      syncSeekUi();
      void syncDesktopLyrics();
      const now = Date.now();
      if (now - lastTrayBroadcastTs >= 1000) {
        lastTrayBroadcastTs = now;
        void broadcastTrayPlayerState();
      }
    });
    audio.addEventListener("loadedmetadata", () => {
      syncSeekUi();
      if (getAudioSourceGeneration() === getPlayLoadGeneration()) {
        void logPlayEventDesktop("audio_loadedmetadata", {
          url: audio.src || null,
          extra: audioDiagPayload(audio),
        });
      }
    });
    audio.addEventListener("durationchange", () => syncSeekUi());
    audio.addEventListener("canplay", () => syncSeekUi());
    audio.addEventListener("progress", () => {
      if (getAudioSourceGeneration() !== getPlayLoadGeneration()) return;
      const now = Date.now();
      if (now - getAudioProgressLogLastTs() < 1000) return;
      setAudioProgressLogLastTs(now);
      void logPlayEventDesktop("audio_progress", {
        url: audio.src || null,
        extra: audioDiagPayload(audio),
      });
    });
    audio.addEventListener("stalled", () => {
      if (getAudioSourceGeneration() !== getPlayLoadGeneration()) return;
      void logPlayEventDesktop("audio_stalled", {
        url: audio.src || null,
        extra: audioDiagPayload(audio),
      });
    });
    audio.addEventListener("ended", () => {
      if (getAudioSourceGeneration() === getPlayLoadGeneration()) {
        void logPlayEventDesktop("audio_ended", {
          url: audio.src || null,
          extra: audioDiagPayload(audio),
        });
      }
      handleEnded(audio, playButton);
      void syncDesktopLyrics();
    });
    audio.addEventListener("play", () => {
      setPlayButtonIcon(playButton, true);
      void broadcastTrayPlayerState();
      void syncDesktopLyrics();
    });
    audio.addEventListener("pause", () => {
      setPlayButtonIcon(playButton, false);
      void broadcastTrayPlayerState();
      void syncDesktopLyrics();
    });
    audio.addEventListener("error", () => {
      const error = audio.error;
      if (error && error.code === 1) return;
      if (getAudioSourceGeneration() !== getPlayLoadGeneration()) return;
      void logPlayEventDesktop("audio_error", {
        url: audio.src || null,
        error_code: error ? error.code : null,
        message: error && error.message ? error.message : null,
        extra: audioDiagPayload(audio),
      });
      const sub = document.getElementById("dock-sub");
      if (sub && error) sub.textContent = messageRequestFailed;
      void broadcastTrayPlayerState();
    });

    wireSeek(seek, audio);
    wireTransport(audio, playButton);
  }

  function wireSeek(seek, audio) {
    if (!seek) return;
    seek.addEventListener("pointerdown", () => setSeekDragging(true));
    seek.addEventListener("pointerup", () => {
      setSeekDragging(false);
      syncSeekUi();
    });
    seek.addEventListener("input", () => {
      const duration = audio.duration;
      if (duration && Number.isFinite(duration) && duration > 0) {
        audio.currentTime = (Number(seek.value) / 1000) * duration;
      }
    });
  }

  function wireTransport(audio, playButton) {
    playButton?.addEventListener("click", async () => {
      if (!audio.src) return;
      try {
        if (audio.paused) await audio.play();
        else audio.pause();
      } catch (error) {
        alertRequestFailed(error, "audio play()");
      }
    });
    document.getElementById("btn-player-prev")?.addEventListener("click", () => {
      const length = getPlayQueue().length;
      if (!length) return;
      const mode = playModeItems[getPlayModeIndex()].key;
      if (mode === "shuffle") {
        void playFromQueueIndex((getPlayIndex() - 1 + length) % length);
        return;
      }
      if (mode === "loop_list" && getPlayIndex() === 0) {
        void playFromQueueIndex(length - 1);
        return;
      }
      if (getPlayIndex() > 0) void playFromQueueIndex(getPlayIndex() - 1);
    });
    document.getElementById("btn-player-next")?.addEventListener("click", () => {
      const length = getPlayQueue().length;
      if (!length) return;
      const mode = playModeItems[getPlayModeIndex()].key;
      if (mode === "shuffle") {
        void playFromQueueIndex(randomNextIndex());
        return;
      }
      if (mode === "loop_list" && getPlayIndex() === length - 1) {
        void playFromQueueIndex(0);
        return;
      }
      if (getPlayIndex() < length - 1) void playFromQueueIndex(getPlayIndex() + 1);
    });
  }

  function handleEnded(audio, playButton) {
    const length = getPlayQueue().length;
    const mode = playModeItems[getPlayModeIndex()].key;
    if (!length) {
      syncSeekUi();
      return;
    }
    if (mode === "one") {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    if (mode === "loop_list") {
      void playFromQueueIndex((getPlayIndex() + 1) % length);
      return;
    }
    if (mode === "shuffle") {
      void playFromQueueIndex(randomNextIndex());
      return;
    }
    if (getPlayIndex() < length - 1) {
      void playFromQueueIndex(getPlayIndex() + 1);
    } else {
      setPlayButtonIcon(playButton, false);
    }
    syncSeekUi();
  }

  return { wireAudio };
}
