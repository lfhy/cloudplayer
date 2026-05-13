// Playback-indicator state is shared between transport logic and playlist tables via a lightweight DOM event.
const PLAYBACK_INDICATOR_EVENT = "cloudplayer:playback-indicator-changed";

let currentPlaybackKey = "";
let currentPlaybackPlaying = false;

function normalizePlaybackKey(prefix, value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return `${prefix}:${trimmed}`;
}

export function playbackIndicatorKeyFromQueueItem(item) {
  if (!item || typeof item !== "object") return "";
  return normalizePlaybackKey("sid", item.source_id) || normalizePlaybackKey("file", item.local_path);
}

export function playbackIndicatorKeyFromPlaylistRow(row) {
  if (!row || typeof row !== "object") return "";
  return (
    normalizePlaybackKey("sid", row.pjmp3_source_id) ||
    normalizePlaybackKey("sid", row.source_id) ||
    normalizePlaybackKey("file", row.local_path)
  );
}

function dispatchPlaybackIndicatorChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PLAYBACK_INDICATOR_EVENT, {
      detail: { key: currentPlaybackKey, playing: currentPlaybackPlaying },
    }),
  );
}

export function setPlaybackIndicator(item, playing) {
  currentPlaybackKey = playbackIndicatorKeyFromQueueItem(item);
  currentPlaybackPlaying = !!currentPlaybackKey && !!playing;
  dispatchPlaybackIndicatorChange();
}

export function clearPlaybackIndicator() {
  currentPlaybackKey = "";
  currentPlaybackPlaying = false;
  dispatchPlaybackIndicatorChange();
}

export function applyPlaylistPlaybackIndicator(tbody, rows) {
  if (!tbody) return;
  const rowList = Array.isArray(rows) ? rows : [];
  tbody.querySelectorAll("tr[data-track-row-index]").forEach((tr) => {
    const rowIndex = Number(tr.getAttribute("data-track-row-index") || -1);
    const row = rowIndex >= 0 ? rowList[rowIndex] : null;
    const rowKey = playbackIndicatorKeyFromPlaylistRow(row);
    const isCurrentTrack = !!rowKey && rowKey === currentPlaybackKey;
    tr.dataset.playbackKey = rowKey;
    tr.classList.toggle("is-current-track", isCurrentTrack);
    tr.classList.toggle("is-now-playing", isCurrentTrack && currentPlaybackPlaying);
  });
}

export function bindPlaylistPlaybackIndicator(tbody, getRows) {
  if (!tbody || tbody.dataset.playbackIndicatorBound === "true" || typeof window === "undefined") return;
  tbody.dataset.playbackIndicatorBound = "true";
  window.addEventListener(PLAYBACK_INDICATOR_EVENT, () => {
    const rows = typeof getRows === "function" ? getRows() : [];
    applyPlaylistPlaybackIndicator(tbody, rows);
  });
}
