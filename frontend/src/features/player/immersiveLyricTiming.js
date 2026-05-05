import { lyricDisplayForDesktop } from "../lyrics/model.js";

// Immersive lyric timing mirrors desktop lyrics: sync on anchor ticks, interpolate between them.
export function createImmersiveLyricTiming() {
  return { lyricAnchor: null, syncedAudioNow: 0, syncedWallNow: 0, syncToken: "" };
}

export function refreshLyricAnchor(timing, { audio, currentTrack, lrcEntries, wordLines }) {
  const audioNow = audio?.currentTime || 0;
  timing.lyricAnchor = lyricDisplayForDesktop({
    currentTrack,
    currentTime: audioNow,
    lrcEntries,
    wordLines,
    idleLine1: "CloudPlayer",
    idleLine2: "让音乐陪你此刻",
  });
  if (timing.lyricAnchor) {
    timing.lyricAnchor.audioNow = audioNow;
    timing.lyricAnchor.audioPlaying = !!audio && !audio.paused;
  }
}

export function syncedCurrentTime(timing, anchor) {
  const token = [
    anchor.line1,
    anchor.line2,
    anchor.activeSlot,
    anchor.line1StartT,
    anchor.line1EndT,
    anchor.line2StartT,
    anchor.line2EndT,
    anchor.audioNow,
    anchor.audioPlaying ? 1 : 0,
  ].join("|");
  if (timing.syncToken !== token) {
    timing.syncToken = token;
    timing.syncedAudioNow = Number(anchor.audioNow) || 0;
    timing.syncedWallNow = performance.now();
  }
  if (!anchor.audioPlaying) return Number(anchor.audioNow) || 0;
  return timing.syncedAudioNow + Math.max(0, performance.now() - timing.syncedWallNow) / 1000;
}
