// Lyrics settings stay separate because they also back the floating lyrics window.
export function lyricsPanelTemplate() {
  return `
    <section class="settings-panel" data-settings-panel="lyrics" role="tabpanel" hidden>
      <div class="settings-panel__body">
        <div class="settings-field">
          <span class="settings-field-label">桌面歌词字色</span>
          <div class="settings-colors-row">
            <label class="settings-color-lab">未唱<input type="color" id="setting-ly-base" value="#ffffff" title="未唱字色" /></label>
            <label class="settings-color-lab">已唱<input type="color" id="setting-ly-highlight" value="#ffb7d4" title="已唱字色" /></label>
          </div>
        </div>
        <div class="settings-field">
          <span class="settings-field-label">无播放默认文案</span>
          <div class="settings-inline-stack">
            <input type="text" id="setting-ly-idle-line1" class="settings-field-control settings-field-control--text" maxlength="36" placeholder="播放完成" autocomplete="off" />
            <input type="text" id="setting-ly-idle-line2" class="settings-field-control settings-field-control--text" maxlength="36" placeholder="选择下一首继续聆听" autocomplete="off" />
          </div>
        </div>
      </div>
    </section>
  `;
}
