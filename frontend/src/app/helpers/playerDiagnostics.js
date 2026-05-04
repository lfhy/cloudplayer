// Player diagnostics helpers are reused by audio load and playback event reporting.
export function audioDiagPayload(audio) {
  let bufferedEnd = null;
  try {
    if (audio.buffered && audio.buffered.length > 0) {
      bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
    }
  } catch {
    /* ignore */
  }
  return {
    currentTime: audio.currentTime,
    duration: audio.duration,
    readyState: audio.readyState,
    networkState: audio.networkState,
    bufferedEnd,
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
