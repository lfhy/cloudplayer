// Icon helpers centralize SVG generation for navigation and compact tool buttons.
import solarIcons from "@iconify-json/solar/icons.json";

export function dockLyricsLockIcon(unlockAction) {
  if (unlockAction) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 10V7.8a3.5 3.5 0 0 0-6-2.5"></path>
        <rect x="6.5" y="10" width="11" height="9.5" rx="2.4"></rect>
        <path d="M12 13.5v2.2"></path>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10"></path>
      <rect x="6.5" y="10" width="11" height="9.5" rx="2.4"></rect>
      <path d="M12 13.5v2.2"></path>
    </svg>
  `;
}

export function appLogoMarkSvg() {
  return `
    <svg viewBox="0 0 120 72" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <rect x="4" y="34" width="6" height="8" rx="3"></rect>
        <rect x="14" y="30" width="6" height="16" rx="3"></rect>
        <rect x="24" y="24" width="6" height="28" rx="3"></rect>
        <rect x="34" y="18" width="6" height="40" rx="3"></rect>
        <rect x="44" y="12" width="6" height="52" rx="3"></rect>
        <rect x="54" y="8" width="6" height="60" rx="3"></rect>
        <rect x="64" y="12" width="6" height="52" rx="3"></rect>
        <rect x="74" y="18" width="6" height="40" rx="3"></rect>
        <rect x="84" y="24" width="6" height="28" rx="3"></rect>
        <rect x="94" y="30" width="6" height="16" rx="3"></rect>
        <rect x="104" y="34" width="6" height="8" rx="3"></rect>
        <rect x="2" y="35" width="116" height="2.5" rx="1.25" opacity="0.92"></rect>
      </g>
    </svg>
  `;
}

export function iconSvgByName(iconName) {
  const icon = solarIcons.icons[iconName];
  if (!icon) return "";
  const width = icon.width || solarIcons.width || 24;
  const height = icon.height || solarIcons.height || 24;
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${icon.body}</svg>`;
}

export function navIconSvg(name) {
  if (name === "appearance-system") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" fill-rule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10s10-4.477 10-10S17.523 2 12 2m-.93 5.75a1 1 0 0 0-.93.63l-2.58 6.45a.75.75 0 1 0 1.392.557l.46-1.137h5.176l.46 1.137a.75.75 0 0 0 1.392-.557l-2.58-6.45a1 1 0 0 0-.93-.63zm.205 1.91L10.02 12.75h3.96l-1.255-3.09a12 12 0 0 1-.27-.721h-.04c-.085.267-.173.507-.27.72" clip-rule="evenodd"/>
      </svg>
    `;
  }
  const icons = {
    home: "home-2-linear",
    search: "magnifer-linear",
    sparkles: "stars-line-duotone",
    clock: "history-linear",
    download: "download-linear",
    library: "library-linear",
    settings: "settings-linear",
    playlist: "playlist-minimalistic-2-linear",
    favorites: "heart-bold",
    "chevron-up-down": "alt-arrow-up-line-duotone",
    appearance: "moon-fog-linear",
    "appearance-light": "sun-2-bold",
    "appearance-dark": "moon-stars-bold",
  };
  const iconName = icons[name] || icons.playlist;
  const icon = solarIcons.icons[iconName];
  if (!icon) return "";
  const width = icon.width || solarIcons.width || 24;
  const height = icon.height || solarIcons.height || 24;
  const rotate = name === "chevron-up-down" ? ' style="transform: rotate(180deg); transform-origin: center;"' : "";
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"${rotate}>${icon.body}</svg>`;
}

export function importMethodIconSvg(method) {
  const icons = { local: "folder-2-bold", share: "link-bold", kugou: "music-library-2-bold", text: "document-text-bold" };
  return iconSvgByName(icons[method] || "folder-2-bold");
}

export function importBackButtonIconSvg() {
  return iconSvgByName("alt-arrow-left-line-duotone");
}
