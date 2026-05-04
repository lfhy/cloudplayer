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
            <input type="text" id="setting-ly-idle-line1" class="settings-field-control settings-field-control--text" maxlength="36" placeholder="CloudPlayer" autocomplete="off" />
            <input type="text" id="setting-ly-idle-line2" class="settings-field-control settings-field-control--text" maxlength="36" placeholder="让音乐陪你此刻" autocomplete="off" />
          </div>
        </div>
        <div class="settings-field">
          <span class="settings-field-label">效果预览</span>
          <div class="lyric-preview" id="setting-ly-preview" aria-live="polite">
            <p class="lyric-preview__line lyric-preview__line--base" id="setting-ly-preview-line1">CloudPlayer</p>
            <p class="lyric-preview__line lyric-preview__line--highlight" id="setting-ly-preview-line2">让音乐陪你此刻</p>
          </div>
        </div>
        <div class="settings-field">
          <span class="settings-field-label">窗口位置</span>
          <div class="settings-inline-row">
            <button type="button" class="settings-action-button" id="btn-reset-desktop-lyrics-bounds">重置歌词位置</button>
            <span class="settings-inline-row__suffix" id="setting-ly-bounds-status">重启后会恢复到上次停留的位置。</span>
          </div>
        </div>
      </div>
    </section>
  `;
}
