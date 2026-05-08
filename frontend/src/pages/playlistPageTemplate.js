import { fallbackCoverDataUri } from "../app/helpers/covers.js";
import { trackTableTemplate } from "../components/trackTableTemplate.js";

// Playlist detail page keeps stable ids for rename, play-all and table rendering.
export function playlistPageTemplate() {
  const fallbackCover = fallbackCoverDataUri(120, 12);
  return `
    <section class="page" data-page="playlist">
      <div class="playlist-hero">
        <img id="playlist-hero-cover" class="playlist-hero__cover" alt="" width="120" height="120" src="${fallbackCover}" />
        <div class="playlist-hero__meta">
          <h1 class="playlist-hero__title" id="playlist-page-title">歌单</h1>
          <div class="playlist-hero__sub" id="playlist-page-hint"></div>
          <div class="playlist-hero__count" id="playlist-track-count">共 0 首曲目</div>
          <div class="playlist-hero__status muted" id="playlist-enrich-status" aria-live="polite"></div>
          <div class="playlist-hero__actions">
            <button type="button" id="btn-playlist-play-all" class="btn-accent" disabled>▶ 播放全部</button>
            <button type="button" id="btn-playlist-batch-mode" class="btn-accent">批量操作</button>
            <button type="button" id="btn-playlist-select-all" class="btn-accent" hidden>全选</button>
            <button type="button" id="btn-playlist-play-selected" class="btn-accent" hidden>播放所选</button>
            <button type="button" id="btn-playlist-add-selected" class="btn-accent" hidden>添加到歌单</button>
            <button type="button" id="btn-playlist-delete-selected" class="btn-accent" hidden>删除所选</button>
            <button type="button" id="btn-playlist-batch-done" class="btn-accent" hidden>完成</button>
            <button type="button" id="btn-playlist-refresh" class="btn-outline">刷新歌单</button>
            <button type="button" id="btn-playlist-enrich" class="btn-outline">补全播放信息</button>
            <button type="button" id="btn-playlist-rename" class="btn-outline">重命名歌单</button>
          </div>
        </div>
      </div>
      ${trackTableTemplate({ id: "playlist-detail-table", tableClassName: "playlist-table", wrapperClassName: "playlist-table-wrap", includeCheck: true, checkInputId: "playlist-select-all-checkbox" })}
    </section>
  `;
}
