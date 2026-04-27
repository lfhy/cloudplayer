// Desktop lyric color helpers keep interpolation math separate from DOM work.
import { desktopLyricsState } from "./state.js";

function lerp255(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex) {
  const value = (hex || "").trim();
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (!match) return null;
  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
}

export function applyLyricColors(baseHex, highlightHex) {
  const base = hexToRgb(baseHex);
  const highlight = hexToRgb(highlightHex);
  if (base) desktopLyricsState.baseRgb = base;
  if (highlight) desktopLyricsState.hiRgb = highlight;
  document.documentElement.style.setProperty(
    "--ly-text",
    `rgb(${desktopLyricsState.baseRgb.r}, ${desktopLyricsState.baseRgb.g}, ${desktopLyricsState.baseRgb.b})`
  );
}

export function charColor(progress) {
  const base = desktopLyricsState.baseRgb;
  const hi = desktopLyricsState.hiRgb;
  return `rgb(${lerp255(base.r, hi.r, progress)}, ${lerp255(base.g, hi.g, progress)}, ${lerp255(base.b, hi.b, progress)})`;
}
