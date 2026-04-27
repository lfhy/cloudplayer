// Control settings are separated to keep hotkey markup readable and bounded.
export function controlsPanelTemplate() {
  return `
    <section class="settings-panel" data-settings-panel="controls" role="tabpanel" hidden>
      <div class="settings-panel__body">
        <div class="settings-field">
          <label for="setting-close-action" class="settings-field-label">关闭主窗口时</label>
          <select id="setting-close-action" class="import-select import-select--wide settings-field-control">
            <option value="ask">每次询问</option>
            <option value="tray">最小化到系统托盘</option>
            <option value="quit">退出应用</option>
          </select>
        </div>
        <div class="settings-field settings-field--hotkeys">
          <label class="settings-hotkeys-master"><input type="checkbox" id="setting-hotkeys-enabled" checked /><span>启用全局快捷键</span></label>
          <p class="settings-field-hint muted">后台也能响应；默认使用 Ctrl+Alt+ 组合以避免中文输入法占用 Ctrl+Space。点击快捷键框后按下新组合即可替换，Esc 取消、Backspace 清除；修改后自动生效。</p>
          <div class="hotkeys-panel">
            <span class="hotkeys-panel__group" aria-hidden="true">播放控制</span>
            <div class="hotkeys-table" role="group" aria-label="播放控制快捷键">
              <div class="hotkeys-row" data-action="play_pause"><span class="hotkeys-row__name">播放/暂停</span><button type="button" class="hotkeys-input" id="hk-play-pause" aria-label="录制 播放/暂停 快捷键"></button><span class="hotkeys-status" data-status="ok" id="hk-status-play-pause">正常</span></div>
              <div class="hotkeys-row" data-action="prev"><span class="hotkeys-row__name">上一首</span><button type="button" class="hotkeys-input" id="hk-prev" aria-label="录制 上一首 快捷键"></button><span class="hotkeys-status" data-status="ok" id="hk-status-prev">正常</span></div>
              <div class="hotkeys-row" data-action="next"><span class="hotkeys-row__name">下一首</span><button type="button" class="hotkeys-input" id="hk-next" aria-label="录制 下一首 快捷键"></button><span class="hotkeys-status" data-status="ok" id="hk-status-next">正常</span></div>
              <div class="hotkeys-row" data-action="volume_up"><span class="hotkeys-row__name">增大音量</span><button type="button" class="hotkeys-input" id="hk-vol-up" aria-label="录制 增大音量 快捷键"></button><span class="hotkeys-status" data-status="ok" id="hk-status-vol-up">正常</span></div>
              <div class="hotkeys-row" data-action="volume_down"><span class="hotkeys-row__name">减少音量</span><button type="button" class="hotkeys-input" id="hk-vol-down" aria-label="录制 减少音量 快捷键"></button><span class="hotkeys-status" data-status="ok" id="hk-status-vol-down">正常</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}
