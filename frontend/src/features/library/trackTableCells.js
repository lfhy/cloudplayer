import { coverImgHtml } from "../../app/helpers/covers.js";
import { favoriteIconSvg } from "../../app/helpers/icons.js";

// Shared track-table cells keep cover rows, inline search buttons, and favorite buttons aligned.
function likedStateForRow(row, getLikedIds, forceLiked = false) {
  const likedIds = typeof getLikedIds === "function" ? getLikedIds() : new Set();
  const likeSourceId = String(row?.like_source_id || row?.source_id || row?.pjmp3_source_id || "").trim();
  return {
    forceLiked: !!forceLiked,
    likeSourceId,
    liked: !!forceLiked || (likeSourceId && likedIds.has(likeSourceId)),
  };
}

function favoriteButtonTitle(likeSourceId, liked, disabled) {
  if (disabled || !likeSourceId) return "本地文件无曲库 id，不支持喜欢";
  return liked ? "从「我喜欢」移除" : "添加到「我喜欢」";
}

export function buildTrackCoverCell(row) {
  return coverImgHtml({
    src: row?.cover_url || "",
    className: "row-cover",
    width: 40,
    height: 40,
    radius: 4,
  });
}

export function buildTrackTitleCell(row, escapeHtml, options = {}) {
  const title = escapeHtml(row?.title || "—");
  const artist = String(row?.artist || "").trim();
  if (!artist) return `<span class="t-title">${title}</span>`;
  const artistHtml = typeof options.onArtistClick === "function"
    ? `<button type="button" class="table-inline-action table-inline-action--artist" data-track-artist="${escapeHtml(artist)}">${escapeHtml(artist)}</button>`
    : escapeHtml(artist);
  return `<span class="t-title">${title}</span><span class="t-art">${artistHtml}</span>`;
}

export function buildTrackAlbumCell(row, escapeHtml, options = {}) {
  const album = String(row?.album || "").trim();
  if (!album) return "—";
  return typeof options.onAlbumClick === "function"
    ? `<button type="button" class="table-inline-action table-inline-action--album" data-track-album="${escapeHtml(album)}">${escapeHtml(album)}</button>`
    : escapeHtml(album);
}

export function buildTrackFavoriteCell(row, escapeHtml, options = {}) {
  const { forceLiked = false, getLikedIds, interactive = false } = options;
  const { likeSourceId, liked } = likedStateForRow(row, getLikedIds, forceLiked);
  const disabled = !interactive || !likeSourceId || !!row?.local_path;
  const label = escapeHtml(favoriteButtonTitle(likeSourceId, liked, disabled));
  const button = interactive
    ? `<button type="button" class="table-favorite-button${liked ? " is-liked" : ""}" data-table-favorite aria-pressed="${liked ? "true" : "false"}" title="${label}" aria-label="${label}" ${disabled ? "disabled" : ""}>${favoriteIconSvg(liked)}</button>`
    : favoriteIconSvg(liked);
  return `<td class="col-like${liked ? " is-liked" : " muted"}" data-like-source-id="${escapeHtml(likeSourceId)}" data-force-liked="${forceLiked ? "true" : "false"}">${button}</td>`;
}

export function bindTrackTableCellActions(root, row, index, options = {}) {
  if (typeof options.onArtistClick === "function" && row?.artist) {
    root.querySelector("[data-track-artist]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.onArtistClick(row.artist, row, index);
    });
  }
  if (typeof options.onAlbumClick === "function" && row?.album) {
    root.querySelector("[data-track-album]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.onAlbumClick(row.album, row, index);
    });
  }
  if (typeof options.onFavoriteClick === "function") {
    root.querySelector("[data-table-favorite]")?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await options.onFavoriteClick(row, index, event);
    });
  }
}

export function refreshTrackFavoriteCell(cell, getLikedIds) {
  if (!cell) return;
  const likeSourceId = String(cell.getAttribute("data-like-source-id") || "").trim();
  const forceLiked = cell.getAttribute("data-force-liked") === "true";
  const likedIds = typeof getLikedIds === "function" ? getLikedIds() : new Set();
  const liked = forceLiked || (likeSourceId && likedIds.has(likeSourceId));
  const button = cell.querySelector("[data-table-favorite]");
  cell.classList.toggle("is-liked", liked);
  cell.classList.toggle("muted", !liked);
  if (!button) {
    cell.innerHTML = favoriteIconSvg(liked);
    return;
  }
  const disabled = button.disabled;
  const label = favoriteButtonTitle(likeSourceId, liked, disabled);
  button.classList.toggle("is-liked", liked);
  button.setAttribute("aria-pressed", liked ? "true" : "false");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = favoriteIconSvg(liked);
}
