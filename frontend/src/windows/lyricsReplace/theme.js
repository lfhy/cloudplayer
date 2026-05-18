// Lyrics replace theme helpers keep the popup visually aligned with the main window.
import { invoke } from "../../wails/tauri-core.js";
import { isWindowsDesktop } from "../../app/helpers/platformTheme.js";

const APP_THEMES = {
  coral: { accent: "#c62f2f", accentRgb: "198, 47, 47" },
  ocean: { accent: "#1f6aa5", accentRgb: "31, 106, 165" },
  forest: { accent: "#2f7d4b", accentRgb: "47, 125, 75" },
  netease: { accent: "#d43c33", accentRgb: "212, 60, 51" },
  kugou: { accent: "#1977ff", accentRgb: "25, 119, 255" },
  qqmusic: { accent: "#31c27c", accentRgb: "49, 194, 124" },
};
const APP_THEME_MODES = new Set(["system", "light", "graphite", "midnight", "forestnight"]);
const systemDarkMedia =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function isMacDesktop() {
  const platform = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || "";
  if (typeof platform === "string" && /mac/i.test(platform)) return true;
  const os = globalThis.window?._wails?.environment?.OS;
  return typeof os === "string" && os.toLowerCase() === "darwin";
}

function normalizeAppTheme(value) {
  const normalized = String(value || "coral").trim().toLowerCase();
  return normalized === "custom" || APP_THEMES[normalized] ? normalized : "coral";
}

function normalizeAppThemeMode(value) {
  const normalized = String(value || "system").trim().toLowerCase();
  return APP_THEME_MODES.has(normalized) ? normalized : "system";
}

function normalizeAccentHex(value, fallback = "#c62f2f") {
  const normalized = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function themeAccentRgb(hex) {
  const normalized = normalizeAccentHex(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function resolveAppThemeMode(mode) {
  const normalized = normalizeAppThemeMode(mode);
  if (normalized === "system") return systemDarkMedia?.matches ? "dark" : "light";
  return normalized === "light" ? "light" : "dark";
}

function applyAppTheme(theme, customAccent = "#c62f2f", mode = "system") {
  const normalized = normalizeAppTheme(theme);
  const normalizedMode = normalizeAppThemeMode(mode);
  const resolvedMode = resolveAppThemeMode(normalizedMode);
  const palette =
    normalized === "custom"
      ? { accent: normalizeAccentHex(customAccent), accentRgb: themeAccentRgb(customAccent) }
      : APP_THEMES[normalized];
  document.documentElement.style.setProperty("--accent", palette.accent);
  document.documentElement.style.setProperty("--accent-rgb", palette.accentRgb);
  document.documentElement.dataset.appTheme = normalized;
  document.documentElement.dataset.themeMode = normalizedMode;
  document.documentElement.dataset.themeModeResolved = resolvedMode;
}

export function applyPlatformClassNames() {
  document.documentElement.classList.toggle("platform-macos", isMacDesktop());
  document.documentElement.classList.toggle("platform-windows", isWindowsDesktop());
}

export { isWindowsDesktop };

export async function applyThemeFromSettings() {
  try {
    const settings = await invoke("get_settings");
    applyAppTheme(
      settings?.app_theme ?? settings?.appTheme ?? "coral",
      settings?.app_theme_custom_accent ?? settings?.appThemeCustomAccent ?? "#c62f2f",
      settings?.app_theme_mode ?? settings?.appThemeMode ?? "system"
    );
    const lrclibEnabled = settings?.lyrics_lrclib_enabled !== false;
    const lrclibEl = document.getElementById("lyrics-replace-src-lrclib");
    if (lrclibEl) {
      lrclibEl.disabled = !lrclibEnabled;
      lrclibEl.checked = lrclibEnabled;
    }
  } catch (error) {
    console.warn("get_settings for lyrics replace", error);
  }
}

export function listenSystemThemeChange(callback) {
  if (!systemDarkMedia || typeof systemDarkMedia.addEventListener !== "function") return;
  systemDarkMedia.addEventListener("change", callback);
}
