// Navigation wiring owns sidebar rendering and page activation so bootstrap stays declarative.
export function createNavigationController(deps) {
  const {
    appLogoMarkSvg,
    applyQuickThemeMode,
    escapeHtml,
    getActiveSearchInput,
    navIconSvg,
    navItems,
    onDailyPage,
    onDownloadPage,
    onHomePage,
    onImportPage,
    onLoginAccount,
    onNewPlaylist,
    onPlaylistPage,
    onRecentPage,
    onSearchPage,
    onSettingsPage,
    refreshSidebarPlaylists,
    refreshQuickThemeModeUi,
    renderQueuePanel,
    sidebarMenuItems,
  } = deps;

  function setPage(pageId) {
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === pageId);
    });
    document.querySelectorAll(".sidebar-pl-item").forEach((item) => {
      if (pageId !== "playlist") item.classList.remove("is-active");
    });
    document.querySelectorAll(".page").forEach((page) => {
      page.classList.toggle("page-active", page.dataset.page === pageId);
    });
    if (pageId === "home") onHomePage();
    if (pageId === "daily") onDailyPage();
    if (pageId === "recent") onRecentPage();
    if (pageId === "download") onDownloadPage();
    if (pageId === "import") onImportPage();
    if (pageId === "playlist") onPlaylistPage();
    if (pageId === "search") onSearchPage();
    if (pageId === "settings" && typeof onSettingsPage === "function") onSettingsPage();
  }

  function renderSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    sidebar.innerHTML = "";
    navItems.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nav-item";
      button.dataset.page = item.id;
      button.innerHTML = `<span class="nav-item__icon">${navIconSvg(item.icon)}</span><span class="nav-item__label">${escapeHtml(item.label)}</span>`;
      button.addEventListener("click", () => setPage(item.id));
      sidebar.appendChild(button);
    });
    sidebar.appendChild(renderSidebarDivider());
    sidebar.appendChild(renderPlaylistSection());
    sidebar.appendChild(renderAccountSection());
    refreshQuickThemeModeUi();
    void refreshSidebarPlaylists?.();
  }

  function toggleQueuePanel() {
    const panel = document.getElementById("queue-panel");
    const button = document.getElementById("queue-toggle");
    const launcher = document.getElementById("btn-dock-queue");
    if (!panel || !button) return;
    panel.classList.toggle("collapsed");
    const collapsed = panel.classList.contains("collapsed");
    panel.setAttribute("aria-hidden", collapsed ? "true" : "false");
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    launcher?.setAttribute("aria-expanded", collapsed ? "false" : "true");
    launcher?.classList.toggle("is-on", !collapsed);
    renderQueuePanel();
  }

  function wireQueueToggle() {
    document.getElementById("queue-toggle")?.addEventListener("click", () => toggleQueuePanel());
  }

  function renderSidebarDivider() {
    const divider = document.createElement("div");
    divider.className = "sidebar-divider";
    return divider;
  }

  function renderPlaylistSection() {
    const wrap = document.createElement("div");
    wrap.className = "sidebar-playlist-section";
    const header = document.createElement("div");
    header.className = "sidebar-playlist-header";
    const title = document.createElement("div");
    title.className = "sidebar-playlist-title";
    title.textContent = "我的歌单";
    const button = document.createElement("button");
    button.type = "button";
    button.id = "btn-sidebar-new-playlist";
    button.className = "sidebar-pl-add";
    button.title = "新建歌单";
    button.setAttribute("aria-label", "新建歌单");
    button.innerHTML = navIconSvg("playlist");
    button.addEventListener("click", onCreatePlaylist);
    header.appendChild(title);
    header.appendChild(button);
    const list = document.createElement("ul");
    list.id = "sidebar-playlist-list";
    list.className = "sidebar-playlist-list";
    wrap.appendChild(header);
    wrap.appendChild(list);
    return wrap;
  }

  function renderAccountSection() {
    const wrap = document.createElement("div");
    wrap.className = "sidebar-account";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sidebar-account__button";
    button.setAttribute("aria-label", "CloudPlayer 菜单");
    button.innerHTML = `
      <span class="sidebar-account__mark" aria-hidden="true">${appLogoMarkSvg()}</span>
      <span class="sidebar-account__meta"><strong>CloudPlayer</strong></span>
      <span class="sidebar-account__chevron" aria-hidden="true">${navIconSvg("chevron-up-down")}</span>
    `;
    const menu = document.createElement("div");
    menu.className = "sidebar-account__menu";
    sidebarMenuItems.forEach((item) => {
      const menuButton = document.createElement("button");
      menuButton.type = "button";
      menuButton.className = "sidebar-account__menu-item";
      menuButton.innerHTML = `<span class="sidebar-account__menu-icon">${navIconSvg(item.icon)}</span><span class="sidebar-account__menu-text">${escapeHtml(item.label)}</span>`;
      menuButton.addEventListener("click", () => {
        if (item.id === "account-login") {
          onLoginAccount?.();
          return;
        }
        setPage(item.id);
      });
      menu.appendChild(menuButton);
    });
    menu.appendChild(renderThemeModeSection());
    wrap.appendChild(button);
    wrap.appendChild(menu);
    return wrap;
  }

  function renderThemeModeSection() {
    const section = document.createElement("div");
    section.className = "sidebar-account__menu-section";
    section.innerHTML = `
      <div class="sidebar-account__submenu-row">
        <button type="button" class="sidebar-account__menu-item sidebar-account__menu-item--fly" aria-haspopup="menu" aria-expanded="false">
          <span class="sidebar-account__menu-icon">${navIconSvg("appearance")}</span>
          <span class="sidebar-account__menu-text">外观模式</span>
        </button>
        <div class="sidebar-account__submenu-panel">
          <button type="button" class="sidebar-account__menu-item" data-quick-theme-mode="system">跟随系统</button>
          <button type="button" class="sidebar-account__menu-item" data-quick-theme-mode="light">浅色</button>
          <button type="button" class="sidebar-account__menu-item" data-quick-theme-mode="dark">深色</button>
        </div>
      </div>
    `;
    section.querySelectorAll("[data-quick-theme-mode]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        applyQuickThemeMode(button.getAttribute("data-quick-theme-mode") || "system");
      });
    });
    return section;
  }

  async function onCreatePlaylist(event) {
    event.preventDefault();
    event.stopPropagation();
    onNewPlaylist?.();
  }

  return { renderSidebar, setPage, toggleQueuePanel, wireQueueToggle };
}
