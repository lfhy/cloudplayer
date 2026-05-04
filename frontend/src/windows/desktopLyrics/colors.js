// Desktop lyric color helpers keep interpolation math separate from DOM work.
import { desktopLyricsState } from "./state.js";

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
  desktopLyricsState.baseColor = `rgb(${desktopLyricsState.baseRgb.r}, ${desktopLyricsState.baseRgb.g}, ${desktopLyricsState.baseRgb.b})`;
  desktopLyricsState.hiColor = `rgb(${desktopLyricsState.hiRgb.r}, ${desktopLyricsState.hiRgb.g}, ${desktopLyricsState.hiRgb.b})`;
  document.documentElement.style.setProperty(
    "--ly-text",
    desktopLyricsState.baseColor
  );
}

export function charColor(progress) {
  return progress > 0 ? desktopLyricsState.hiColor : desktopLyricsState.baseColor;
}
