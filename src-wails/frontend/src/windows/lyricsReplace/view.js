// Lyrics replace DOM helpers keep the controller focused on async flow and state changes.
import { lyricsReplaceState, trackContext } from "./state.js";

export function currentTrackLabel() {
  if (trackContext.artist && trackContext.title) return `${trackContext.artist} · ${trackContext.title}`;
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

function lyricsReplaceSourceLabel(src) {
  const value = String(src || "").toLowerCase();
  if (value === "qq") return "QQ";
  if (value === "kugou") return "酷狗";
  if (value === "netease") return "网易";
  if (value === "lrclib") return "LRCLIB";
  return src || "—";
}

export function getLyricsReplaceSourcesFromChips() {
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

export function setTableMutedMessage(message) {
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

export function setLyricsReplaceError(message) {
  const el = document.getElementById("lyrics-replace-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
    return;
  }
  el.textContent = "";
  el.hidden = true;
}

export function refreshApplyButton() {
  const applyBtn = document.getElementById("lyrics-replace-apply");
  if (!applyBtn) return;
  const hasLyrics = !!String(lyricsReplaceState.previewPayload?.lrcText || "").trim();
  applyBtn.disabled = !hasLyrics || !!lyricsReplaceState.pendingRequestId;
}

export function renderLyricsReplaceTable(onSelect) {
  const tbody = document.getElementById("lyrics-replace-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  for (let i = 0; i < lyricsReplaceState.candidates.length; i += 1) {
    const candidate = lyricsReplaceState.candidates[i];
    const tr = document.createElement("tr");
    tr.dataset.index = String(i);
    if (i === lyricsReplaceState.selectedIndex) tr.classList.add("is-selected");

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
      void onSelect(i);
    });
    tbody.appendChild(tr);
  }
}

export function fillInitialContext() {
  document.getElementById("lyrics-replace-track").textContent = currentTrackLabel();
  const input = document.getElementById("lyrics-replace-keyword");
  if (input && trackContext.keyword) input.value = trackContext.keyword;
  document.title = trackContext.title ? `替换歌词 · ${trackContext.title}` : "替换歌词";
}
