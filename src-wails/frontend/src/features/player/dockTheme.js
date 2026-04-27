// Dock theme helpers keep quick-switch UI state separate from the dock controller body.
export function createDockThemeHelpers(deps) {
  const { getSettingsFormValues, navIconSvg, normalizeAppThemeMode, queueSettingsAutosave, setThemeModeSelection, applyAppTheme, labels } = deps;

  function effectiveQuickThemeMode(mode) {
    const normalized = normalizeAppThemeMode(mode);
    if (normalized === "system") return "system";
    if (normalized === "light") return "light";
    return "dark";
  }

  function refreshQuickThemeModeUi(mode = getSettingsFormValues().mode) {
    const quickMode = effectiveQuickThemeMode(mode);
    document.querySelectorAll("[data-quick-theme-mode]").forEach((el) => {
      const active = el.getAttribute("data-quick-theme-mode") === quickMode;
      el.classList.toggle("is-active", active);
      if (el.classList.contains("dock-menu__item") || el.classList.contains("sidebar-account__menu-item")) {
        el.setAttribute("aria-checked", active ? "true" : "false");
      }
    });
    const dockBtn = document.getElementById("dock-theme-mode");
    if (!dockBtn) return;
    const iconName = quickMode === "system" ? "appearance-system" : quickMode === "light" ? "appearance-light" : "appearance-dark";
    dockBtn.innerHTML = navIconSvg(iconName);
    dockBtn.dataset.quickThemeMode = quickMode;
    dockBtn.title = `界面模式：${labels[quickMode] || "外观"}（点击切换）`;
    dockBtn.setAttribute("aria-label", dockBtn.title);
  }

  function nextQuickThemeMode(mode) {
    if (mode === "system") return "light";
    if (mode === "light") return "dark";
    return "system";
  }

  function resolveDarkThemeModeFallback(mode) {
    const normalized = normalizeAppThemeMode(mode);
    return normalized !== "system" && normalized !== "light" ? normalized : "graphite";
  }

  function applyQuickThemeMode(nextQuickMode) {
    const current = getSettingsFormValues();
    const targetMode = nextQuickMode === "light" ? "light" : nextQuickMode === "dark" ? resolveDarkThemeModeFallback(current.mode) : "system";
    setThemeModeSelection(targetMode);
    const updated = getSettingsFormValues();
    applyAppTheme(updated.theme, updated.customAccent, updated.mode);
    queueSettingsAutosave(true);
  }

  return { applyQuickThemeMode, effectiveQuickThemeMode, nextQuickThemeMode, refreshQuickThemeModeUi };
}
