// Lyrics replace controller coordinates candidate search, preview fetch and apply flow.
import { invoke } from "../../wails/tauri-core.js";
import { emitTo, listen } from "../../wails/tauri-event.js";
import { windowTitlebarTemplate, wireWindowChrome } from "../../features/window/chrome.js";
import { CURRENT_WW_LABEL, MAIN_WW, MSG_REQUEST_FAILED, currentWindow } from "./constants.js";
import { lyricsReplaceState, trackContext } from "./state.js";
import {
  fillInitialContext,
  getLyricsReplaceSourcesFromChips,
  refreshApplyButton,
  renderLyricsReplaceTable,
  setLyricsReplaceError,
  setTableMutedMessage,
} from "./view.js";
import { applyPlatformClassNames, applyThemeFromSettings, isWindowsDesktop, listenSystemThemeChange } from "./theme.js";

async function closeWindow() {
  try {
    await currentWindow.Close();
  } catch (error) {
    console.warn("close lyrics-replace window", error);
    window.close();
  }
}

async function selectLyricsReplaceRow(idx) {
  if (idx < 0 || idx >= lyricsReplaceState.candidates.length) return;
  lyricsReplaceState.selectedIndex = idx;
  const gen = ++lyricsReplaceState.fetchGen;
  document.querySelectorAll("#lyrics-replace-tbody tr").forEach((tr, rowIndex) => {
    tr.classList.toggle("is-selected", rowIndex === idx);
  });
  lyricsReplaceState.previewPayload = null;
  lyricsReplaceState.pendingRequestId = "";
  refreshApplyButton();
  const previewEl = document.getElementById("lyrics-replace-preview");
  if (previewEl) previewEl.textContent = "\u52a0\u8f7d\u4e2d...";
  setLyricsReplaceError("");

  try {
    const payload = await invoke("lyrics_fetch_candidate", {
      candidate: lyricsReplaceState.candidates[idx],
    });
    if (gen !== lyricsReplaceState.fetchGen) return;
    lyricsReplaceState.previewPayload = payload;
    if (previewEl) previewEl.textContent = payload?.lrcText != null ? String(payload.lrcText) : "";
    refreshApplyButton();
  } catch (error) {
    console.warn("lyrics_fetch_candidate", error);
    if (gen !== lyricsReplaceState.fetchGen) return;
    lyricsReplaceState.previewPayload = null;
    if (previewEl) previewEl.textContent = "";
    setLyricsReplaceError(MSG_REQUEST_FAILED);
    refreshApplyButton();
  }
}

async function searchLyricsReplaceCandidates() {
  const searchBtn = document.getElementById("lyrics-replace-search-btn");
  if (searchBtn) searchBtn.disabled = true;
  try {
    lyricsReplaceState.fetchGen += 1;
    const keyword = (document.getElementById("lyrics-replace-keyword")?.value || "").trim();
    lyricsReplaceState.selectedIndex = -1;
    lyricsReplaceState.previewPayload = null;
    lyricsReplaceState.pendingRequestId = "";
    document.getElementById("lyrics-replace-preview").textContent = "";
    refreshApplyButton();
    setLyricsReplaceError("");

    if (!keyword) {
      setTableMutedMessage("\u8bf7\u8f93\u5165\u5173\u952e\u8bcd");
      return;
    }
    const sources = getLyricsReplaceSourcesFromChips();
    if (!sources.length) {
      setTableMutedMessage("\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u6765\u6e90");
      return;
    }

    setTableMutedMessage("\u641c\u7d22\u4e2d...");
    try {
      lyricsReplaceState.candidates = await invoke("lyrics_search_candidates", {
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

    renderLyricsReplaceTable(selectLyricsReplaceRow);
    if (lyricsReplaceState.candidates.length > 0) {
      await selectLyricsReplaceRow(0);
      return;
    }
    setTableMutedMessage("\u672a\u627e\u5230\u7ed3\u679c");
    document.getElementById("lyrics-replace-preview").textContent = "\u672a\u627e\u5230\u5339\u914d\u6b4c\u8bcd\uff0c\u8bf7\u6362\u5173\u952e\u8bcd\u6216\u6765\u6e90\u3002";
  } finally {
    if (searchBtn) searchBtn.disabled = false;
  }
}

async function applyLyricsReplace() {
  if (!lyricsReplaceState.previewPayload) return;
  const lrcText = String(lyricsReplaceState.previewPayload.lrcText || "");
  if (!lrcText.trim()) return;
  lyricsReplaceState.applySeq += 1;
  lyricsReplaceState.pendingRequestId = `lyrics-replace-${Date.now()}-${lyricsReplaceState.applySeq}`;
  setLyricsReplaceError("");
  refreshApplyButton();
  try {
    await emitTo(MAIN_WW, "lyrics-replace-apply-request", {
      requestId: lyricsReplaceState.pendingRequestId,
      replyTarget: CURRENT_WW_LABEL,
      trackKey: trackContext.trackKey,
      lyricsPayload: lyricsReplaceState.previewPayload,
    });
  } catch (error) {
    console.warn("lyrics-replace-apply-request", error);
    lyricsReplaceState.pendingRequestId = "";
    setLyricsReplaceError(MSG_REQUEST_FAILED);
    refreshApplyButton();
  }
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
    if (event.key !== "Enter") return;
    event.preventDefault();
    void searchLyricsReplaceCandidates();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    void closeWindow();
  });
}

function wireThemeRefresh() {
  window.addEventListener("focus", () => {
    void applyThemeFromSettings();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void applyThemeFromSettings();
  });
  listenSystemThemeChange(() => {
    void applyThemeFromSettings();
  });
}

function wireApplyResult() {
  void listen("lyrics-replace-apply-result", async (event) => {
    const payload = event?.payload ?? {};
    if (String(payload.requestId || "") !== lyricsReplaceState.pendingRequestId) return;
    lyricsReplaceState.pendingRequestId = "";
    if (payload.ok) {
      await closeWindow();
      return;
    }
    setLyricsReplaceError(String(payload.message || MSG_REQUEST_FAILED));
    refreshApplyButton();
  });
}

export function bootstrapLyricsReplaceWindow() {
  document.addEventListener("DOMContentLoaded", () => {
    applyPlatformClassNames();
    if (!isWindowsDesktop()) {
      document.querySelector(".lyrics-window__shell")?.insertAdjacentHTML(
        "afterbegin",
        windowTitlebarTemplate({
          title: "\u66ff\u6362\u6b4c\u8bcd",
          allowMinimize: false,
          allowMaximize: false,
          className: "app-titlebar--child app-titlebar--lyrics",
        })
      );
      wireWindowChrome({ windowName: CURRENT_WW_LABEL, allowMinimize: false, allowMaximize: false });
    }
    fillInitialContext();
    wireLyricsReplaceWindow();
    wireThemeRefresh();
    wireApplyResult();
    setTableMutedMessage(trackContext.keyword ? "\u6b63\u5728\u51c6\u5907\u641c\u7d22..." : "\u8f93\u5165\u5173\u952e\u8bcd\u540e\u70b9\u51fb\u201c\u641c\u7d22\u201d");
    void applyThemeFromSettings();
    window.setTimeout(() => {
      document.getElementById("lyrics-replace-keyword")?.focus();
    }, 30);
    if (trackContext.keyword) void searchLyricsReplaceCandidates();
  });
}
