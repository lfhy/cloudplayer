// Desktop lyrics state centralizes mutable animation and persistence fields.
import { WebviewWindow } from "../../wails/tauri-webviewWindow.js";

export const MAIN_WW = { kind: "WebviewWindow", label: "main" };
export const lyricsWin = WebviewWindow.getCurrent();
export const frameEl = document.getElementById("ly-frame");

/** @type {{ line1: string, line2: string, activeSlot: number, line1StartT: number, line1EndT: number, line2StartT: number, line2EndT: number, line1Words: object | null, line2Words: object | null, audioNow: number, audioPlaying: boolean } | null} */
export const desktopLyricsState = {
  scale: 1,
  lyricsLocked: true,
  persistTimer: null,
  cursorPassthroughSeq: 0,
  lyAnchor: null,
  builtLine1: "",
  builtLine2: "",
  baseRgb: { r: 255, g: 255, b: 255 },
  hiRgb: { r: 255, g: 183, b: 212 },
  baseColor: "rgb(255, 255, 255)",
  hiColor: "rgb(255, 183, 212)",
  syncedAudioNow: 0,
  syncedWallNow: 0,
  lastReportedAudioNow: 0,
  syncToken: "",
};
