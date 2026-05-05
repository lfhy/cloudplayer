import { fallbackCoverDataUri } from "../app/helpers/covers.js";
import { iconSvgByName } from "../app/helpers/icons.js";

// Player dock is shared application chrome, so it lives under components instead of page templates.
export function playerDockTemplate() {
  const fallbackCover = fallbackCoverDataUri(52, 10);
  const playIcon = iconSvgByName("play-bold");
  return `
    <footer class="dock-player" aria-label="播放控制">
      <div class="dock-player__left">
        <div class="dock-player__art"><img id="dock-cover" width="52" height="52" alt="" src="${fallbackCover}" /></div>
        <div class="dock-player__meta-col">
          <div id="dock-title" class="dock-player__title">未播放</div>
          <div id="dock-sub" class="dock-player__sub">选择曲目或搜索后双击列表</div>
          <div class="dock-player__acts">
            <button type="button" id="btn-dock-fav" class="dock-ic" title="喜欢">♡</button>
            <div class="dock-menu-anchor"><button type="button" id="btn-dock-dl" class="dock-ic" title="下载（选择音质）">↓</button><div id="popover-dl" class="dock-menu dock-menu--up" role="menu" hidden><button type="button" class="dock-menu__item" data-dlq="flac">FLAC 无损</button><button type="button" class="dock-menu__item" data-dlq="320">HQ 高品质</button><button type="button" class="dock-menu__item" data-dlq="128">标准 128K</button></div></div>
            <div class="dock-menu-anchor"><button type="button" id="btn-dock-more" class="dock-ic" title="更多">⋯</button><div id="popover-more" class="dock-menu dock-menu--up" role="menu" hidden><button type="button" class="dock-menu__item" data-more="add-pl">添加到歌单…</button><button type="button" class="dock-menu__item" data-more="rm-queue">从播放列表删除</button></div></div>
            <button type="button" id="btn-dock-settings" class="dock-ic" title="偏好设置" aria-label="偏好设置">⚙</button>
          </div>
        </div>
      </div>
      <div class="dock-player__center">
        <div class="dock-player__transport">
          <button type="button" id="btn-player-prev" class="dock-tbtn" disabled title="上一首" aria-label="上一首">⏮</button>
          <button type="button" id="btn-player-play" class="dock-tbtn dock-tbtn--main" disabled title="播放" aria-label="播放">${playIcon}</button>
          <button type="button" id="btn-player-next" class="dock-tbtn" disabled title="下一首" aria-label="下一首">⏭</button>
        </div>
        <div class="dock-player__timeline">
          <button type="button" id="btn-play-mode" class="dock-mode" title="顺序播放（点击切换模式）" aria-label="顺序播放（点击切换模式）"></button>
          <input type="range" id="seek" class="dock-seek" min="0" max="1000" value="0" step="1" disabled aria-label="进度" />
          <span id="time-total" class="dock-time">0:00</span>
        </div>
      </div>
      <div class="dock-player__tools">
        <div class="dock-menu-anchor"><button type="button" id="dock-theme-mode" class="dock-chip dock-chip--icon" title="界面模式" aria-label="界面模式"></button></div>
        <div class="dock-menu-anchor"><button type="button" id="dock-quality" class="dock-chip" title="音质偏好（展示；下载以菜单为准）">标准</button><div id="popover-quality" class="dock-menu dock-menu--up dock-menu--right" role="menu" hidden><button type="button" class="dock-menu__item" data-quality="flac">无损</button><button type="button" class="dock-menu__item" data-quality="320">HQ</button><button type="button" class="dock-menu__item" data-quality="128">标准</button></div></div>
        <button type="button" id="btn-dock-lyrics" class="dock-ic dock-ic--accent" title="桌面歌词（独立窗口）">词</button>
        <button type="button" id="btn-dock-lyrics-lock" class="dock-ic dock-ic--lock" title="桌面歌词锁定" aria-label="桌面歌词锁定" disabled></button>
        <button type="button" id="btn-dock-queue" class="dock-ic" title="播放列表">☰</button>
        <label class="dock-vol" title="音量"><span class="dock-vol__icon" aria-hidden="true">◇</span><input id="volume" type="range" min="0" max="100" value="70" class="dock-vol__range" /></label>
      </div>
    </footer>
  `;
}
