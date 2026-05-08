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
    forceLiked,
    getLikedIds,
    onAlbumClick,
    onArtistClick,
    onClick,
    onContextMenu,
    onDoubleClick,
    onFavoriteClick,
    rowTitle,
  } = options;
  if (!tbody) return;
  getLikedIdsRef = typeof getLikedIds === "function" ? getLikedIds : () => new Set();
  bindFavoriteRefresh();
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">${escapeHtml(emptyMessage)}</td></tr>`;
    return;
  }
  const likedIds = typeof getLikedIds === "function" ? getLikedIds() : new Set();
  tbody.innerHTML = "";
  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.dataset.trackRowIndex = String(index);
    const canFavorite = typeof onFavoriteClick === "function";
    tr.innerHTML = `
      <td class="col-cover">${buildTrackCoverCell(row)}</td>
      <td>${buildTrackTitleCell(row, escapeHtml, { onArtistClick })}</td>
      <td class="muted">${buildTrackAlbumCell(row, escapeHtml, { onAlbumClick })}</td>
      ${buildTrackFavoriteCell(row, escapeHtml, { forceLiked, getLikedIds: () => likedIds, interactive: canFavorite })}
      <td class="muted col-dur">${formatDurationMs(row.duration_ms)}</td>`;
    tr.style.cursor = row.playable ? "pointer" : "default";
    const title = typeof rowTitle === "function" ? rowTitle(row, index) : "";
    if (title) tr.title = title;
    if (row.playable && typeof onClick === "function") {
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
    if (row.playable && typeof onDoubleClick === "function") {
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
  refreshFavoriteCells(tbody);
}
