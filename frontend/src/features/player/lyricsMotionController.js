// Lyric motion helpers keep per-frame DOM work focused on the currently active line.
export function captureLyricLineElements(box, selector) {
  return box ? Array.from(box.querySelectorAll(selector)) : [];
}

export function applyLyricLineStates(lineElements, activeIndex, progressRatio) {
  lineElements.forEach((line, index) => {
    line.classList.toggle("is-active", index === activeIndex);
    line.classList.toggle("is-past", index < activeIndex);
    line.classList.toggle("is-future", index > activeIndex);
    const ratio = index < activeIndex ? 1 : index === activeIndex ? progressRatio : 0;
    line.style.setProperty("--line-progress", `${Math.max(0, Math.min(1, ratio)) * 100}%`);
  });
}

export function applyActiveLyricProgress(lineElements, activeIndex, progressRatio) {
  if (!Array.isArray(lineElements) || activeIndex < 0 || activeIndex >= lineElements.length) return;
  lineElements[activeIndex]?.style.setProperty("--line-progress", `${Math.max(0, Math.min(1, progressRatio)) * 100}%`);
}

export function centerActiveLyricLine(box, lineElements, activeIndex) {
  if (!box || activeIndex < 0 || activeIndex >= lineElements.length) return;
  const activeLine = lineElements[activeIndex];
  if (!activeLine) return;
  const targetTop = activeLine.offsetTop - (box.clientHeight - activeLine.offsetHeight) / 2;
  box.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
}
