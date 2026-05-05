import { fallbackCoverDataUri } from "../app/helpers/covers.js";
import { iconSvgByName } from "../app/helpers/icons.js";

// Immersive player template renders the large two-column listening experience overlay.
export function immersivePlayerTemplate() {
  const fallbackCover = fallbackCoverDataUri(320, 32);
  const collapseIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  `;
  return `
    <section id="immersive-player" class="immersive-player" hidden aria-hidden="true">
      <div class="immersive-player__backdrop"></div>
      <div class="immersive-player__content">
        <button type="button" id="btn-immersive-close" class="immersive-player__close" aria-label="收起沉浸模式" title="收起沉浸模式">${collapseIcon}</button>
        <div class="immersive-player__panel immersive-player__panel--meta">
          <div class="immersive-player__cover-wrap">
            <img id="immersive-cover" class="immersive-player__cover" src="${fallbackCover}" alt="" width="320" height="320" />
          </div>
          <div class="immersive-player__meta">
            <div id="immersive-title" class="immersive-player__title">未播放</div>
            <div id="immersive-artist" class="immersive-player__artist">选择曲目开始播放</div>
            <div id="immersive-album" class="immersive-player__album">在这里查看歌词沉浸模式</div>
          </div>
          <div class="immersive-player__transport">
            <button type="button" id="btn-immersive-prev" class="immersive-player__transport-btn" aria-label="上一首">⏮</button>
            <button type="button" id="btn-immersive-play" class="immersive-player__transport-btn immersive-player__transport-btn--main" aria-label="播放">${iconSvgByName("play-bold")}</button>
            <button type="button" id="btn-immersive-next" class="immersive-player__transport-btn" aria-label="下一首">⏭</button>
          </div>
          <div class="immersive-player__progress">
            <span id="immersive-time-current" class="immersive-player__time">0:00</span>
            <input type="range" id="immersive-seek" class="immersive-player__seek" min="0" max="1000" step="1" value="0" disabled aria-label="播放进度" />
            <span id="immersive-time-total" class="immersive-player__time">0:00</span>
          </div>
        </div>
        <div class="immersive-player__panel immersive-player__panel--lyrics">
          <div id="immersive-lyrics" class="immersive-player__lyrics" aria-live="polite">
            <p class="immersive-player__lyrics-empty">歌词会在播放时显示在这里</p>
          </div>
        </div>
      </div>
    </section>
  `;
}
