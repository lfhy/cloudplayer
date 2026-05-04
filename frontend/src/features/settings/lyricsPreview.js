// Lyrics preview helper mirrors desktop-lyrics typography and color behavior inside preferences.
import {
  DEFAULT_LYRICS_IDLE_LINE1,
  DEFAULT_LYRICS_IDLE_LINE2,
  normalizeLyricHexInput,
  normalizeLyricsIdleLine,
} from "./formHelpers.js";

export function renderLyricsPreview(values) {
  const line1El = document.getElementById("setting-ly-preview-line1");
  const line2El = document.getElementById("setting-ly-preview-line2");
  if (line1El) {
    line1El.textContent = normalizeLyricsIdleLine(values?.idleLine1, DEFAULT_LYRICS_IDLE_LINE1);
    line1El.style.color = normalizeLyricHexInput(values?.base, "#ffffff");
  }
  if (line2El) {
    line2El.textContent = normalizeLyricsIdleLine(values?.idleLine2, DEFAULT_LYRICS_IDLE_LINE2);
    line2El.style.color = normalizeLyricHexInput(values?.highlight, "#ffb7d4");
  }
}

