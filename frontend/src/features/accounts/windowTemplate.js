// Account-center child window keeps the shared provider shell independent from the main page DOM.
export function accountCenterWindowTemplate() {
  return `
    <main class="account-center-window__card">
      <nav class="account-center-tabs" id="account-center-provider-list" role="tablist" aria-label="音乐源账号"></nav>
      <section class="account-center-panel" id="account-center-panel"></section>
    </main>
  `;
}
