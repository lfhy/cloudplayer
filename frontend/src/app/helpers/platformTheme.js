// Platform and theme helpers stay pure so runtime feature modules can reuse them safely.
import {
  APP_THEME_MODES,
  APP_THEMES,
  MUSIC_SOURCE_PROVIDERS,
  NETWORK_PROXY_MODES,
  QUICK_THEME_MODE_LABELS,
  SETTINGS_TABS,
} from "../constants.js";

export const systemDarkMedia =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function isMacDesktop() {
  const platform = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || "";
  if (typeof platform === "string" && /mac/i.test(platform)) return true;
  const os = globalThis.window?._wails?.environment?.OS;
  return typeof os === "string" && os.toLowerCase() === "darwin";
}

export function isWindowsDesktop() {
  const platform = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || "";
  if (typeof platform === "string" && /win/i.test(platform)) return true;
  const os = globalThis.window?._wails?.environment?.OS;
  return typeof os === "string" && os.toLowerCase() === "windows";
}

export function applyPlatformClassNames() {
  document.documentElement.classList.toggle("platform-macos", isMacDesktop());
}

export function normalizeCloseAction(value) {
  return value === "quit" || value === "tray" ? value : "ask";
}

export function normalizeAppTheme(value) {
  const normalized = String(value || "coral").trim().toLowerCase();
  return normalized === "custom" || APP_THEMES[normalized] ? normalized : "coral";
}

export function normalizeAppThemeMode(value) {
  const normalized = String(value || "system").trim().toLowerCase();
  return APP_THEME_MODES.has(normalized) ? normalized : "system";
}

export function normalizeAccentHex(value, fallback = "#c62f2f") {
  const normalized = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

export function normalizeNetworkProxyMode(value) {
  const normalized = String(value || "direct").trim().toLowerCase();
  return NETWORK_PROXY_MODES.has(normalized) ? normalized : "direct";
}

export function normalizeNetworkProxyUrl(value) {
  return String(value || "").trim();
}

export function normalizeSettingsTab(value) {
  const normalized = String(value || "appearance").trim().toLowerCase();
  return SETTINGS_TABS.has(normalized) ? normalized : "appearance";
}

export function normalizeMusicSourceProvider(value) {
  const normalized = String(value || "kugou").trim().toLowerCase();
  return MUSIC_SOURCE_PROVIDERS.has(normalized) ? normalized : "kugou";
}

export function canSaveCustomProxyUrl(value) {
  const normalized = normalizeNetworkProxyUrl(value);
  if (!/^(https?|socks5h?):\/\//i.test(normalized)) return false;
  try {
    const parsed = new URL(normalized);
    return !!parsed.hostname && !!parsed.port;
  } catch {
    return false;
  }
}

export function themeAccentRgb(hex) {
  const normalized = normalizeAccentHex(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export function resolveAppThemeMode(mode) {
  const normalized = normalizeAppThemeMode(mode);
  if (normalized === "system") return systemDarkMedia?.matches ? "dark" : "light";
  return normalized === "light" ? "light" : "dark";
}

export function applyAppTheme(theme, customAccent = "#c62f2f", mode = "system") {
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

export function setThemeCardSelection(theme) {
  document.querySelectorAll("[data-theme-card]").forEach((card) => {
    const active = card.getAttribute("data-theme-card") === theme;
    card.classList.toggle("is-active", active);
    card.setAttribute("aria-checked", active ? "true" : "false");
  });
  const customWrap = document.getElementById("settings-custom-theme");
  if (customWrap) customWrap.hidden = theme !== "custom";
}

export function setThemeModeSelection(mode) {
  document.querySelectorAll("[data-theme-mode-card]").forEach((card) => {
    const active = card.getAttribute("data-theme-mode-card") === mode;
    card.classList.toggle("is-active", active);
    card.setAttribute("aria-checked", active ? "true" : "false");
  });
}

export function setNetworkProxyModeSelection(mode) {
  document.querySelectorAll("[data-network-proxy-mode-card]").forEach((card) => {
    const active = card.getAttribute("data-network-proxy-mode-card") === mode;
    card.classList.toggle("is-active", active);
    card.setAttribute("aria-checked", active ? "true" : "false");
  });
  const customWrap = document.getElementById("settings-network-proxy-custom");
  if (customWrap) customWrap.hidden = mode !== "custom";
}

export function setMusicSourceProviderSelection(provider) {
  document.querySelectorAll("[data-music-source-provider-card]").forEach((card) => {
    const active = card.getAttribute("data-music-source-provider-card") === provider;
    card.classList.toggle("is-active", active);
    card.setAttribute("aria-checked", active ? "true" : "false");
  });
}

export function setSettingsTab(tab) {
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    const active = button.getAttribute("data-settings-tab") === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    const active = panel.getAttribute("data-settings-panel") === tab;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

export function effectiveQuickThemeMode(mode) {
  const normalized = normalizeAppThemeMode(mode);
  if (normalized === "system") return resolveAppThemeMode(normalized) === "dark" ? "dark" : "light";
  return normalized === "light" ? "light" : "dark";
}

export function refreshQuickThemeModeUi(mode, iconSetter) {
  const quickMode = effectiveQuickThemeMode(mode);
  const button = document.getElementById("dock-theme-mode");
  if (!button) return quickMode;
  button.dataset.themeMode = quickMode;
  button.title = QUICK_THEME_MODE_LABELS[quickMode] || QUICK_THEME_MODE_LABELS.light;
  button.setAttribute("aria-label", button.title);
  if (typeof iconSetter === "function") iconSetter(button, quickMode);
  return quickMode;
}

export function nextQuickThemeMode(mode) {
  if (mode === "system") return "light";
  if (mode === "light") return "graphite";
  return "system";
}

export function resolveDarkThemeModeFallback(mode) {
  const normalized = normalizeAppThemeMode(mode);
  if (normalized === "light") return "graphite";
  return normalized === "system" ? "graphite" : normalized;
}
