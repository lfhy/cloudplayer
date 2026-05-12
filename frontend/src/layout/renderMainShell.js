// Main shell composition keeps the static DOM tree out of index.html and main.js.
import { closeConfirmModalTemplate } from "../components/closeConfirmModalTemplate.js";
import { immersivePlayerTemplate } from "../components/immersivePlayerTemplate.js";
import { kugouPlaylistPreviewModalTemplate } from "../components/kugouPlaylistPreviewModalTemplate.js";
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

export function renderMainShell(root = document.getElementById("app")) {
  if (!root) {
    throw new Error("CloudPlayer app root not found");
  }
  const topbarSpacer = isWindowsDesktop() ? "" : '<header class="top-search-row"></header>';
  root.innerHTML = `
    <div class="app-shell">
      <div class="body-row">
        <aside id="sidebar" class="sidebar"></aside>
        <div class="main-col">
          ${topbarSpacer}
          <main id="stack" class="stack">${mainPagesTemplate()}</main>
          ${queuePanelTemplate()}
          ${playerDockTemplate()}
          ${immersivePlayerTemplate()}
        </div>
      </div>
      <div id="child-window-mask" class="child-window-mask" hidden aria-hidden="true"></div>
      ${closeConfirmModalTemplate()}
      ${kugouPlaylistPreviewModalTemplate()}
      ${playlistManageModalTemplate()}
    </div>
  `;
}
