// Shared frontend constants stay outside the runtime entry to keep feature modules small.
export const NAV = [
  { id: "home", label: "音乐首页", icon: "home" },
  { id: "search", label: "音乐搜索", icon: "search" },
  { id: "daily", label: "每日推荐", icon: "sparkles" },
  { id: "recent", label: "最近播放", icon: "clock" },
];

export const SIDEBAR_MENU_NAV = [
  { id: "account-login", label: "登录账号", icon: "login" },
  { id: "download", label: "下载管理", icon: "download" },
  { id: "import", label: "导入歌单", icon: "library" },
  { id: "settings", label: "偏好设置", icon: "settings" },
];

export const APP_THEMES = {
  coral: { accent: "#c62f2f", accentRgb: "198, 47, 47" },
  ocean: { accent: "#1f6aa5", accentRgb: "31, 106, 165" },
  forest: { accent: "#2f7d4b", accentRgb: "47, 125, 75" },
  netease: { accent: "#d43c33", accentRgb: "212, 60, 51" },
  kugou: { accent: "#1977ff", accentRgb: "25, 119, 255" },
  qqmusic: { accent: "#31c27c", accentRgb: "49, 194, 124" },
};

export const APP_THEME_MODES = new Set(["system", "light", "graphite", "midnight", "forestnight"]);
export const NETWORK_PROXY_MODES = new Set(["direct", "system", "custom"]);
export const MUSIC_SOURCE_PROVIDERS = new Set(["pjmp3", "kugou", "netease"]);
export const SETTINGS_TABS = new Set(["appearance", "network", "source", "controls", "lyrics"]);
export const QUICK_THEME_MODE_LABELS = { system: "跟随系统", light: "浅色", dark: "深色" };

export const PLAY_MODES = [
  { key: "loop_list", icon: "repeat-bold", tip: "列表循环" },
  { key: "one", icon: "repeat-one-bold", tip: "单曲循环" },
  { key: "shuffle", icon: "shuffle-outline", tip: "随机循环" },
];

export const QUALITY_LABELS = { flac: "无损", "320": "HQ", "128": "标准" };
export const RECENT_SESSION_MAX = 100;
export const TRAY_PLAYER_TARGET = { kind: "WebviewWindow", label: "tray-player" };
export const LYRICS_REPLACE_TARGET = { kind: "WebviewWindow", label: "lyrics-replace" };
export const LYRICS_WW_TARGET = { kind: "WebviewWindow", label: "lyrics" };
