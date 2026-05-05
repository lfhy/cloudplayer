import { coverImgHtml } from "../../app/helpers/covers.js";

// Shared playlist-style track table renderer keeps daily and playlist rows visually consistent.
export function renderTrackTableRows(tbody, rows, options) {
  const {
    emptyMessage,
    escapeHtml,
    formatDurationMs,
    getLikedIds,
    onClick,
    onContextMenu,
    onDoubleClick,
    rowTitle,
  } = options;
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">${escapeHtml(emptyMessage)}</td></tr>`;
    return;
  }
  const likedIds = typeof getLikedIds === "function" ? getLikedIds() : new Set();
  tbody.innerHTML = "";
  rows.forEach((row, index) => {
    const likeSourceId = String(row.like_source_id || "").trim();
    const cover = coverImgHtml({ src: row.cover_url || "", className: "row-cover", width: 40, height: 40, radius: 4 });
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-cover">${cover}</td>
      <td>${row.artist ? `<span class="t-title">${escapeHtml(row.title || "—")}</span><span class="t-art">${escapeHtml(row.artist)}</span>` : `<span class="t-title">${escapeHtml(row.title || "—")}</span>`}</td>
      <td class="muted">${escapeHtml(row.album || "—")}</td>
      <td class="col-like muted">${likeSourceId && likedIds.has(likeSourceId) ? "♥" : "♡"}</td>
      <td class="muted col-dur">${formatDurationMs(row.duration_ms)}</td>`;
    tr.style.cursor = row.playable ? "pointer" : "default";
    const title = typeof rowTitle === "function" ? rowTitle(row, index) : "";
    if (title) tr.title = title;
    if (row.playable && typeof onClick === "function") {
      tr.addEventListener("click", () => onClick(index, row));
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
}
