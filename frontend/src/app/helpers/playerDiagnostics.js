// Player diagnostics helpers are reused by audio load and playback event reporting.
export function audioDiagPayload(audio) {
  let bufferedEnd = null;
  let errorCode = null;
  let errorMessage = null;
  try {
    if (audio.buffered && audio.buffered.length > 0) {
      bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
    }
  } catch {
    /* ignore */
  }
  if (audio?.error) {
    errorCode = audio.error.code ?? null;
    errorMessage = audio.error.message || null;
  }
  return {
    currentTime: audio.currentTime,
    currentSrc: audio.currentSrc || audio.src || "",
    duration: audio.duration,
    ended: audio.ended,
    errorCode,
    errorMessage,
    networkState: audio.networkState,
    paused: audio.paused,
    bufferedEnd,
    readyState: audio.readyState,
    seeking: audio.seeking,
  };
}

export function createPlayEventLogger(invoke) {
  return async function logPlayEventDesktop(
    stage,
    { url = null, error_code = null, message = null, extra = null } = {},
  ) {
    try {
      await invoke("log_play_event", {
        stage,
        url,
        error_code,
        message,
        extra: extra != null ? (typeof extra === "string" ? extra : JSON.stringify(extra)) : null,
      });
    } catch {
      /* ignore */
    }
  };
}
