// Main shell composition keeps the static DOM tree out of index.html and main.js.
import { appLogoMarkSvg, iconSvgByName } from "../app/helpers/icons.js";
import { accountCenterModalTemplate } from "../components/accountCenterModalTemplate.js";
import { closeConfirmModalTemplate } from "../components/closeConfirmModalTemplate.js";
import { immersivePlayerTemplate } from "../components/immersivePlayerTemplate.js";
import { kugouPlaylistPreviewModalTemplate } from "../components/kugouPlaylistPreviewModalTemplate.js";
import { miniPlayerTemplate } from "../components/miniPlayerTemplate.js";
import { playerDockTemplate } from "../components/playerDockTemplate.js";
import { playlistManageModalTemplate } from "../components/playlistManageModalTemplate.js";
import { queuePanelTemplate } from "../components/queuePanelTemplate.js";
import { dailyPageTemplate } from "../pages/dailyPageTemplate.js";
import { downloadPageTemplate } from "../pages/downloadPageTemplate.js";
import { homePageTemplate } from "../pages/homePageTemplate.js";
import { importPageTemplate } from "../pages/importPageTemplate.js";
import { playlistPageTemplate } from "../pages/playlistPageTemplate.js";
import { recentPageTemplate } from "../pages/recentPageTemplate.js";
import { searchPageTemplate } from "../pages/searchPageTemplate.js";
import { settingsPageTemplate } from "../pages/settingsPageTemplate.js";
import { isWindowsDesktop } from "../app/helpers/platformTheme.js";

function mainPagesTemplate() {
  return [
    homePageTemplate(),
    searchPageTemplate(),
    dailyPageTemplate(),
    playlistPageTemplate(),
    recentPageTemplate(),
    downloadPageTemplate(),
    importPageTemplate(),
    settingsPageTemplate(),
  ].join("\n");
}

function topbarWindowControlsTemplate() {
  return `
    <div class="app-window-controls" aria-label="window controls">
      <button type="button" id="btn-window-minimize" class="app-window-control app-window-control--minimize" aria-label="Minimize" title="Minimize">
        ${iconSvgByName("minimize-linear")}
      </button>
      <button type="button" id="btn-window-maximize" class="app-window-control app-window-control--maximize" aria-label="Maximize" title="Maximize">
        ${iconSvgByName("maximize-square-linear")}
      </button>
      <button type="button" id="btn-window-close" class="app-window-control app-window-control--close" aria-label="Close" title="Close">
        ${iconSvgByName("close-circle-linear")}
      </button>
    </div>
  `;
}

function topbarTemplate() {
  if (isWindowsDesktop()) return "";
  return `
    <header class="top-search-row app-topbar">
      <div class="app-topbar__native-slot" aria-hidden="true"></div>
      <div class="app-topbar__brand">
        <span class="app-topbar__mark" aria-hidden="true">${appLogoMarkSvg()}</span>
        <span class="app-topbar__title">CloudPlayer</span>
      </div>
      ${topbarWindowControlsTemplate()}
    </header>
  `;
}

export function renderMainShell(root = document.getElementById("app")) {
  if (!root) {
    throw new Error("CloudPlayer app root not found");
  }
  root.innerHTML = `
    <div class="app-shell">
      ${topbarTemplate()}
      <div class="body-row">
        <aside id="sidebar" class="sidebar"></aside>
        <div class="main-col">
          <main id="stack" class="stack">${mainPagesTemplate()}</main>
          ${queuePanelTemplate()}
          ${playerDockTemplate()}
          ${immersivePlayerTemplate()}
        </div>
      </div>
      ${miniPlayerTemplate()}
      ${accountCenterModalTemplate()}
      ${closeConfirmModalTemplate()}
      ${kugouPlaylistPreviewModalTemplate()}
      ${playlistManageModalTemplate()}
    </div>
  `;
}
