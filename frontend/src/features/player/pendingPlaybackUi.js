import { currentPlayableKey } from "../lyrics/model.js";

// Pending playback UI state bridges the restore gap before media metadata catches up.
function normalizeMs(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function pendingStateOf(audio, track) {
  const trackKey = currentPlayableKey(track);
  const pendingTrackKey = String(audio?.dataset?.pendingPlaybackTrackKey || "").trim();
  if (!trackKey || pendingTrackKey !== trackKey) return null;
  const positionMs = normalizeMs(audio?.dataset?.pendingPlaybackPositionMs);
  const durationMs = normalizeMs(audio?.dataset?.pendingPlaybackDurationMs);
  if (!positionMs && !durationMs) return null;
  return { positionMs, durationMs, trackKey };
}

export function setPendingPlaybackSeekState(audio, pendingResume) {
  if (!audio?.dataset || !pendingResume?.trackKey) return;
  audio.dataset.pendingPlaybackTrackKey = pendingResume.trackKey;
  audio.dataset.pendingPlaybackPositionMs = String(normalizeMs(pendingResume.positionMs));
  audio.dataset.pendingPlaybackDurationMs = String(normalizeMs(pendingResume.durationMs));
}

export function clearPendingPlaybackSeekState(audio) {
  if (!audio?.dataset) return;
  delete audio.dataset.pendingPlaybackTrackKey;
  delete audio.dataset.pendingPlaybackPositionMs;
  delete audio.dataset.pendingPlaybackDurationMs;
}

export function getPlaybackSeekDisplay(audio, track) {
  const pending = pendingStateOf(audio, track);
  const audioCurrentMs = Number.isFinite(audio?.currentTime) && audio.currentTime > 0 ? Math.round(audio.currentTime * 1000) : 0;
  const audioDurationMs = Number.isFinite(audio?.duration) && audio.duration > 0 ? Math.round(audio.duration * 1000) : 0;
  return {
    currentTimeMs: audioCurrentMs > 0 ? audioCurrentMs : pending?.positionMs || 0,
    durationMs: Math.max(audioDurationMs, pending?.durationMs || 0),
  };
}
