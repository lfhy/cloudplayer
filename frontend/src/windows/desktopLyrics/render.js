// Desktop lyric renderer keeps line layering, timing and RAF animation together.
import { desktopLyricsState } from "./state.js";

function wordsJoinForTiming(wordLine) {
  if (!wordLine?.words?.length) return "";
  return wordLine.words.map((word) => word.text ?? "").join("");
}

function ensureLineLayers(lineElId) {
  const element = document.getElementById(lineElId);
  if (!element) return null;
  let base = element.querySelector(".ly-line-base");
  let fill = element.querySelector(".ly-line-fill");
  if (!base || !fill) {
    element.replaceChildren();
    base = document.createElement("span");
    base.className = "ly-line-base";
    fill = document.createElement("span");
    fill.className = "ly-line-fill";
    element.append(base, fill);
  }
  return { element, base, fill };
}

function markInstantLineReset(fill) {
  if (!fill) return;
  fill.dataset.instantReset = "1";
  fill.style.transition = "none";
}

function restoreLineTransition(fill) {
  if (!fill || fill.dataset.instantReset !== "1" || fill.dataset.restoreScheduled === "1") return;
  fill.dataset.restoreScheduled = "1";
  requestAnimationFrame(() => {
    fill.style.removeProperty("transition");
    delete fill.dataset.instantReset;
    delete fill.dataset.restoreScheduled;
  });
}

function rebuildLineLayers(lineElId, text, wordLine) {
  const layers = ensureLineLayers(lineElId);
  if (!layers) return;
  const useWords = wordLine?.words?.length && wordsJoinForTiming(wordLine) === text;
  const cacheKey = `${lineElId}::${text}::${useWords ? `W${wordLine.words.length}` : "plain"}`;
  if (lineElId === "line1") {
    if (desktopLyricsState.builtLine1 === cacheKey) return;
    desktopLyricsState.builtLine1 = cacheKey;
  } else {
    if (desktopLyricsState.builtLine2 === cacheKey) return;
    desktopLyricsState.builtLine2 = cacheKey;
  }
  markInstantLineReset(layers.fill);
  layers.base.textContent = text;
  layers.fill.textContent = text;
}

function wordCoverageRatio(wordLine, currentTime) {
  const words = wordLine?.words;
  if (!words?.length) return -1;
  const totalChars = words.reduce((sum, word) => sum + Array.from(word.text ?? "").length, 0);
  if (totalChars <= 0) return -1;

  let covered = 0;
  for (const word of words) {
    const chars = Array.from(word.text ?? "");
    const charCount = chars.length;
    const startS = (word.startMs ?? 0) / 1000;
    const endS = (word.endMs ?? 0) / 1000;
    const duration = endS - startS;
    const progress =
      duration > 0
        ? Math.min(1, Math.max(0, (currentTime - startS) / duration))
        : currentTime >= endS
          ? 1
          : currentTime < startS
            ? 0
            : 1;
    covered += progress * charCount;
  }
  return Math.min(1, Math.max(0, covered / totalChars));
}

function plainCoverageRatio(startT, endT, currentTime) {
  const duration = endT - startT;
  return duration > 0 ? Math.min(1, Math.max(0, (currentTime - startT) / duration)) : 1;
}

function applyLineCoverage(lineElId, ratio) {
  const layers = ensureLineLayers(lineElId);
  if (!layers) return;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  layers.base.style.color = desktopLyricsState.baseColor;
  layers.fill.style.color = desktopLyricsState.hiColor;
  layers.fill.style.clipPath = `inset(0 ${Math.max(0, (1 - clamped) * 100)}% 0 0)`;
  layers.fill.style.webkitClipPath = layers.fill.style.clipPath;
  restoreLineTransition(layers.fill);
}

function setLineUniform(lineElId, progress) {
  applyLineCoverage(lineElId, progress);
}

function setLineRawColor(lineElId, cssColor) {
  const layers = ensureLineLayers(lineElId);
  if (!layers) return;
  layers.base.style.color = cssColor;
  layers.fill.style.color = cssColor;
  layers.fill.style.clipPath = "inset(0 0 0 0)";
  layers.fill.style.webkitClipPath = layers.fill.style.clipPath;
  restoreLineTransition(layers.fill);
}

function syncedCurrentTime(anchor) {
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
  if (desktopLyricsState.syncToken !== token) {
    desktopLyricsState.syncToken = token;
    desktopLyricsState.syncedAudioNow = Number(anchor.audioNow) || 0;
    desktopLyricsState.syncedWallNow = performance.now();
  }
  if (!anchor.audioPlaying) {
    return Number(anchor.audioNow) || 0;
  }
  return desktopLyricsState.syncedAudioNow + Math.max(0, performance.now() - desktopLyricsState.syncedWallNow) / 1000;
}

export function animateLyrics() {
  const anchor = desktopLyricsState.lyAnchor;
  if (anchor) {
    const slot = anchor.activeSlot === 2 ? 2 : 1;
    rebuildLineLayers("line1", anchor.line1, anchor.line1Words);
    rebuildLineLayers("line2", anchor.line2, anchor.line2Words);
    // Interpolate between sync ticks so desktop lyrics stay smooth while the highlight fill advances naturally.
    const currentTime = syncedCurrentTime(anchor);

    const isIdleSlogan = !!anchor.idleMode;
    if (isIdleSlogan) {
      // Idle slogan uses split state: line1 as unplayed color, line2 as played color.
      setLineRawColor("line1", desktopLyricsState.baseColor);
      setLineRawColor("line2", desktopLyricsState.hiColor);
      requestAnimationFrame(animateLyrics);
      return;
    }

    if (slot === 1) {
      const useWords = anchor.line1Words?.words?.length && wordsJoinForTiming(anchor.line1Words) === anchor.line1;
      const ratio = useWords ? wordCoverageRatio(anchor.line1Words, currentTime) : -1;
      applyLineCoverage("line1", ratio >= 0 ? ratio : plainCoverageRatio(anchor.line1StartT, anchor.line1EndT, currentTime));
      setLineUniform("line2", 0);
    } else {
      setLineUniform("line1", 1);
      const useWords = anchor.line2Words?.words?.length && wordsJoinForTiming(anchor.line2Words) === anchor.line2;
      const ratio = useWords ? wordCoverageRatio(anchor.line2Words, currentTime) : -1;
      applyLineCoverage("line2", ratio >= 0 ? ratio : plainCoverageRatio(anchor.line2StartT, anchor.line2EndT, currentTime));
    }
  }
  requestAnimationFrame(animateLyrics);
}
