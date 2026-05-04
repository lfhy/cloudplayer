// Close confirmation modal stays reusable and independent from page routing.
export function closeConfirmModalTemplate() {
  return `
    <div id="close-confirm-modal" class="modal-overlay" hidden aria-hidden="true">
      <div class="modal-dialog modal-dialog--close-confirm" role="dialog" aria-modal="true" aria-labelledby="close-modal-title">
        <header class="modal-copy">
          <h3 id="close-modal-title" class="modal-title">关闭主窗口后的操作</h3>
        </header>
        <div class="modal-choice-grid">
          <button type="button" class="modal-choice modal-choice--tray" id="close-choice-tray">最小化到系统托盘</button>
          <button type="button" class="modal-choice modal-choice--quit" id="close-choice-quit">退出 CloudPlayer</button>
        </div>
        <footer class="modal-footer">
          <label class="modal-remember"><input type="checkbox" id="close-choice-remember" /> 记住这次选择</label>
          <button type="button" class="modal-cancel" id="close-choice-cancel">取消</button>
        </footer>
      </div>
    </div>
  `;
}
