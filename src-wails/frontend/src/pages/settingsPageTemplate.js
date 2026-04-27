// Settings page composes tab buttons and independently owned panels.
import { appearancePanelTemplate } from "./settings/appearancePanelTemplate.js";
import { controlsPanelTemplate } from "./settings/controlsPanelTemplate.js";
import { lyricsPanelTemplate } from "./settings/lyricsPanelTemplate.js";
import { networkPanelTemplate } from "./settings/networkPanelTemplate.js";
import { sourcePanelTemplate } from "./settings/sourcePanelTemplate.js";

export function settingsPageTemplate() {
  return `
    <section class="page" data-page="settings" aria-label="偏好设置">
      <h1 class="page-title">偏好设置</h1>
      <div class="settings-form">
        <div class="settings-layout">
          <div class="settings-tabs" role="tablist" aria-label="偏好设置分组">
            <button type="button" class="settings-tab is-active" data-settings-tab="appearance" role="tab" aria-selected="true"><span class="settings-tab__title">外观</span><span class="settings-tab__desc">界面模式与主题色</span></button>
            <button type="button" class="settings-tab" data-settings-tab="network" role="tab" aria-selected="false"><span class="settings-tab__title">网络代理</span><span class="settings-tab__desc">接口访问代理</span></button>
            <button type="button" class="settings-tab" data-settings-tab="source" role="tab" aria-selected="false"><span class="settings-tab__title">音乐源</span><span class="settings-tab__desc">曲库与歌词源</span></button>
            <button type="button" class="settings-tab" data-settings-tab="controls" role="tab" aria-selected="false"><span class="settings-tab__title">控制</span><span class="settings-tab__desc">关闭行为与快捷键</span></button>
            <button type="button" class="settings-tab" data-settings-tab="lyrics" role="tab" aria-selected="false"><span class="settings-tab__title">歌词</span><span class="settings-tab__desc">桌面歌词颜色</span></button>
          </div>
          <div class="settings-panels">
            ${appearancePanelTemplate()}
            ${networkPanelTemplate()}
            ${sourcePanelTemplate()}
            ${controlsPanelTemplate()}
            ${lyricsPanelTemplate()}
          </div>
        </div>
      </div>
    </section>
  `;
}
