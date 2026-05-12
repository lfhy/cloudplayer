import { appLogoMarkSvg } from "../app/helpers/icons.js";
import { subwindowShellTemplate } from "./subwindowShellTemplate.js";

// Close confirmation modal stays reusable and independent from page routing.
export function closeConfirmModalTemplate() {
  const content = `
    <div class="close-subwindow">
      <div class="close-subwindow__hero">
        <div class="close-subwindow__mark" aria-hidden="true">${appLogoMarkSvg()}</div>
        <p class="close-subwindow__desc">主窗口关闭后，CloudPlayer 可以保留后台播放，也可以直接退出。</p>
      </div>
      <div class="modal-choice-grid modal-choice-grid--close-subwindow">
        <button type="button" class="modal-choice modal-choice--tray" id="close-choice-tray">
          <span class="modal-choice__title">最小化到系统托盘</span>
          <span class="modal-choice__desc">保留播放与后台控制，稍后可从托盘重新打开。</span>
        </button>
        <button type="button" class="modal-choice modal-choice--quit" id="close-choice-quit">
          <span class="modal-choice__title">退出 CloudPlayer</span>
          <span class="modal-choice__desc">结束播放与后台进程，完全关闭应用。</span>
        </button>
      </div>
      <footer class="modal-footer modal-footer--close-subwindow">
        <label class="modal-remember"><input type="checkbox" id="close-choice-remember" /> 记住这次选择</label>
        <button type="button" class="modal-cancel" id="close-choice-cancel">取消</button>
      </footer>
    </div>
  `;
  return `
    <div id="close-confirm-modal" class="modal-overlay" hidden aria-hidden="true">
      ${subwindowShellTemplate({ titleId: "close-modal-title", title: "关闭主窗口", subtitle: "CloudPlayer", bodyClass: "subwindow-shell__body--close-confirm", content })}
    </div>
  `;
}
