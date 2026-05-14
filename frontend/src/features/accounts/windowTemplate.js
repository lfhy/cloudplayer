import { windowTitlebarTemplate } from "../window/chrome.js";

// Account-center child window keeps the shared provider shell independent from the main page DOM.
export function accountCenterWindowTemplate() {
  return `
    <div class="app-child-window-frame app-child-window-frame--account">
      ${windowTitlebarTemplate({
        title: "登录账号",
        allowMaximize: false,
        className: "app-titlebar--child",
      })}
      <main class="account-center-window__card">
        <nav class="account-center-tabs" id="account-center-provider-list" role="tablist" aria-label="音乐源账号"></nav>
        <section class="account-center-panel" id="account-center-panel"></section>
      </main>
    </div>
  `;
}
