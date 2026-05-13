// Audio event wiring stays separate from playback loading so media element behavior is easy to test.
import { setPlaybackIndicator } from "../../app/helpers/playbackIndicator.js";
import { setPlayButtonIcon } from "./playButtonIcon.js";

export function createAudioEventsController(deps) {
  const {
    applyPendingPlaybackResume,
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
    refreshCurrentLyricsSnapshot,
    savePlaybackProgressNow,
    scheduleSavePlaybackProgress,
    setAudioProgressLogLastTs,
    setSeekDragging,
    syncDesktopLyrics,
    syncSeekUi,
    togglePlayPauseWithTransition,
    onPauseTransitionEvent,
    onPlayTransitionEvent,
  } = deps;

  function wireAudio() {
    const audio = getAudioEl();
    const playButton = document.getElementById("btn-player-play");
    const seek = document.getElementById("seek");
    if (!audio) return;

    let lastTrayBroadcastTs = 0;
    audio.addEventListener("timeupdate", () => {
      syncSeekUi();
      refreshCurrentLyricsSnapshot?.();
      void syncDesktopLyrics();
      scheduleSavePlaybackProgress?.();
      const now = Date.now();
      if (now - lastTrayBroadcastTs >= 1000) {
        lastTrayBroadcastTs = now;
        void broadcastTrayPlayerState();
      }
    });
    audio.addEventListener("loadedmetadata", () => {
      applyPendingPlaybackResume?.();
      syncSeekUi();
      refreshCurrentLyricsSnapshot?.();
      if (getAudioSourceGeneration() === getPlayLoadGeneration()) {
        void logPlayEventDesktop("audio_loadedmetadata", {
          url: audio.src || null,
          extra: audioDiagPayload(audio),
        });
      }
    });
    audio.addEventListener("durationchange", () => {
      syncSeekUi();
      refreshCurrentLyricsSnapshot?.();
    });
    audio.addEventListener("canplay", () => {
      applyPendingPlaybackResume?.();
      syncSeekUi();
      refreshCurrentLyricsSnapshot?.();
    });
    audio.addEventListener("seeked", () => {
      syncSeekUi();
      refreshCurrentLyricsSnapshot?.();
      void syncDesktopLyrics();
      void savePlaybackProgressNow?.(true);
    });
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
      refreshCurrentLyricsSnapshot?.();
      void savePlaybackProgressNow?.(true);
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
      onPlayTransitionEvent?.();
      setPlayButtonIcon(playButton, true);
      setPlaybackIndicator(getPlayQueue()[getPlayIndex()] || null, true);
      refreshCurrentLyricsSnapshot?.();
      void savePlaybackProgressNow?.(true);
      void broadcastTrayPlayerState();
      void syncDesktopLyrics();
    });
    audio.addEventListener("pause", () => {
      onPauseTransitionEvent?.();
      setPlayButtonIcon(playButton, false);
      setPlaybackIndicator(getPlayQueue()[getPlayIndex()] || null, false);
      refreshCurrentLyricsSnapshot?.();
      void savePlaybackProgressNow?.(true);
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
      void savePlaybackProgressNow?.(true);
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
      if (!audio.src) {
        if (getPlayQueue().length) {
          void playFromQueueIndex(getPlayIndex());
        }
        return;
      }
      try {
        await togglePlayPauseWithTransition?.();
      } catch (error) {
        alertRequestFailed(error, "audio play()");
      }
    });
    document.getElementById("btn-player-prev")?.addEventListener("click", () => {
      const length = getPlayQueue().length;
      if (!length) return;
      void savePlaybackProgressNow?.(true);
      const mode = playModeItems[getPlayModeIndex()].key;
      if (mode === "shuffle") {
        void playFromQueueIndex((getPlayIndex() - 1 + length) % length);
        return;
      }
      void playFromQueueIndex((getPlayIndex() - 1 + length) % length);
    });
    document.getElementById("btn-player-next")?.addEventListener("click", () => {
      const length = getPlayQueue().length;
      if (!length) return;
      void savePlaybackProgressNow?.(true);
      const mode = playModeItems[getPlayModeIndex()].key;
      if (mode === "shuffle") {
        void playFromQueueIndex(randomNextIndex());
        return;
      }
      void playFromQueueIndex((getPlayIndex() + 1) % length);
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
