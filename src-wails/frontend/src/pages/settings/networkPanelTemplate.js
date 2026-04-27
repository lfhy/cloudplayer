// Network settings are isolated because proxy mode wiring is independent from theme or lyrics.
export function networkPanelTemplate() {
  return `
    <section class="settings-panel" data-settings-panel="network" role="tabpanel" hidden>
      <div class="settings-panel__body">
        <div class="settings-field">
          <span class="settings-field-label">网络代理</span>
          <input type="hidden" id="setting-network-proxy-mode" value="direct" />
          <div class="settings-choice-group" role="radiogroup" aria-label="网络代理模式">
            <button type="button" class="settings-choice" data-network-proxy-mode-card="direct" role="radio" aria-checked="false">不使用代理</button>
            <button type="button" class="settings-choice" data-network-proxy-mode-card="system" role="radio" aria-checked="false">使用系统代理</button>
            <button type="button" class="settings-choice" data-network-proxy-mode-card="custom" role="radio" aria-checked="false">使用自定义代理</button>
          </div>
          <div class="settings-custom-theme" id="settings-network-proxy-custom" hidden>
            <label for="setting-network-proxy-url" class="settings-field-label">自定义代理地址</label>
            <input type="text" id="setting-network-proxy-url" class="import-link-input settings-field-control settings-field-control--text" spellcheck="false" autocomplete="off" placeholder="http://127.0.0.1:7890 或 socks5://127.0.0.1:7891" />
          </div>
          <p class="settings-field-hint muted">支持 <code>http://</code>、<code>https://</code>、<code>socks5://</code>、<code>socks5h://</code>。选「系统代理」时会跟随 macOS 当前的 HTTP / HTTPS / SOCKS 代理配置；选「自定义代理」时，地址填写完整后立即生效。</p>
        </div>
      </div>
    </section>
  `;
}
