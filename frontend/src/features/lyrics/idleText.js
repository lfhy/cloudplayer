// Idle lyric helpers normalize and build fallback payloads when nothing is playing.
export const DESKTOP_LYRICS_IDLE_LINE1 = "CloudPlayer";
export const DESKTOP_LYRICS_IDLE_LINE2 = "让音乐陪你此刻";

export function normalizeDesktopLyricsIdleLine(value, fallback) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  const limited = Array.from(trimmed).slice(0, 36).join("").trim();
  return limited || fallback;
}

export function normalizeDesktopLyricsIdleText(line1, line2) {
  return {
    line1: normalizeDesktopLyricsIdleLine(line1, DESKTOP_LYRICS_IDLE_LINE1),
    line2: normalizeDesktopLyricsIdleLine(line2, DESKTOP_LYRICS_IDLE_LINE2),
  };
}

export function idleDesktopLyricsPayload(line1, line2, audioNow) {
  return {
    line1,
    line2,
    idleMode: true,
    activeSlot: 1,
    line1StartT: 0,
    line1EndT: 1,
    line2StartT: 0,
    line2EndT: 0,
    audioNow,
  };
}
