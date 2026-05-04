// Source settings isolate configurable upstream endpoints for future multi-source expansion.
export function sourcePanelTemplate() {
  return `
    <section class="settings-panel" data-settings-panel="source" role="tabpanel" hidden>
      <div class="settings-panel__body">
        <div class="settings-field">
          <span class="settings-field-label">在线曲库渠道</span>
          <input type="hidden" id="setting-music-source-provider" value="pjmp3" />
          <div class="settings-choice-group" role="radiogroup" aria-label="在线曲库渠道">
            <button type="button" class="settings-choice" data-music-source-provider-card="pjmp3" role="radio" aria-checked="false">PJMP3 公共源</button>
            <button type="button" class="settings-choice" data-music-source-provider-card="kugou" role="radio" aria-checked="false">酷狗 Lite</button>
          </div>
          <p class="settings-field-hint muted">当前默认搜索、试听、播放与下载都会跟随这里选择的曲库渠道。</p>
        </div>
        <div class="settings-field">
          <label for="setting-netease-api-base" class="settings-field-label">网易云歌词 API 根地址（可选）</label>
          <input type="url" id="setting-netease-api-base" class="settings-field-control settings-field-control--text" spellcheck="false" autocomplete="off" placeholder="https://example.com" aria-describedby="setting-netease-api-base-hint" />
          <p id="setting-netease-api-base-hint" class="settings-field-hint muted">这里只影响网易云歌词获取，不影响当前在线曲库渠道。填写后「netease」歌词源会优先请求 <code>/lyric/new</code> 获取 YRC 逐字歌词；留空则仅用网易云网页门户的行级 LRC。</p>
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
