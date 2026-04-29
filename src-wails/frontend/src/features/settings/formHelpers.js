// Settings form helpers keep normalization and baseline defaults separate from controller side effects.
export const DEFAULT_LYRICS_IDLE_LINE1 = "播放完成";
export const DEFAULT_LYRICS_IDLE_LINE2 = "选择下一首继续聆听";

export function settingsFormBaselineDefaults() {
  return {
    theme: "coral",
    mode: "system",
    customAccent: "#c62f2f",
    proxyMode: "direct",
    proxyURL: "",
    action: "ask",
    base: "#ffffff",
    highlight: "#ffb7d4",
    idleLine1: DEFAULT_LYRICS_IDLE_LINE1,
    idleLine2: DEFAULT_LYRICS_IDLE_LINE2,
    neteaseApiBase: "",
    musicSourceProvider: "pjmp3",
    searchCacheTTLHours: 24,
    hotkeysSig: "",
  };
}

export function normalizeLyricHexInput(value, fallback) {
  const normalized = (value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback;
}

export function normalizeNeteaseApiBase(raw) {
  return String(raw ?? "").trim();
}

export function normalizeSearchCacheTTLHours(raw) {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) return 24;
  return Math.min(720, Math.max(1, parsed));
}

export function normalizeLyricsIdleLine(raw, fallback) {
  const value = String(raw ?? "").trim();
  if (!value) return fallback;
  return Array.from(value).slice(0, 36).join("").trim() || fallback;
}

