import { Window as RuntimeWindow } from "@wailsio/runtime";

const MAIN_MIN_WIDTH = 1000;
const MAIN_MIN_HEIGHT = 680;
const MINI_MIN_WIDTH = 360;
const MINI_MIN_HEIGHT = 260;
const MINI_WIDTH = 460;
const MINI_HEIGHT = 360;

// Mini-mode window helpers keep native window transitions reversible and centered.
export function createMiniModeWindowController() {
  const mainWindow = RuntimeWindow.Get("main");
  let savedState = null;

  async function readWindowValue(label, run, fallback) {
    try {
      return await run();
    } catch (error) {
      console.warn(`mini mode ${label}`, error);
      return fallback;
    }
  }

  async function runWindowStep(label, run) {
    try {
      await run();
    } catch (error) {
      console.warn(`mini mode ${label}`, error);
    }
  }

  async function captureWindowState() {
    const [position, size, wasFullscreen, wasMaximised] = await Promise.all([
      readWindowValue("Position", () => mainWindow.Position(), { x: 0, y: 0 }),
      readWindowValue("Size", () => mainWindow.Size(), { width: MINI_WIDTH, height: MINI_HEIGHT }),
      readWindowValue("IsFullscreen", () => mainWindow.IsFullscreen(), false),
      readWindowValue("IsMaximised", () => mainWindow.IsMaximised(), false),
    ]);
    return { position, size, wasFullscreen, wasMaximised };
  }

  function miniBoundsFrom(saved) {
    const width = Math.min(MINI_WIDTH, Math.max(MINI_MIN_WIDTH, saved?.size?.width || MINI_WIDTH));
    const height = Math.min(MINI_HEIGHT, Math.max(MINI_MIN_HEIGHT, saved?.size?.height || MINI_HEIGHT));
    const baseX = Number(saved?.position?.x) || 0;
    const baseY = Number(saved?.position?.y) || 0;
    const baseWidth = Number(saved?.size?.width) || width;
    const baseHeight = Number(saved?.size?.height) || height;
    return {
      width,
      height,
      x: Math.max(0, Math.round(baseX + (baseWidth - width) / 2)),
      y: Math.max(0, Math.round(baseY + Math.min(48, Math.max(16, (baseHeight - height) / 3)))),
    };
  }

  async function enterMiniWindow() {
    savedState ||= await captureWindowState();
    if (savedState.wasFullscreen || savedState.wasMaximised) await runWindowStep("Restore", () => mainWindow.Restore());
    const bounds = miniBoundsFrom(savedState);
    await runWindowStep("SetResizable", () => mainWindow.SetResizable(true));
    await runWindowStep("SetSize", () => mainWindow.SetSize(bounds.width, bounds.height));
    await runWindowStep("SetPosition", () => mainWindow.SetPosition(bounds.x, bounds.y));
    await runWindowStep("Focus", () => mainWindow.Focus());
  }

  async function exitMiniWindow() {
    const state = savedState;
    savedState = null;
    await runWindowStep("SetResizable", () => mainWindow.SetResizable(true));
    if (!state) return;
    if (state.wasFullscreen) {
      await runWindowStep("Fullscreen", () => mainWindow.Fullscreen());
      return;
    }
    if (state.wasMaximised) {
      await runWindowStep("Maximise", () => mainWindow.Maximise());
      return;
    }
    await runWindowStep("SetSize", () =>
      mainWindow.SetSize(Math.max(MAIN_MIN_WIDTH, state.size.width), Math.max(MAIN_MIN_HEIGHT, state.size.height))
    );
    await runWindowStep("SetPosition", () =>
      mainWindow.SetPosition(Math.max(0, state.position.x), Math.max(0, state.position.y))
    );
  }

  return { enterMiniWindow, exitMiniWindow };
}
