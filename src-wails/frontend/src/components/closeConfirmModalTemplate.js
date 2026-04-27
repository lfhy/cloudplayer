// Close confirmation modal stays reusable and independent from page routing.
export function closeConfirmModalTemplate() {
  return `
    <div id="close-confirm-modal" class="modal-overlay" hidden aria-hidden="true">
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="close-modal-title">
        <h3 id="close-modal-title" class="modal-title">关闭主窗口</h3>
        <p class="modal-desc">请选择本次操作：</p>
        <div class="modal-actions">
          <button type="button" class="btn-outline" id="close-choice-tray">最小化到系统托盘</button>
          <button type="button" class="btn-danger" id="close-choice-quit">退出 CloudPlayer</button>
        </div>
        <label class="modal-remember"><input type="checkbox" id="close-choice-remember" /> 将此次选择记录为默认</label>
        <button type="button" class="modal-cancel" id="close-choice-cancel">取消</button>
      </div>
    </div>
  `;
}
