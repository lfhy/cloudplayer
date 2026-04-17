async function init() {
  /** Tauri 移动端：Android / iOS 共用乐库壳，与桌面 DOM 完全隔离（仅复用 mobile-ui.js 逻辑） */
  let isMobileShell = false;
  try {
    const { platform } = await import("@tauri-apps/plugin-os");
    const p = platform();
    isMobileShell = p === "android" || p === "ios";
  } catch {
    isMobileShell = false;
  }

  // 浏览器仅看 UI：http://localhost:1420/?cp_mobile=1（无后端，列表/搜索会提示需在 App 内使用）
  const qs = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
  const previewMobileUi = qs.get("cp_mobile") === "1";
  if (!isMobileShell && previewMobileUi) {
    isMobileShell = true;
  }

  const app = document.getElementById("app");
  const mob = document.getElementById("mobile-app");
  if (!app || !mob) {
    const { startDesktop } = await import("./main.js");
    startDesktop();
    return;
  }

  if (isMobileShell) {
    document.body.classList.add("shell-mobile");
    app.hidden = true;
    app.setAttribute("inert", "");
    mob.hidden = false;
    const { startMobileApp } = await import("./mobile-ui.js");
    startMobileApp();
  } else {
    const { startDesktop } = await import("./main.js");
    startDesktop();
  }
}

void init();
