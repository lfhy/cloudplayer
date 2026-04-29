// Desktop lyric renderer keeps word timing, line rebuilding and RAF animation together.
import { charColor } from "./colors.js";
import { desktopLyricsState } from "./state.js";

function wordsJoinForTiming(wordLine) {
  if (!wordLine?.words?.length) return "";
  return wordLine.words.map((word) => word.text ?? "").join("");
}

function rebuildLineSpans(lineElId, text, wordLine) {
  const element = document.getElementById(lineElId);
  if (!element) return;
  const useWords = wordLine?.words?.length && wordsJoinForTiming(wordLine) === text;
  const cacheKey = `${lineElId}::${text}::${useWords ? `W${wordLine.words.length}` : "plain"}`;
  if (lineElId === "line1") {
    if (desktopLyricsState.builtLine1 === cacheKey) return;
    desktopLyricsState.builtLine1 = cacheKey;
  } else {
    if (desktopLyricsState.builtLine2 === cacheKey) return;
    desktopLyricsState.builtLine2 = cacheKey;
  }

  element.replaceChildren();
  const chars = useWords && wordLine ? wordLine.words.flatMap((word) => Array.from(word.text ?? "")) : Array.from(text);
  for (const ch of chars) {
    const span = document.createElement("span");
    span.className = "ly-char";
    span.textContent = ch;
    element.appendChild(span);
  }
}

function colorLineWords(lineElId, wordLine, currentTime) {
  const element = document.getElementById(lineElId);
  const spans = element?.children ?? [];
  const words = wordLine?.words;
  if (!words?.length) return false;

  let offset = 0;
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
    for (let index = 0; index < charCount; index += 1) {
      const charProgress = Math.min(1, Math.max(0, progress * charCount - index));
      if (spans[offset + index]) spans[offset + index].style.color = charColor(charProgress);
    }
    offset += charCount;
  }
  return offset === spans.length;
}

function setSpansUniform(lineElId, progress) {
  const spans = document.getElementById(lineElId)?.children ?? [];
  for (let index = 0; index < spans.length; index += 1) {
    spans[index].style.color = charColor(progress);
  }
}

function colorPlainLine(lineElId, startT, endT, currentTime) {
  const duration = endT - startT;
  const progress = duration > 0 ? Math.min(1, Math.max(0, (currentTime - startT) / duration)) : 1;
  const spans = document.getElementById(lineElId)?.children ?? [];
  const total = spans.length;
  for (let index = 0; index < total; index += 1) {
    const charProgress = Math.min(1, Math.max(0, progress * total - index));
    spans[index].style.color = charColor(charProgress);
  }
}

export function animateLyrics() {
  const anchor = desktopLyricsState.lyAnchor;
  if (anchor) {
    const slot = anchor.activeSlot === 2 ? 2 : 1;
    rebuildLineSpans("line1", anchor.line1, anchor.line1Words);
    rebuildLineSpans("line2", anchor.line2, anchor.line2Words);
    const elapsed = (Date.now() - anchor.receivedAtMs) / 1000;
    const currentTime = anchor.audioNow + elapsed;

    if (slot === 1) {
      const useWords = anchor.line1Words?.words?.length && wordsJoinForTiming(anchor.line1Words) === anchor.line1;
      if (!useWords || !colorLineWords("line1", anchor.line1Words, currentTime)) {
        colorPlainLine("line1", anchor.line1StartT, anchor.line1EndT, currentTime);
      }
      setSpansUniform("line2", 0);
    } else {
      setSpansUniform("line1", 1);
      const useWords = anchor.line2Words?.words?.length && wordsJoinForTiming(anchor.line2Words) === anchor.line2;
      if (!useWords || !colorLineWords("line2", anchor.line2Words, currentTime)) {
        colorPlainLine("line2", anchor.line2StartT, anchor.line2EndT, currentTime);
      }
    }
  }
  requestAnimationFrame(animateLyrics);
}
