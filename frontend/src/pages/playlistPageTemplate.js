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
            <button type="button" id="btn-playlist-refresh" class="btn-outline">刷新歌单</button>
            <button type="button" id="btn-playlist-enrich" class="btn-outline">补全播放信息</button>
            <button type="button" id="btn-playlist-rename" class="btn-outline">重命名歌单</button>
          </div>
        </div>
      </div>
      ${trackTableTemplate({ id: "playlist-detail-table", tableClassName: "playlist-table", wrapperClassName: "playlist-table-wrap" })}
    </section>
  `;
}
