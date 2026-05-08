import { coverImgHtml } from "../../app/helpers/covers.js";
import { favoriteIconSvg } from "../../app/helpers/icons.js";

// Shared playlist-style track table renderer keeps daily and playlist rows visually consistent.
let getLikedIdsRef = () => new Set();
let favoriteRefreshBound = false;

function refreshFavoriteCells(root = document) {
  const likedIds = typeof getLikedIdsRef === "function" ? getLikedIdsRef() : new Set();
  root.querySelectorAll("[data-like-source-id]").forEach((cell) => {
    const sourceId = String(cell.getAttribute("data-like-source-id") || "").trim();
    const forceLiked = cell.getAttribute("data-force-liked") === "true";
    const liked = forceLiked || (sourceId && likedIds.has(sourceId));
    cell.classList.toggle("is-liked", liked);
    cell.classList.toggle("muted", !liked);
    cell.innerHTML = favoriteIconSvg(liked);
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
    const likeSourceId = String(row.like_source_id || "").trim();
    const liked = !!forceLiked || (likeSourceId && likedIds.has(likeSourceId));
    const cover = coverImgHtml({ src: row.cover_url || "", className: "row-cover", width: 40, height: 40, radius: 4 });
    const artistText = escapeHtml(row.artist || "—");
    const albumText = escapeHtml(row.album || "—");
    const artistHtml = row.artist && typeof onArtistClick === "function"
      ? `<button type="button" class="table-inline-action table-inline-action--artist" data-table-artist="${artistText}">${artistText}</button>`
      : artistText;
    const albumHtml = row.album && typeof onAlbumClick === "function"
      ? `<button type="button" class="table-inline-action table-inline-action--album" data-table-album="${albumText}">${albumText}</button>`
      : albumText;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-cover">${cover}</td>
      <td>${row.artist ? `<span class="t-title">${escapeHtml(row.title || "—")}</span><span class="t-art">${artistHtml}</span>` : `<span class="t-title">${escapeHtml(row.title || "—")}</span>`}</td>
      <td class="muted">${albumHtml}</td>
      <td class="col-like${liked ? " is-liked" : " muted"}" data-like-source-id="${escapeHtml(likeSourceId)}" data-force-liked="${forceLiked ? "true" : "false"}">${favoriteIconSvg(liked)}</td>
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
