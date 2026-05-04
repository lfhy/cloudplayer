// Kugou import panel renders login mode switching and playlist multi-select inside the import flow.
export function kugouImportPanelTemplate() {
  return `
    <div id="import-panel-kugou" class="import-panel" hidden>
      <div class="import-kugou-shell">
        <div class="import-kugou-head">
          <div>
            <h3>导入酷狗歌单</h3>
            <p id="import-kugou-head-copy" class="muted">登录酷狗概念版后勾选要同步的歌单，导入结果会统一进入保存步骤。</p>
          </div>
          <button type="button" id="btn-import-kugou-logout" class="settings-action-button" hidden>退出登录</button>
        </div>
        <p id="import-kugou-login-status" class="import-kugou-status muted" aria-live="polite">正在检查酷狗概念版登录状态…</p>
        <section id="import-kugou-login-shell" class="import-kugou-login-shell">
          <div class="import-kugou-mode-switch" role="tablist" aria-label="酷狗登录方式">
            <button type="button" class="import-kugou-mode is-active" data-kugou-login-mode="qr" role="tab" aria-selected="true">二维码登录</button>
            <button type="button" class="import-kugou-mode" data-kugou-login-mode="sms" role="tab" aria-selected="false">手机验证码</button>
          </div>
          <section id="import-kugou-qr-panel" class="import-kugou-pane">
            <div class="import-kugou-qr-box">
              <img id="import-kugou-qr-image" class="import-kugou-qr-image" alt="酷狗登录二维码" hidden />
              <div class="import-kugou-qr-meta">
                <p class="muted">使用酷狗概念版 App 扫码确认后，会自动同步登录状态。</p>
                <div class="import-kugou-actions">
                  <button type="button" id="btn-import-kugou-qr" class="btn-accent">生成二维码</button>
                  <button type="button" id="btn-import-kugou-copy-qr" class="settings-action-button">复制登录链接</button>
                </div>
              </div>
            </div>
          </section>
          <section id="import-kugou-sms-panel" class="import-kugou-pane" hidden>
            <div class="import-kugou-sms-grid">
              <label class="import-name-field">
                <span>手机号</span>
                <input id="import-kugou-mobile" type="tel" class="import-link-input" placeholder="例如：13800138000" autocomplete="tel" />
              </label>
              <div class="import-kugou-code-row">
                <label class="import-name-field">
                  <span>验证码</span>
                  <input id="import-kugou-code" type="text" class="import-link-input" placeholder="输入收到的短信验证码" autocomplete="one-time-code" />
                </label>
                <button type="button" id="btn-import-kugou-captcha" class="settings-action-button">发送验证码</button>
              </div>
              <div class="import-kugou-actions">
                <button type="button" id="btn-import-kugou-sms-login" class="btn-accent">登录酷狗概念版</button>
              </div>
            </div>
          </section>
        </section>
        <section class="import-kugou-playlists">
          <div class="import-kugou-playlists__head">
            <h4>选择要导入的歌单</h4>
            <div class="import-kugou-actions">
              <button type="button" id="btn-import-kugou-refresh" class="settings-action-button">刷新歌单</button>
              <button type="button" id="btn-import-kugou-select-all" class="settings-action-button">全选</button>
              <button type="button" id="btn-import-kugou-clear" class="settings-action-button">清空</button>
            </div>
          </div>
          <div id="import-kugou-playlist-list" class="import-kugou-playlist-list" aria-live="polite"></div>
          <div class="import-kugou-submit-row">
            <span id="import-kugou-selection-hint" class="muted">还没有选择歌单。</span>
            <button type="button" id="btn-import-kugou-import" class="btn-accent">导入选中歌单</button>
          </div>
        </section>
      </div>
    </div>
  `;
}
