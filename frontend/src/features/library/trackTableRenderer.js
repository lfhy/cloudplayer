import {
  applyPlaybackIndicator,
  bindPlaybackIndicator,
  playbackIndicatorKeyFromPlaylistRow,
} from "../../app/helpers/playbackIndicator.js";
import {
  bindTrackTableCellActions,
  buildTrackAlbumCell,
  buildTrackCoverCell,
  buildTrackFavoriteCell,
  buildTrackTitleCell,
  refreshTrackFavoriteCell,
} from "./trackTableCells.js";

// Shared playlist-style track table renderer keeps daily and playlist rows visually consistent.
let getLikedIdsRef = () => new Set();
let favoriteRefreshBound = false;

function refreshFavoriteCells(root = document) {
  root.querySelectorAll("[data-like-source-id]").forEach((cell) => {
    refreshTrackFavoriteCell(cell, getLikedIdsRef);
  });
}

function bindFavoriteRefresh() {
  if (favoriteRefreshBound || typeof window === "undefined") return;
  favoriteRefreshBound = true;
  window.addEventListener("cloudplayer:favorites-changed", () => refreshFavoriteCells());
}

export function renderTrackTableRows(tbody, rows, options) {
  const {
    emptyMessage,
    escapeHtml,
    formatDurationMs,
    batchMode = false,
    forceLiked,
    getRowSelectionKey,
    getLikedIds,
    highlightPlayback = false,
    includeCheck = false,
    isSelected,
    onAlbumClick,
    onArtistClick,
    onClick,
    onContextMenu,
    onDoubleClick,
    onFavoriteClick,
    onToggleSelected,
    rowTitle,
  } = options;
  if (!tbody) return;
  getLikedIdsRef = typeof getLikedIds === "function" ? getLikedIds : () => new Set();
  bindFavoriteRefresh();
  if (!rows.length) {
    const colspan = 4 + (includeCheck ? 1 : 0) + (typeof onFavoriteClick === "function" ? 1 : 0);
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="muted">${escapeHtml(emptyMessage)}</td></tr>`;
    return;
  }
  const likedIds = typeof getLikedIds === "function" ? getLikedIds() : new Set();
  tbody.innerHTML = "";
  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.dataset.trackRowIndex = String(index);
    if (highlightPlayback) tr.dataset.playbackKey = playbackIndicatorKeyFromPlaylistRow(row);
    const canFavorite = typeof onFavoriteClick === "function";
    const selectionKey = typeof getRowSelectionKey === "function" ? getRowSelectionKey(row, index) : String(row?.id ?? index);
    const selected = typeof isSelected === "function" ? isSelected(row, index) : false;
    tr.innerHTML = `
      ${includeCheck ? `<td class="col-check"><label class="search-row-check"><input type="checkbox" data-track-select-row="${escapeHtml(selectionKey)}" ${selected ? "checked" : ""} aria-label="选择 ${escapeHtml(row?.title || "曲目")}" /></label></td>` : ""}
      <td class="col-cover">${buildTrackCoverCell(row)}</td>
      <td>${buildTrackTitleCell(row, escapeHtml, { onArtistClick })}</td>
      <td class="muted">${buildTrackAlbumCell(row, escapeHtml, { onAlbumClick })}</td>
      ${buildTrackFavoriteCell(row, escapeHtml, { forceLiked, getLikedIds: () => likedIds, interactive: canFavorite })}
      <td class="muted col-dur">${formatDurationMs(row.duration_ms)}</td>`;
    tr.classList.toggle("is-selected", selected);
    tr.classList.toggle("is-batch-mode", batchMode);
    tr.style.cursor = batchMode || row.playable ? "pointer" : "default";
    const title = typeof rowTitle === "function" ? rowTitle(row, index) : "";
    if (title) tr.title = title;
    if (batchMode && typeof onToggleSelected === "function") {
      tr.addEventListener("click", (event) => {
        if (event.target instanceof HTMLInputElement) return;
        onToggleSelected(row, index, !selected);
      });
    } else if (row.playable && typeof onClick === "function") {
      tr.addEventListener("click", () => onClick(index, row));
    }
    if (typeof onArtistClick === "function" && row.artist) {
      tr.querySelector("[data-table-artist]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onArtistClick(row.artist, row, index);
      });
    }
    if (typeof onAlbumClick === "function" && row.album) {
      tr.querySelector("[data-table-album]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onAlbumClick(row.album, row, index);
      });
    }
    if (includeCheck && typeof onToggleSelected === "function") {
      tr.querySelector(`[data-track-select-row="${CSS.escape(selectionKey)}"]`)?.addEventListener("change", (event) => {
        const target = event.currentTarget;
        onToggleSelected(row, index, target instanceof HTMLInputElement && target.checked);
      });
    }
    if (row.playable && typeof onDoubleClick === "function" && !batchMode) {
      tr.addEventListener("dblclick", () => onDoubleClick(index, row));
    }
    bindTrackTableCellActions(tr, row, index, { onAlbumClick, onArtistClick, onFavoriteClick });
    if (typeof onContextMenu === "function") {
      tr.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        onContextMenu(event, index, row);
      });
    }
    tbody.appendChild(tr);
  });
  if (highlightPlayback) {
    bindPlaybackIndicator(tbody);
    applyPlaybackIndicator(tbody);
  }
  refreshFavoriteCells(tbody);
}
