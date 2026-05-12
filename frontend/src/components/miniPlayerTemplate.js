import { fallbackCoverDataUri } from "../app/helpers/covers.js";
import { miniExitIcon, miniNextIcon, miniPinIcon, miniPlayIcon, miniPrevIcon, miniTranslucentIcon } from "./miniPlayerIcons.js";

// Mini player template keeps the compact shell declarative and separate from runtime wiring.
export function miniPlayerTemplate() {
  const fallbackCover = fallbackCoverDataUri(64, 14);
  return `
    <section id="mini-player" class="mini-player" aria-hidden="true" hidden>
      <div class="mini-player__shell">
        <div class="mini-player__dragbar" aria-hidden="true"></div>
        <header class="mini-player__header">
          <div class="mini-player__meta">
            <img id="mini-cover" class="mini-player__cover" width="64" height="64" alt="" src="${fallbackCover}" />
            <div class="mini-player__copy">
              <div id="mini-title" class="mini-player__title">未播放</div>
              <div id="mini-sub" class="mini-player__sub">选择曲目后可进入歌词 Mini 模式</div>
            </div>
          </div>
          <div class="mini-player__actions">
            <button type="button" id="btn-mini-prev" class="mini-player__btn" title="上一首" aria-label="上一首">${miniPrevIcon()}</button>
            <button type="button" id="btn-mini-play" class="mini-player__btn mini-player__btn--main" title="播放" aria-label="播放">${miniPlayIcon()}</button>
            <button type="button" id="btn-mini-next" class="mini-player__btn" title="下一首" aria-label="下一首">${miniNextIcon()}</button>
            <button type="button" id="btn-mini-pin" class="mini-player__icon" title="开启 Mini 置顶" aria-label="开启 Mini 置顶" aria-pressed="false">${miniPinIcon()}</button>
            <button type="button" id="btn-mini-translucent" class="mini-player__icon" title="开启 Mini 半透明" aria-label="开启 Mini 半透明" aria-pressed="false">${miniTranslucentIcon()}</button>
            <button type="button" id="btn-mini-exit" class="mini-player__icon" title="退出 Mini 模式" aria-label="退出 Mini 模式">${miniExitIcon()}</button>
          </div>
        </header>
        <div class="mini-player__progress">
          <span id="mini-time-current" class="mini-player__time">0:00</span>
          <input type="range" id="mini-seek" class="mini-player__seek" min="0" max="1000" value="0" step="1" disabled aria-label="播放进度" />
          <span id="mini-time-total" class="mini-player__time">0:00</span>
        </div>
        <section id="mini-lyrics" class="mini-player__lyrics" aria-label="当前歌词"></section>
      </div>
    </section>
  `;
}
