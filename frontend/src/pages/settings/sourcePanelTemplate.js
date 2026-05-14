// Source settings keep the base provider and the Kugou-only online gate in one place.
export function sourcePanelTemplate() {
  return `
    <section class="settings-panel" data-settings-panel="source" role="tabpanel" hidden>
      <div class="settings-panel__body">
        <div class="settings-field">
          <span class="settings-field-label">鍦ㄧ嚎鏇插簱娓犻亾</span>
          <input type="hidden" id="setting-music-source-provider" value="kugou" />
          <div class="settings-choice-group" role="radiogroup" aria-label="鍦ㄧ嚎鏇插簱娓犻亾">
            <button type="button" class="settings-choice" data-music-source-provider-card="pjmp3" role="radio" aria-checked="false">娉℃闊充箰婧?/button>
            <button type="button" class="settings-choice" data-music-source-provider-card="kugou" role="radio" aria-checked="false">閰风嫍姒傚康鐗?/button>
            <button type="button" class="settings-choice" data-music-source-provider-card="netease" role="radio" aria-checked="false">缃戞槗浜?/button>
          </div>
          <p class="settings-field-hint muted">褰撳墠榛樿鎼滅储銆佽瘯鍚€佹挱鏀句笌涓嬭浇閮戒細璺熼殢杩欓噷閫夋嫨鐨勬洸搴撴笭閬擄紱鍦ㄧ嚎妯″紡寮€鍚悗浼氫复鏃跺垏鍒颁簯绔€?/p>
        </div>
        <div id="setting-music-online-mode-wrap" class="settings-field" hidden>
          <span class="settings-field-label">鍦ㄧ嚎妯″紡</span>
          <div class="settings-inline-stack">
            <input type="hidden" id="setting-music-online-mode" value="0" />
            <label id="setting-music-online-mode-switch" class="settings-hotkeys-master" role="switch" tabindex="0" aria-checked="false"><input type="checkbox" id="setting-music-online-mode-toggle" /><span>鍦ㄧ嚎妯″紡</span></label>
            <p id="setting-music-online-mode-status" class="settings-field-hint muted">寮€鍚悗锛屽叏閮ㄦ瓕鍗曘€佹瓕鍗曞唴姝屾洸鍜岄煶涔愭簮閮戒細浼樺厛鍒囧埌閰风嫍浜戠锛屽苟缂撳瓨 12 灏忔椂銆?/p>
          </div>
        </div>
        <div class="settings-field">
          <span class="settings-field-label">閰风嫍璐﹀彿鍚屾</span>
          <div class="settings-inline-stack">
            <div id="setting-kugou-profile" class="settings-provider-card" hidden>
              <div id="setting-kugou-avatar" class="settings-provider-card__avatar" aria-hidden="true">K</div>
              <div class="settings-provider-card__meta">
                <strong id="setting-kugou-name">閰风嫍姒傚康鐗?/strong>
                <span id="setting-kugou-detail" class="muted">鏈櫥褰?/span>
              </div>
            </div>
            <div class="settings-inline-row">
              <button type="button" id="btn-kugou-open-import" class="settings-action-button">鍓嶅線瀵煎叆姝屽崟</button>
              <button type="button" id="btn-kugou-logout" class="settings-action-button" hidden>閫€鍑虹櫥褰?/button>
            </div>
            <p id="setting-kugou-login-status" class="settings-field-hint muted">鏈櫥褰曢叿鐙楁蹇电増銆?/p>
            <p class="settings-field-hint muted">鐧诲綍鏂瑰紡銆佹瓕鍗曞嬀閫夊拰鎵归噺瀵煎叆宸茬粺涓€鏀舵暃鍒般€屽鍏ユ瓕鍗曘€嶉〉闈€?/p>
          </div>
        </div>
        <div class="settings-field">
          <label class="settings-field-label">鎾斁鏁呴殰杞Щ閾?/label>
          <div class="settings-inline-stack">
            <input type="hidden" id="setting-playback-fallback-chain" value="kugou,pjmp3,netease" />
            <div id="setting-playback-fallback-chain-editor"></div>
            <p class="settings-field-hint muted">鍚敤鍚庡彲閫氳繃涓婄Щ/涓嬬Щ璋冩暣椤哄簭銆傚綋鍓嶉煶婧愬け璐ュ悗灏嗘寜閾捐矾渚濇灏濊瘯銆?/p>
            <div class="settings-inline-row">
              <button type="button" id="btn-open-app-log-location" class="settings-action-button">查看详细日志</button>
            </div>
          </div>
        </div>
        <div class="settings-field">
          <label class="settings-hotkeys-master"><input type="checkbox" id="setting-auto-cache-on-play" /><span>杈瑰惉杈瑰瓨</span></label>
          <p class="settings-field-hint muted">寮€鍚悗锛屾挱鏀惧湪绾挎瓕鏇叉椂浼氳嚜鍔ㄥ姞鍏ヤ笅杞界紦瀛橀槦鍒楋紝鍙湪銆屼笅杞界鐞嗐€嶆煡鐪嬭繘搴︺€?/p>
        </div>
        <div class="settings-field">
          <label for="setting-search-cache-ttl-hours" class="settings-field-label">鎼滅储缂撳瓨鏃堕暱</label>
          <div class="settings-inline-row">
            <input type="number" id="setting-search-cache-ttl-hours" class="settings-field-control settings-field-control--text settings-field-control--compact" min="1" max="720" step="1" inputmode="numeric" />
            <span class="settings-inline-row__suffix muted">灏忔椂</span>
            <button type="button" id="btn-clear-search-cache" class="btn-outline settings-inline-row__action">娓呯悊缂撳瓨</button>
          </div>
          <p id="setting-search-cache-status" class="settings-field-hint muted">鎼滅储缁撴灉浼氭寜鍏抽敭璇嶃€佸垎椤靛拰褰撳墠鏇插簱娓犻亾缂撳瓨銆?/p>
        </div>
      </div>
    </section>
  `;
}
