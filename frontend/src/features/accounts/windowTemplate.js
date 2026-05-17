import { isWindowsDesktop } from "../../app/helpers/platformTheme.js";
import { windowTitlebarTemplate } from "../window/chrome.js";

// Account-center child window keeps the shared provider shell independent from the main page DOM.
export function accountCenterWindowTemplate() {
  const titlebar = isWindowsDesktop()
    ? ""
    : windowTitlebarTemplate({
        title: "鐧诲綍璐﹀彿",
        allowMinimize: false,
        allowMaximize: false,
        className: "app-titlebar--child",
      });
  return `
    <div class="app-child-window-frame app-child-window-frame--account">
      ${titlebar}
      <main class="account-center-window__card">
        <nav class="account-center-tabs" id="account-center-provider-list" role="tablist" aria-label="闊充箰婧愯处鍙?"></nav>
        <section class="account-center-panel" id="account-center-panel"></section>
      </main>
    </div>
  `;
}
