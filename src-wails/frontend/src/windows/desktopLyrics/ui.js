// Desktop lyric UI helpers keep lock state and drag-region updates consistent.
import { frameEl, desktopLyricsState } from "./state.js";
import { applyCursorPassthrough } from "./persistence.js";

export function applyLyricsLockUi(locked) {
  desktopLyricsState.lyricsLocked = !!locked;
  document.body.classList.toggle("lyrics-locked", desktopLyricsState.lyricsLocked);
  const lockBtn = document.getElementById("btn-ly-lock");
  if (lockBtn) {
    lockBtn.title = "锁定桌面歌词";
    lockBtn.setAttribute("aria-label", "锁定桌面歌词");
  }
  const dragRegionEl = document.getElementById("ly-drag-region");
  if (dragRegionEl) {
    if (desktopLyricsState.lyricsLocked) dragRegionEl.removeAttribute("data-tauri-drag-region");
    else dragRegionEl.setAttribute("data-tauri-drag-region", "");
  }
  void applyCursorPassthrough(desktopLyricsState.lyricsLocked);
  refreshLyricsHoverUi();
}

export function setLyricsHoverUi(hovered) {
  document.body.classList.toggle("lyrics-hovering", !!hovered && !desktopLyricsState.lyricsLocked);
}

export function refreshLyricsHoverUi() {
  if (desktopLyricsState.lyricsLocked) {
    document.body.classList.remove("lyrics-hovering");
    return;
  }
  setLyricsHoverUi(!!frameEl?.matches(":hover"));
}

export function lyricsPreventDragMaximize(event) {
  if (event.target?.closest?.(".ly-toolbar")) return;
  event.preventDefault();
  event.stopPropagation();
}
