import { Window as RuntimeWindow } from "@wailsio/runtime";
import { invoke } from "./wails/tauri-core.js";
import { emitTo, listen } from "./wails/tauri-event.js";
import "./styles.css";

const MAIN_WW = { kind: "WebviewWindow", label: "main" };
const CURRENT_WW_LABEL = "lyrics-replace";
const currentWindow = RuntimeWindow.Get(CURRENT_WW_LABEL);
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
const MSG_REQUEST_FAILED = "请求失败";

const trackContext = readTrackContext();

let lyricsReplaceCandidates = [];
let lyricsReplaceSelectedIndex = -1;
let lyricsReplacePreviewPayload = null;
let lyricsReplaceFetchGen = 0;
let lyricsReplacePendingRequestId = "";
let lyricsReplaceApplySeq = 0;

function isMacDesktop() {
  const platform =
    globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || "";
  if (typeof platform === "string" && /mac/i.test(platform)) {
    return true;
  }
  const os = globalThis.window?._wails?.environment?.OS;
  return typeof os === "string" && os.toLowerCase() === "darwin";
}

function applyPlatformClassNames() {
  document.documentElement.classList.toggle("platform-macos", isMacDesktop());
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

function readTrackContext() {
  const params = new URLSearchParams(window.location.search);
  const durationMs = Number(params.get("durationMs") || "");
  const title = params.get("title") || "";
  const artist = params.get("artist") || "";
  const keyword = (params.get("keyword") || `${artist} ${title}`).trim();
  return {
    keyword,
    title,
    artist,
    album: params.get("album") || "",
    trackKey: params.get("trackKey") || "",
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : null,
  };
}

function currentTrackLabel() {
  if (trackContext.artist && trackContext.title) {
    return `${trackContext.artist} · ${trackContext.title}`;
  }
  if (trackContext.title) return trackContext.title;
  return "未锁定当前曲目";
}

function formatTime(sec) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDurationMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "--";
  return formatTime(n / 1000);
}

