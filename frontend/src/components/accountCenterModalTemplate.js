// Account center modal hosts provider-specific login panels behind one shared glass-style shell.
export function accountCenterModalTemplate() {
  return `
    <div id="account-center-modal" class="modal-overlay" hidden aria-hidden="true">
      <div class="modal-dialog modal-dialog--account-center" role="dialog" aria-modal="true" aria-labelledby="account-center-title">
        <header class="modal-copy modal-copy--account-center">
          <div>
            <h3 id="account-center-title" class="modal-title">登录账号</h3>
          </div>
          <button type="button" class="modal-close" id="btn-account-center-close" aria-label="关闭登录账号">×</button>
        </header>
        <nav class="account-center-tabs" id="account-center-provider-list" role="tablist" aria-label="音乐源账号"></nav>
        <section class="account-center-panel" id="account-center-panel"></section>
      </div>
    </div>
  `;
}
