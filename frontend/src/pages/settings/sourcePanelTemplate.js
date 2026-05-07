// Source settings keep the base provider and the Kugou-only online gate in one place.
export function sourcePanelTemplate() {
  return `
    <section class="settings-panel" data-settings-panel="source" role="tabpanel" hidden>
      <div class="settings-panel__body">
        <div class="settings-field">
          <span class="settings-field-label">在线曲库渠道</span>
          <input type="hidden" id="setting-music-source-provider" value="pjmp3" />
          <div class="settings-choice-group" role="radiogroup" aria-label="在线曲库渠道">
            <button type="button" class="settings-choice" data-music-source-provider-card="pjmp3" role="radio" aria-checked="false">PJMP3 公共源</button>
            <button type="button" class="settings-choice" data-music-source-provider-card="kugou" role="radio" aria-checked="false">酷狗概念版</button>
          </div>
          <p class="settings-field-hint muted">当前默认搜索、试听、播放与下载都会跟随这里选择的曲库渠道；在线模式开启后会临时切到云端。</p>
        </div>
        <div id="setting-music-online-mode-wrap" class="settings-field" hidden>
          <span class="settings-field-label">在线模式</span>
          <div class="settings-inline-stack">
            <div class="settings-choice-group" role="radiogroup" aria-label="在线模式">
              <input type="hidden" id="setting-music-online-mode" value="0" />
              <button type="button" id="btn-music-online-mode" class="settings-choice" role="switch" aria-checked="false">在线模式</button>
            </div>
            <p id="setting-music-online-mode-status" class="settings-field-hint muted">开启后，搜索、播放、补全都会优先使用酷狗云端曲库。</p>
          </div>
        </div>
        <div class="settings-field">
          <span class="settings-field-label">酷狗账号同步</span>
          <div class="settings-inline-stack">
            <div id="setting-kugou-profile" class="settings-provider-card" hidden>
              <div id="setting-kugou-avatar" class="settings-provider-card__avatar" aria-hidden="true">K</div>
              <div class="settings-provider-card__meta">
                <strong id="setting-kugou-name">酷狗概念版</strong>
                <span id="setting-kugou-detail" class="muted">未登录</span>
              </div>
            </div>
            <div class="settings-inline-row">
              <button type="button" id="btn-kugou-open-import" class="settings-action-button">前往导入歌单</button>
              <button type="button" id="btn-kugou-logout" class="settings-action-button" hidden>退出登录</button>
            </div>
            <p id="setting-kugou-login-status" class="settings-field-hint muted">未登录酷狗概念版。</p>
            <p class="settings-field-hint muted">登录方式、歌单勾选和批量导入已统一收敛到「导入歌单」页面。</p>
          </div>
        </div>
        <div class="settings-field">
          <label for="setting-search-cache-ttl-hours" class="settings-field-label">搜索缓存时长</label>
          <div class="settings-inline-row">
            <input type="number" id="setting-search-cache-ttl-hours" class="settings-field-control settings-field-control--text settings-field-control--compact" min="1" max="720" step="1" inputmode="numeric" />
            <span class="settings-inline-row__suffix muted">小时</span>
            <button type="button" id="btn-clear-search-cache" class="btn-outline settings-inline-row__action">清理缓存</button>
          </div>
          <p id="setting-search-cache-status" class="settings-field-hint muted">搜索结果会按关键词、分页和当前曲库渠道缓存。</p>
        </div>
      </div>
    </section>
  `;
}
