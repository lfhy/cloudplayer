// Kugou account panel is rendered inside the shared account center instead of being duplicated in settings/sidebar.
export function kugouAccountPanelTemplate() {
  return `
    <div class="account-provider-panel" data-account-provider-panel="kugou">
      <div class="account-provider-heading">
        <strong>酷狗概念版</strong>
        <span class="muted">扫码或短信验证码登录</span>
      </div>
      <div class="account-provider-card" id="account-kugou-profile" hidden>
        <div id="account-kugou-avatar" class="account-provider-card__avatar" aria-hidden="true">K</div>
        <div class="account-provider-card__meta">
          <strong id="account-kugou-name">酷狗概念版</strong>
          <span id="account-kugou-detail" class="muted">未登录</span>
        </div>
      </div>
      <p id="account-kugou-status" class="account-provider-status muted" aria-live="polite">正在检查酷狗概念版登录状态…</p>
      <div class="account-provider-mode-switch" role="tablist" aria-label="酷狗概念版登录方式">
        <button type="button" class="account-provider-mode is-active" data-account-kugou-mode="qr" role="tab" aria-selected="true">二维码登录</button>
        <button type="button" class="account-provider-mode" data-account-kugou-mode="sms" role="tab" aria-selected="false">手机验证码</button>
      </div>
      <section id="account-kugou-qr-panel" class="account-provider-pane">
        <div class="account-provider-qr-box">
          <img id="account-kugou-qr-image" class="account-provider-qr-image" alt="酷狗概念版登录二维码" hidden />
          <div class="account-provider-qr-meta">
            <div class="account-provider-actions">
              <button type="button" id="btn-account-kugou-qr" class="btn-accent">生成二维码</button>
              <button type="button" id="btn-account-kugou-copy-qr" class="settings-action-button">复制链接</button>
            </div>
          </div>
        </div>
      </section>
      <section id="account-kugou-sms-panel" class="account-provider-pane" hidden>
        <div class="account-provider-sms-grid">
          <label class="import-name-field">
            <span>手机号</span>
            <input id="account-kugou-mobile" type="tel" class="import-link-input" placeholder="例如：13800138000" autocomplete="tel" />
          </label>
          <div class="account-provider-code-row">
            <label class="import-name-field">
              <span>验证码</span>
              <input id="account-kugou-code" type="text" class="import-link-input" placeholder="输入收到的短信验证码" autocomplete="one-time-code" />
            </label>
            <button type="button" id="btn-account-kugou-captcha" class="settings-action-button">发送验证码</button>
          </div>
          <div class="account-provider-actions">
            <button type="button" id="btn-account-kugou-login" class="btn-accent">登录</button>
          </div>
        </div>
      </section>
      <div class="account-provider-footer">
        <button type="button" id="btn-account-kugou-open-import" class="settings-action-button">导入歌单</button>
        <button type="button" id="btn-account-kugou-logout" class="settings-action-button" hidden>退出登录</button>
      </div>
    </div>
  `;
}
