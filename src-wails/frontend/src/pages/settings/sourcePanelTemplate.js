// Source settings isolate configurable upstream endpoints for future multi-source expansion.
export function sourcePanelTemplate() {
  return `
    <section class="settings-panel" data-settings-panel="source" role="tabpanel" hidden>
      <div class="settings-panel__body">
        <div class="settings-field">
          <span class="settings-field-label">当前在线曲库</span>
          <div class="settings-source-summary">
            <span class="settings-source-summary__badge">当前</span>
            <strong class="settings-source-summary__title">PJMP3</strong>
            <span class="settings-source-summary__desc">当前搜索、试听与下载链路使用此在线源。</span>
          </div>
        </div>
        <div class="settings-field">
          <label for="setting-netease-api-base" class="settings-field-label">网易云 API 根地址（可选）</label>
          <input type="url" id="setting-netease-api-base" class="settings-field-control settings-field-control--text" spellcheck="false" autocomplete="off" placeholder="https://example.com" aria-describedby="setting-netease-api-base-hint" />
          <p id="setting-netease-api-base-hint" class="settings-field-hint muted">自托管 <a href="https://github.com/Binaryify/NeteaseCloudMusicApi" target="_blank" rel="noopener noreferrer">NeteaseCloudMusicApi</a> 或兼容服务的根 URL（无尾斜杠亦可）。填写后「netease」源将优先请求 <code>/lyric/new</code> 获取 YRC 逐字歌词；留空则仅用网易云网页门户的行级 LRC。</p>
        </div>
      </div>
    </section>
  `;
}