function setTableMutedMessage(message) {
  const tbody = document.getElementById("lyrics-replace-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 4;
  td.className = "muted";
  td.textContent = message;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function lyricsReplaceSourceLabel(src) {
  const value = String(src || "").toLowerCase();
  if (value === "qq") return "QQ";
  if (value === "kugou") return "酷狗";
  if (value === "netease") return "网易";
  if (value === "lrclib") return "LRCLIB";
  return src || "—";
}

function getLyricsReplaceSourcesFromChips() {
  const keys = [
    ["qq", "lyrics-replace-src-qq"],
    ["kugou", "lyrics-replace-src-kugou"],
    ["netease", "lyrics-replace-src-netease"],
    ["lrclib", "lyrics-replace-src-lrclib"],
  ];
  const out = [];
  for (const [id, elId] of keys) {
    const el = document.getElementById(elId);
    if (el && !el.disabled && el.checked) out.push(id);
  }
  return out;
}

function setLyricsReplaceError(message) {
  const el = document.getElementById("lyrics-replace-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}

function refreshApplyButton() {
  const applyBtn = document.getElementById("lyrics-replace-apply");
  if (!applyBtn) return;
  const hasLyrics = !!String(lyricsReplacePreviewPayload?.lrcText || "").trim();
  applyBtn.disabled = !hasLyrics || !!lyricsReplacePendingRequestId;
}

async function applyThemeFromSettings() {
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

function renderLyricsReplaceTable() {
  const tbody = document.getElementById("lyrics-replace-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  for (let i = 0; i < lyricsReplaceCandidates.length; i += 1) {
    const candidate = lyricsReplaceCandidates[i];
    const tr = document.createElement("tr");
    tr.dataset.index = String(i);
    if (i === lyricsReplaceSelectedIndex) tr.classList.add("is-selected");

    const tdSrc = document.createElement("td");
    tdSrc.className = "col-lr-src";
    tdSrc.textContent = lyricsReplaceSourceLabel(candidate.source);

    const tdTitle = document.createElement("td");
    tdTitle.textContent = candidate.title || "—";

    const tdArtist = document.createElement("td");
    tdArtist.textContent = candidate.artist || "—";

    const tdDur = document.createElement("td");
    tdDur.className = "col-lr-dur";
    tdDur.textContent = formatDurationMs(candidate.durationMs);

    tr.append(tdSrc, tdTitle, tdArtist, tdDur);
    tr.addEventListener("click", () => {
      void selectLyricsReplaceRow(i);
    });
    tbody.appendChild(tr);
  }
}

async function searchLyricsReplaceCandidates() {
  const searchBtn = document.getElementById("lyrics-replace-search-btn");
  if (searchBtn) searchBtn.disabled = true;
  try {
    lyricsReplaceFetchGen += 1;
    const keyword = (document.getElementById("lyrics-replace-keyword")?.value || "").trim();
    lyricsReplaceSelectedIndex = -1;
    lyricsReplacePreviewPayload = null;
    lyricsReplacePendingRequestId = "";
    document.getElementById("lyrics-replace-preview").textContent = "";
    refreshApplyButton();
    setLyricsReplaceError("");

    if (!keyword) {
      setTableMutedMessage("请输入关键词");
      return;
    }
    const sources = getLyricsReplaceSourcesFromChips();
    if (!sources.length) {
      setTableMutedMessage("请至少选择一个来源");
      return;
    }

    setTableMutedMessage("搜索中…");
    try {
      lyricsReplaceCandidates = await invoke("lyrics_search_candidates", {
        keyword,
        durationMs: trackContext.durationMs,
        sources,
      });
    } catch (error) {
      console.warn("lyrics_search_candidates", error);
      setTableMutedMessage(MSG_REQUEST_FAILED);
      setLyricsReplaceError(MSG_REQUEST_FAILED);
      return;
    }

    renderLyricsReplaceTable();
    if (lyricsReplaceCandidates.length > 0) {
      await selectLyricsReplaceRow(0);
      return;
    }
    setTableMutedMessage("未找到结果");
    document.getElementById("lyrics-replace-preview").textContent = "未找到匹配歌词，请换关键词或来源。";
  } finally {
    if (searchBtn) searchBtn.disabled = false;
  }
}

async function selectLyricsReplaceRow(idx) {
  if (idx < 0 || idx >= lyricsReplaceCandidates.length) return;
  lyricsReplaceSelectedIndex = idx;
  const gen = ++lyricsReplaceFetchGen;
  document.querySelectorAll("#lyrics-replace-tbody tr").forEach((tr, rowIndex) => {
    tr.classList.toggle("is-selected", rowIndex === idx);
  });
  lyricsReplacePreviewPayload = null;
  lyricsReplacePendingRequestId = "";
  refreshApplyButton();
  const previewEl = document.getElementById("lyrics-replace-preview");
  if (previewEl) previewEl.textContent = "加载中…";
  setLyricsReplaceError("");

  try {
    const payload = await invoke("lyrics_fetch_candidate", {
      candidate: lyricsReplaceCandidates[idx],
    });
    if (gen !== lyricsReplaceFetchGen) return;
    lyricsReplacePreviewPayload = payload;
    if (previewEl) previewEl.textContent = payload?.lrcText != null ? String(payload.lrcText) : "";
    refreshApplyButton();
  } catch (error) {
    console.warn("lyrics_fetch_candidate", error);
    if (gen !== lyricsReplaceFetchGen) return;
    lyricsReplacePreviewPayload = null;
    if (previewEl) previewEl.textContent = "";
    setLyricsReplaceError(MSG_REQUEST_FAILED);
    refreshApplyButton();
  }
}

async function closeWindow() {
  try {
    await currentWindow.Close();
  } catch (error) {
    console.warn("close lyrics-replace window", error);
    window.close();
  }
}

async function applyLyricsReplace() {
  if (!lyricsReplacePreviewPayload) return;
  const lrcText = String(lyricsReplacePreviewPayload.lrcText || "");
  if (!lrcText.trim()) return;
  lyricsReplaceApplySeq += 1;
  lyricsReplacePendingRequestId = `lyrics-replace-${Date.now()}-${lyricsReplaceApplySeq}`;
  setLyricsReplaceError("");
  refreshApplyButton();
  try {
    await emitTo(MAIN_WW, "lyrics-replace-apply-request", {
      requestId: lyricsReplacePendingRequestId,
      replyTarget: CURRENT_WW_LABEL,
      trackKey: trackContext.trackKey,
      lyricsPayload: lyricsReplacePreviewPayload,
    });
  } catch (error) {
    console.warn("lyrics-replace-apply-request", error);
    lyricsReplacePendingRequestId = "";
    setLyricsReplaceError(MSG_REQUEST_FAILED);
    refreshApplyButton();
  }
}

function fillInitialContext() {
  document.getElementById("lyrics-replace-track").textContent = currentTrackLabel();
  const input = document.getElementById("lyrics-replace-keyword");
  if (input && trackContext.keyword) {
    input.value = trackContext.keyword;
  }
  document.title = trackContext.title ? `替换歌词 · ${trackContext.title}` : "替换歌词";
}

function wireLyricsReplaceWindow() {
  document.getElementById("lyrics-replace-search-btn")?.addEventListener("click", () => {
    void searchLyricsReplaceCandidates();
  });
  document.getElementById("lyrics-replace-close")?.addEventListener("click", () => {
    void closeWindow();
  });
  document.getElementById("lyrics-replace-apply")?.addEventListener("click", () => {
    void applyLyricsReplace();
  });
  document.getElementById("lyrics-replace-keyword")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void searchLyricsReplaceCandidates();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void closeWindow();
    }
  });
}

void listen("lyrics-replace-apply-result", async (event) => {
  const payload = event?.payload ?? {};
  if (String(payload.requestId || "") !== lyricsReplacePendingRequestId) return;
  lyricsReplacePendingRequestId = "";
  if (payload.ok) {
    await closeWindow();
    return;
  }
  setLyricsReplaceError(String(payload.message || MSG_REQUEST_FAILED));
  refreshApplyButton();
});

window.addEventListener("focus", () => {
  void applyThemeFromSettings();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void applyThemeFromSettings();
});

if (systemDarkMedia && typeof systemDarkMedia.addEventListener === "function") {
  systemDarkMedia.addEventListener("change", () => {
    void applyThemeFromSettings();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyPlatformClassNames();
  fillInitialContext();
  wireLyricsReplaceWindow();
  setTableMutedMessage(trackContext.keyword ? "正在准备搜索…" : "输入关键词后点击“搜索”");
  void applyThemeFromSettings();
  window.setTimeout(() => {
    document.getElementById("lyrics-replace-keyword")?.focus();
  }, 30);
  if (trackContext.keyword) {
    void searchLyricsReplaceCandidates();
  }
});
