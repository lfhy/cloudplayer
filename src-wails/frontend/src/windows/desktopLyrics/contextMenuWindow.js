// Desktop lyrics context menu opens as a small independent popup window.
import { WebviewWindow } from "../../wails/tauri-webviewWindow.js";
import { lyricsWin } from "./state.js";

const MENU_WIDTH = 192;
const MENU_HEIGHT = 194;

async function currentLyricsMenuBounds(clientX, clientY) {
  let x = Math.round(clientX);
  let y = Math.round(clientY);
  try {
    const factor = await lyricsWin.scaleFactor();
    const outerPos = await lyricsWin.outerPosition();
    const logicalPos = outerPos.toLogical(factor);
    if (Number.isFinite(logicalPos?.x) && Number.isFinite(logicalPos?.y)) {
      x = Math.round(logicalPos.x + clientX + 12);
      y = Math.round(logicalPos.y + clientY + 12);
    }
  } catch (error) {
    console.warn("currentLyricsMenuBounds", error);
  }
  return {
    x,
    y,
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
