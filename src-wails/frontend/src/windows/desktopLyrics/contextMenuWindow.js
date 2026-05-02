// Desktop lyrics context menu opens as a small independent popup window.
import { WebviewWindow } from "../../wails/tauri-webviewWindow.js";
import { lyricsWin } from "./state.js";

const MENU_WIDTH = 192;
const MENU_HEIGHT = 194;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function currentLyricsMenuBounds(screenX, screenY) {
  const screenWidth = Math.max(320, window.screen.availWidth || 0);
  const screenHeight = Math.max(240, window.screen.availHeight || 0);
  let x = Math.round(screenX);
  let y = Math.round(screenY);
  try {
    const outerPos = await lyricsWin.outerPosition();
    const fallbackX = Number(outerPos?.x);
    const fallbackY = Number(outerPos?.y);
    if ((!Number.isFinite(x) || !Number.isFinite(y)) && Number.isFinite(fallbackX) && Number.isFinite(fallbackY)) {
      x = Math.round(fallbackX + 4);
      y = Math.round(fallbackY + 4);
    }
  } catch (error) {
    console.warn("currentLyricsMenuBounds", error);
  }
  return {
    x: clamp(x, 8, Math.max(8, screenWidth - MENU_WIDTH - 8)),
    y: clamp(y, 8, Math.max(8, screenHeight - MENU_HEIGHT - 8)),
    width: MENU_WIDTH,
    height: MENU_HEIGHT,
  };
}

export async function openDesktopLyricsContextMenuWindow(clientX, clientY) {
  const bounds = await currentLyricsMenuBounds(clientX, clientY);
  const win = new WebviewWindow("lyrics-context-menu", {
    url: "/desktop_lyrics_menu.html",
    title: "歌词菜单",
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    resizable: false,
    alwaysOnTop: true,
    decorations: false,
    transparent: true,
    shadow: false,
    skipTaskbar: true,
    focus: true,
  });
  win.once("tauri://error", (error) => console.error("lyrics context menu window", error));
  return win;
}
