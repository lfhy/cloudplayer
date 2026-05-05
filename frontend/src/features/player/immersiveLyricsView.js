import { escapeHtml } from "../../app/helpers/text.js";
import { lyricDisplayForDesktop } from "../lyrics/model.js";

// Immersive lyric view helpers stay pure so the controller only coordinates DOM and playback state.
export function lrcEntriesFromWordLines(lines) {
  if (!Array.isArray(lines) || !lines.length) return [];
  return lines.map((line) => {
    const startMs = Number(line?.startMs);
    const text = (Array.isArray(line?.words) ? line.words : []).map((word) => String(word?.text ?? "")).join("").trim();
    return Number.isFinite(startMs) && startMs >= 0 && text ? { t: startMs / 1000, text } : null;
  }).filter(Boolean).sort((a, b) => a.t - b.t);
}

export function wordsJoinForTiming(wordLine) {
  if (!wordLine?.words?.length) return "";
  return wordLine.words.map((word) => word.text ?? "").join("");
}

export function wordCoverageRatio(wordLine, currentTime) {
  const words = wordLine?.words;
  if (!words?.length) return -1;
  const totalChars = words.reduce((sum, word) => sum + Array.from(word.text ?? "").length, 0);
  if (totalChars <= 0) return -1;
  let covered = 0;
  for (const word of words) {
    const charCount = Array.from(word.text ?? "").length;
    const startS = Number(word.startMs ?? 0) / 1000;
    const endS = Number(word.endMs ?? 0) / 1000;
    const duration = endS - startS;
    const progress = duration > 0
      ? Math.min(1, Math.max(0, (currentTime - startS) / duration))
      : currentTime >= endS ? 1 : currentTime < startS ? 0 : 1;
    covered += progress * charCount;
  }
  return Math.min(1, Math.max(0, covered / totalChars));
}

export function plainCoverageRatio(startT, endT, currentTime) {
  const duration = endT - startT;
  return duration > 0 ? Math.min(1, Math.max(0, (currentTime - startT) / duration)) : 1;
}

export function lineProgressRatio({ index, activeIndex, entries, wordLines, currentTime }) {
  if (index < activeIndex) return 1;
  if (index > activeIndex) return 0;
  const entry = entries[index];
  const nextEntry = entries[index + 1];
  const wordLine = Array.isArray(wordLines) ? wordLines[index] : null;
  const ratio = wordLine
    ? wordCoverageRatio(wordLine, currentTime)
    : plainCoverageRatio(entry?.t || 0, nextEntry?.t || (entry?.t || 0) + 4, currentTime);
  return ratio < 0 ? 0 : Math.max(0, Math.min(1, ratio));
}

export function lyricViewportState({ currentTrack, currentTime, lrcEntries, wordLines }) {
  if (!currentTrack || !lrcEntries.length) return null;
  const payload = lyricDisplayForDesktop({
    currentTrack,
    currentTime,
    lrcEntries,
    wordLines,
    idleLine1: "CloudPlayer",
    idleLine2: "让音乐陪你此刻",
  });
  const activeText = payload.activeSlot === 2 ? payload.line2 : payload.line1;
  const activeStartT = payload.activeSlot === 2 ? payload.line2StartT : payload.line1StartT;
  const index = lrcEntries.findIndex((entry) => entry.text === activeText && Math.abs(entry.t - activeStartT) < 0.25);
  const start = Math.max(0, index - 5);
  const end = Math.min(lrcEntries.length, index >= 0 ? index + 7 : 10);
  return { end, index, payload, start };
}

export function buildLyricLineHtml(entry, absoluteIndex) {
  const text = escapeHtml(entry.text || "\u00a0");
  return `<p class="immersive-player__lyrics-line" data-lyric-index="${absoluteIndex}"><span class="immersive-player__line-base">${text}</span><span class="immersive-player__line-fill">${text}</span></p>`;
}
