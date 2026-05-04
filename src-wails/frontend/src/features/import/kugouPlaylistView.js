import { proxyRemoteAssetSrc } from "../../wails/tauri-core.js";

// Kugou playlist preview markup stays isolated so the controller can focus on state and RPC wiring.
export function renderKugouPlaylistCards(host, deps) {
  const { escapeHtml, expandedPreviewID, previewState, rows, selectedIDs } = deps;
  const items = Array.isArray(rows) ? rows : [];
  if (!host) return;
  if (!items.length) {
    host.innerHTML = '<p class="muted">当前没有可导入的酷狗歌单。</p>';
    return;
  }
  host.innerHTML = items.map((row) => {
    const id = Number(row.id || 0);
    const checked = selectedIDs.has(id);
    const cover = row.cover_url || row.coverUrl || row.CoverURL || "";
    const coverSrc = proxyRemoteAssetSrc(cover);
    const suffix = row.track_count ? `${row.track_count} 首` : "歌单";
    const expanded = expandedPreviewID === id;
    const preview = previewState.get(id) || null;
    return `
      <div class="import-kugou-playlist-card${expanded ? " is-expanded" : ""}">
        <div class="import-kugou-playlist-card__body">
          <label class="import-kugou-playlist-card__check">
            <input type="checkbox" class="import-kugou-playlist-row__checkbox" data-kugou-playlist-id="${id}" ${checked ? "checked" : ""} />
            <span>${checked ? "已选中" : "勾选导入"}</span>
          </label>
          <div class="import-kugou-playlist-card__hero">
            <span class="import-kugou-playlist-row__cover">${coverSrc ? `<img src="${coverSrc}" alt="" />` : "♪"}</span>
            <span class="import-kugou-playlist-card__meta">
              <strong>${escapeHtml(row.name || "")}</strong>
              <span class="muted">${escapeHtml(suffix)}</span>
            </span>
          </div>
          <div class="import-kugou-playlist-card__actions">
            <button type="button" class="settings-action-button import-kugou-preview-button${expanded ? " is-active" : ""}" data-kugou-preview-toggle="${id}">
              ${expanded ? "收起预览" : "预览曲目"}
            </button>
          </div>
        </div>
        <section class="import-kugou-preview"${expanded ? "" : " hidden"}>
          ${renderKugouPreviewMarkup(preview, escapeHtml, row.name || "")}
        </section>
      </div>
    `;
  }).join("");
}

function renderKugouPreviewMarkup(preview, escapeHtml, fallbackName) {
  if (!preview || preview.loading) {
    return '<p class="muted">正在加载歌单曲目…</p>';
  }
  if (preview.error) {
    return `<p class="muted">${escapeHtml(preview.error)}</p>`;
  }
  const tracks = Array.isArray(preview.tracks) ? preview.tracks : [];
  if (!tracks.length) {
    return '<p class="muted">当前歌单暂无可预览曲目。</p>';
  }
  const title = escapeHtml(preview.playlistName || fallbackName || "酷狗歌单");
  return `
    <div class="import-kugou-preview__head">
      <strong>${title}</strong>
      <span class="muted">共 ${tracks.length} 首</span>
    </div>
    <div class="import-kugou-preview__list">
      ${tracks.slice(0, 80).map((track, index) => `
        <div class="import-kugou-preview__row">
          <span class="import-kugou-preview__index">${index + 1}</span>
          <span class="import-kugou-preview__meta">
            <strong>${escapeHtml(track.title || "未命名曲目")}</strong>
            <span class="muted">${escapeHtml(formatTrackSubtitle(track))}</span>
          </span>
        </div>
      `).join("")}
    </div>
    ${tracks.length > 80 ? `<p class="muted">已展示前 80 首，导入时会同步完整歌单。</p>` : ""}
  `;
}

function formatTrackSubtitle(track) {
  const artist = String(track.artist || "").trim();
  const album = String(track.album || "").trim();
  if (artist && album) return `${artist} · ${album}`;
  return artist || album || "未知信息";
}
