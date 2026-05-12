import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { Window as RuntimeWindow } from "@wailsio/runtime";

const ACCOUNT_CENTER_LABEL = "account-center";
const ACCOUNT_CENTER_URL = "/account_center.html";
const ACCOUNT_CENTER_WIDTH = 472;
const ACCOUNT_CENTER_HEIGHT = 368;

// Account center opener keeps the main window responsible only for spawning and focusing the child window.
export function createAccountCenterController() {
  function accountCenterProvider(provider = "kugou") {
    return provider === "netease" ? "netease" : "kugou";
  }

  function accountCenterUrl(provider = "kugou") {
    return `${ACCOUNT_CENTER_URL}?provider=${encodeURIComponent(accountCenterProvider(provider))}`;
  }

  async function accountCenterBounds() {
    try {
      const mainWindow = RuntimeWindow.Get("main");
      const position = await mainWindow.Position();
      const size = await mainWindow.Size();
      return {
        width: ACCOUNT_CENTER_WIDTH,
        height: ACCOUNT_CENTER_HEIGHT,
        x: position.x + Math.round((size.width - ACCOUNT_CENTER_WIDTH) / 2),
        y: position.y + Math.max(28, Math.round((size.height - ACCOUNT_CENTER_HEIGHT) / 3)),
      };
    } catch (error) {
      console.warn("account center bounds", error);
      return { width: ACCOUNT_CENTER_WIDTH, height: ACCOUNT_CENTER_HEIGHT, x: 120, y: 120 };
    }
  }

  async function openAccountCenter(provider = "kugou") {
    const bounds = await accountCenterBounds();
    await DesktopService.EnsureWindow({
      label: ACCOUNT_CENTER_LABEL,
      url: accountCenterUrl(provider),
      title: "登录账号",
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      resizable: false,
      always_on_top: true,
      decorations: true,
      transparent: false,
      shadow: true,
      skip_taskbar: true,
      focus: true,
      mac_title_bar_style: "hiddenInset",
      invisible_title_bar_height: 44,
    });
  }

  function wireAccountCenter() {}

  return { openAccountCenter, wireAccountCenter };
}
