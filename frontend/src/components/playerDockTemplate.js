import { fallbackCoverDataUri } from "../app/helpers/covers.js";
import { favoriteIconSvg, iconSvgByName } from "../app/helpers/icons.js";

// Player dock is shared application chrome, so it lives under components instead of page templates.
export function playerDockTemplate() {
  const fallbackCover = fallbackCoverDataUri(60, 12);
  const favoriteIcon = favoriteIconSvg(false);
  const playIcon = iconSvgByName("play-bold");
  const prevIcon = iconSvgByName("skip-previous-bold");
  const nextIcon = iconSvgByName("skip-next-bold");
  const miniIcon = iconSvgByName("to-pip-linear");
  const volumeIcon = iconSvgByName("volume-loud-bold");
  return `
    <footer class="dock-player" aria-label="\u64ad\u653e\u63a7\u5236">
      <div class="dock-player__left">
        <button type="button" class="dock-player__art" id="btn-dock-immersive" title="\u8fdb\u5165\u6c89\u6d78\u6a21\u5f0f" aria-label="\u8fdb\u5165\u6c89\u6d78\u6a21\u5f0f"><img id="dock-cover" width="60" height="60" alt="" src="${fallbackCover}" /></button>
        <div class="dock-player__meta-col">
          <div id="dock-title" class="dock-player__title">\u672a\u64ad\u653e</div>
          <div id="dock-sub" class="dock-player__sub">\u9009\u62e9\u66f2\u76ee\u6216\u641c\u7d22\u540e\u53cc\u51fb\u5217\u8868</div>
          <div class="dock-player__acts">
            <button type="button" id="btn-dock-fav" class="dock-ic" title="\u559c\u6b22" aria-label="\u559c\u6b22">${favoriteIcon}</button>
            <div class="dock-menu-anchor"><button type="button" id="btn-dock-dl" class="dock-ic" title="\u4e0b\u8f7d\uff08\u9009\u62e9\u97f3\u8d28\uff09">\u21e3</button><div id="popover-dl" class="dock-menu dock-menu--up" role="menu" hidden><button type="button" class="dock-menu__item" data-dlq="flac">FLAC \u65e0\u635f</button><button type="button" class="dock-menu__item" data-dlq="320">HQ \u9ad8\u54c1\u8d28</button><button type="button" class="dock-menu__item" data-dlq="128">\u6807\u51c6 128K</button></div></div>
            <div class="dock-menu-anchor"><button type="button" id="btn-dock-more" class="dock-ic" title="\u66f4\u591a">\u22ef</button><div id="popover-more" class="dock-menu dock-menu--up" role="menu" hidden><button type="button" class="dock-menu__item" data-more="add-pl">\u6dfb\u52a0\u5230\u6b4c\u5355</button><button type="button" class="dock-menu__item" data-more="rm-queue">\u4ece\u64ad\u653e\u5217\u8868\u5220\u9664</button></div></div>
          </div>
        </div>
      </div>
      <div class="dock-player__center">
        <div class="dock-player__transport">
          <button type="button" id="btn-play-mode" class="dock-mode dock-mode--transport" title="\u5217\u8868\u5faa\u73af" aria-label="\u5217\u8868\u5faa\u73af"></button>
          <button type="button" id="btn-player-prev" class="dock-tbtn dock-tbtn--nav" disabled title="\u4e0a\u4e00\u9996" aria-label="\u4e0a\u4e00\u9996">${prevIcon}</button>
          <button type="button" id="btn-player-play" class="dock-tbtn dock-tbtn--main" disabled title="\u64ad\u653e" aria-label="\u64ad\u653e">${playIcon}</button>
          <button type="button" id="btn-player-next" class="dock-tbtn dock-tbtn--nav" disabled title="\u4e0b\u4e00\u9996" aria-label="\u4e0b\u4e00\u9996">${nextIcon}</button>
          <button type="button" id="btn-dock-queue" class="dock-mode dock-mode--queue" title="\u64ad\u653e\u961f\u5217" aria-label="\u64ad\u653e\u961f\u5217" aria-expanded="false">\u2630</button>
        </div>
        <div class="dock-player__timeline">
          <span id="time-current" class="dock-time">0:00</span>
          <input type="range" id="seek" class="dock-seek" min="0" max="1000" value="0" step="1" disabled aria-label="\u8fdb\u5ea6" />
          <span id="time-total" class="dock-time">0:00</span>
        </div>
      </div>
      <div class="dock-player__tools">
        <button type="button" id="btn-dock-mini" class="dock-ic" title="\u8fdb\u5165 Mini \u6a21\u5f0f" aria-label="\u8fdb\u5165 Mini \u6a21\u5f0f">${miniIcon}</button>
        <div class="dock-menu-anchor"><button type="button" id="dock-theme-mode" class="dock-chip dock-chip--icon" title="\u754c\u9762\u6a21\u5f0f" aria-label="\u754c\u9762\u6a21\u5f0f"></button></div>
        <div class="dock-menu-anchor"><button type="button" id="dock-quality" class="dock-chip" title="\u97f3\u8d28\u504f\u597d\uff08\u5c55\u793a\uff1b\u4e0b\u8f7d\u4ee5\u83dc\u5355\u4e3a\u51c6\uff09">\u6807\u51c6</button><div id="popover-quality" class="dock-menu dock-menu--up dock-menu--right" role="menu" hidden><button type="button" class="dock-menu__item" data-quality="flac">\u65e0\u635f</button><button type="button" class="dock-menu__item" data-quality="320">HQ</button><button type="button" class="dock-menu__item" data-quality="128">\u6807\u51c6</button></div></div>
        <button type="button" id="btn-dock-lyrics" class="dock-ic dock-ic--accent" title="\u684c\u9762\u6b4c\u8bcd\uff08\u72ec\u7acb\u7a97\u53e3\uff09">\u8bcd</button>
        <button type="button" id="btn-dock-lyrics-lock" class="dock-ic dock-ic--lock" title="\u684c\u9762\u6b4c\u8bcd\u9501\u5b9a" aria-label="\u684c\u9762\u6b4c\u8bcd\u9501\u5b9a" disabled></button>
        <div class="dock-vol" title="\u97f3\u91cf">
          <button type="button" id="btn-volume-mute" class="dock-vol__icon" aria-label="\u97f3\u91cf" title="\u97f3\u91cf">${volumeIcon}</button>
          <input id="volume" type="range" min="0" max="100" value="70" class="dock-vol__range" />
        </div>
      </div>
    </footer>
  `;
}
