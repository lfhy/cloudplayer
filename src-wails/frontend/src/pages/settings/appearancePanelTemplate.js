// Appearance settings stay isolated because theme mode and accent color evolve frequently.
export function appearancePanelTemplate() {
  return `
    <section class="settings-panel is-active" data-settings-panel="appearance" role="tabpanel">
      <div class="settings-panel__body">
        <div class="settings-field">
          <span class="settings-field-label">界面模式</span>
          <input type="hidden" id="setting-app-theme-mode" value="system" />
          <div class="theme-mode-grid" role="radiogroup" aria-label="界面模式">
            <button type="button" class="theme-mode-card" data-theme-mode-card="system" role="radio" aria-checked="false"><span class="theme-mode-card__preview theme-mode-card__preview--system"></span><span class="theme-card__meta"><span class="theme-card__title">跟随系统</span><span class="theme-card__desc">自动匹配 macOS 亮暗模式</span></span></button>
            <button type="button" class="theme-mode-card" data-theme-mode-card="light" role="radio" aria-checked="false"><span class="theme-mode-card__preview theme-mode-card__preview--light"></span><span class="theme-card__meta"><span class="theme-card__title">浅色</span><span class="theme-card__desc">明亮干净的主界面</span></span></button>
            <button type="button" class="theme-mode-card" data-theme-mode-card="graphite" role="radio" aria-checked="false"><span class="theme-mode-card__preview theme-mode-card__preview--graphite"></span><span class="theme-card__meta"><span class="theme-card__title">石墨夜</span><span class="theme-card__desc">偏中性的深灰暗色</span></span></button>
            <button type="button" class="theme-mode-card" data-theme-mode-card="midnight" role="radio" aria-checked="false"><span class="theme-mode-card__preview theme-mode-card__preview--midnight"></span><span class="theme-card__meta"><span class="theme-card__title">深海夜</span><span class="theme-card__desc">偏蓝的夜间界面</span></span></button>
            <button type="button" class="theme-mode-card" data-theme-mode-card="forestnight" role="radio" aria-checked="false"><span class="theme-mode-card__preview theme-mode-card__preview--forestnight"></span><span class="theme-card__meta"><span class="theme-card__title">森林夜</span><span class="theme-card__desc">偏绿的柔和暗色</span></span></button>
          </div>
          <p class="settings-field-hint muted">选择「跟随系统」后，会随着 macOS 外观实时切换。</p>
        </div>
        <div class="settings-field">
          <span class="settings-field-label">应用主题</span>
          <input type="hidden" id="setting-app-theme" value="coral" />
          <div class="theme-card-grid" role="radiogroup" aria-label="应用主题">
            <button type="button" class="theme-card" data-theme-card="coral" role="radio" aria-checked="false"><span class="theme-card__swatch" style="--theme-card-accent: #c62f2f"></span><span class="theme-card__meta"><span class="theme-card__title">珊瑚红</span><span class="theme-card__desc">经典暖调</span></span></button>
            <button type="button" class="theme-card" data-theme-card="ocean" role="radio" aria-checked="false"><span class="theme-card__swatch" style="--theme-card-accent: #1f6aa5"></span><span class="theme-card__meta"><span class="theme-card__title">海蓝</span><span class="theme-card__desc">冷静清透</span></span></button>
            <button type="button" class="theme-card" data-theme-card="forest" role="radio" aria-checked="false"><span class="theme-card__swatch" style="--theme-card-accent: #2f7d4b"></span><span class="theme-card__meta"><span class="theme-card__title">松绿</span><span class="theme-card__desc">低饱和自然感</span></span></button>
            <button type="button" class="theme-card" data-theme-card="netease" role="radio" aria-checked="false"><span class="theme-card__swatch" style="--theme-card-accent: #d43c33"></span><span class="theme-card__meta"><span class="theme-card__title">网易云红</span><span class="theme-card__desc">更偏品牌化</span></span></button>
            <button type="button" class="theme-card" data-theme-card="kugou" role="radio" aria-checked="false"><span class="theme-card__swatch" style="--theme-card-accent: #1977ff"></span><span class="theme-card__meta"><span class="theme-card__title">酷狗蓝</span><span class="theme-card__desc">更亮更锐</span></span></button>
            <button type="button" class="theme-card" data-theme-card="qqmusic" role="radio" aria-checked="false"><span class="theme-card__swatch" style="--theme-card-accent: #31c27c"></span><span class="theme-card__meta"><span class="theme-card__title">QQ 音乐绿</span><span class="theme-card__desc">鲜明品牌绿</span></span></button>
            <button type="button" class="theme-card theme-card--custom" data-theme-card="custom" role="radio" aria-checked="false"><span class="theme-card__swatch theme-card__swatch--custom"></span><span class="theme-card__meta"><span class="theme-card__title">自定义颜色</span><span class="theme-card__desc">自己选强调色</span></span></button>
          </div>
          <div class="settings-custom-theme" id="settings-custom-theme" hidden>
            <label class="settings-color-lab settings-color-lab--accent" for="setting-app-theme-custom-accent">主题强调色<input type="color" id="setting-app-theme-custom-accent" value="#c62f2f" title="自定义主题强调色" /><span class="settings-color-code" id="setting-app-theme-custom-accent-code">#c62f2f</span></label>
          </div>
          <p class="settings-field-hint muted">预设共 6 种，再加 1 个自定义颜色模式。切换后主界面强调色与 macOS Dock 图标都会同步更新；菜单栏图标保持模板白色。</p>
        </div>
      </div>
    </section>
  `;
}
