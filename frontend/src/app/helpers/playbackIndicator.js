// Playback-indicator state is shared between transport logic and track lists via a lightweight DOM event.
const PLAYBACK_INDICATOR_EVENT = "cloudplayer:playback-indicator-changed";
const PLAYBACK_INDICATOR_SELECTOR = "[data-playback-key]";

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

export function isCurrentPlaybackRow(row) {
  const rowKey = playbackIndicatorKeyFromPlaylistRow(row);
  return !!rowKey && rowKey === currentPlaybackKey;
}

export function applyPlaybackIndicator(root) {
  if (!root) return;
  root.querySelectorAll(PLAYBACK_INDICATOR_SELECTOR).forEach((node) => {
    const rowKey = String(node.getAttribute("data-playback-key") || "").trim();
    const isCurrentTrack = !!rowKey && rowKey === currentPlaybackKey;
    node.classList.toggle("is-current-track", isCurrentTrack);
    node.classList.toggle("is-now-playing", isCurrentTrack && currentPlaybackPlaying);
  });
}

export function bindPlaybackIndicator(root) {
  if (!root || root.dataset.playbackIndicatorBound === "true" || typeof window === "undefined") return;
  root.dataset.playbackIndicatorBound = "true";
  window.addEventListener(PLAYBACK_INDICATOR_EVENT, () => {
    applyPlaybackIndicator(root);
  });
}

export function applyPlaylistPlaybackIndicator(tbody, rows) {
  if (!tbody) return;
  const rowList = Array.isArray(rows) ? rows : [];
  tbody.querySelectorAll("tr[data-track-row-index]").forEach((tr) => {
    const rowIndex = Number(tr.getAttribute("data-track-row-index") || -1);
    tr.dataset.playbackKey = playbackIndicatorKeyFromPlaylistRow(rowIndex >= 0 ? rowList[rowIndex] : null);
  });
  applyPlaybackIndicator(tbody);
}

export function bindPlaylistPlaybackIndicator(tbody, getRows) {
  bindPlaybackIndicator(tbody);
  if (!tbody || typeof getRows !== "function" || tbody.dataset.playbackRowsBound === "true" || typeof window === "undefined") return;
  tbody.dataset.playbackRowsBound = "true";
  window.addEventListener(PLAYBACK_INDICATOR_EVENT, () => {
    applyPlaylistPlaybackIndicator(tbody, getRows());
  });
}
