// Main shell composition keeps the static DOM tree out of index.html and main.js.
import { accountCenterModalTemplate } from "../components/accountCenterModalTemplate.js";
import { closeConfirmModalTemplate } from "../components/closeConfirmModalTemplate.js";
import { kugouPlaylistPreviewModalTemplate } from "../components/kugouPlaylistPreviewModalTemplate.js";
import { playlistManageModalTemplate } from "../components/playlistManageModalTemplate.js";
import { immersivePlayerTemplate } from "../components/immersivePlayerTemplate.js";
import { playerDockTemplate } from "../components/playerDockTemplate.js";
import { queuePanelTemplate } from "../components/queuePanelTemplate.js";
import { dailyPageTemplate } from "../pages/dailyPageTemplate.js";
import { downloadPageTemplate } from "../pages/downloadPageTemplate.js";
import { homePageTemplate } from "../pages/homePageTemplate.js";
import { importPageTemplate } from "../pages/importPageTemplate.js";
import { playlistPageTemplate } from "../pages/playlistPageTemplate.js";
import { recentPageTemplate } from "../pages/recentPageTemplate.js";
import { searchPageTemplate } from "../pages/searchPageTemplate.js";
import { settingsPageTemplate } from "../pages/settingsPageTemplate.js";

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
  root.innerHTML = `
    <div class="body-row">
      <aside id="sidebar" class="sidebar"></aside>
      <div class="main-col">
        <header class="top-search-row"></header>
        <main id="stack" class="stack">${mainPagesTemplate()}</main>
        ${queuePanelTemplate()}
        ${playerDockTemplate()}
        ${immersivePlayerTemplate()}
      </div>
    </div>
    ${accountCenterModalTemplate()}
    ${closeConfirmModalTemplate()}
    ${kugouPlaylistPreviewModalTemplate()}
    ${playlistManageModalTemplate()}
  `;
}
