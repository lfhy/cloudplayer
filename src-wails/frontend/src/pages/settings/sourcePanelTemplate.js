// Source settings isolate configurable upstream endpoints for future multi-source expansion.
export function sourcePanelTemplate() {
  return `
    <section class="settings-panel" data-settings-panel="source" role="tabpanel" hidden>
      <div class="settings-panel__body">
        <div class="settings-field">
          <span class="settings-field-label">在线曲库渠道</span>
          <input type="hidden" id="setting-music-source-provider" value="pjmp3" />
          <div class="settings-source-grid" role="radiogroup" aria-label="在线曲库渠道">
            <button
              type="button"
              class="settings-source-card"
              data-music-source-provider-card="pjmp3"
              role="radio"
              aria-checked="false"
            >
              <span class="settings-source-card__head">
                <span class="settings-source-card__badge">公共源</span>
                <strong class="settings-source-card__title">PJMP3</strong>
              </span>
              <span class="settings-source-card__desc">当前音乐搜索、试听与下载链路统一走这个公共聚合源。</span>
            </button>
          </div>
        </div>
        <div class="settings-field">
          <label for="setting-netease-api-base" class="settings-field-label">网易云歌词 API 根地址（可选）</label>
          <input type="url" id="setting-netease-api-base" class="settings-field-control settings-field-control--text" spellcheck="false" autocomplete="off" placeholder="https://example.com" aria-describedby="setting-netease-api-base-hint" />
          <p id="setting-netease-api-base-hint" class="settings-field-hint muted">这里只影响网易云歌词获取，不影响当前在线曲库渠道。填写后「netease」歌词源会优先请求 <code>/lyric/new</code> 获取 YRC 逐字歌词；留空则仅用网易云网页门户的行级 LRC。</p>
        </div>
      </div>
    </section>
  `;
}
