import { createKugouSessionBridge } from "../kugou/session.js";

// Settings only shows shared Kugou session status while the full import flow lives on the import page.
export function wireKugouSettingsActions(deps) {
  const { alertRequestFailed, invoke, setPage, setImportMethod, setImportStep } = deps;
  const session = createKugouSessionBridge({ alertRequestFailed, invoke });

  async function refreshStatus() {
    try {
      const status = await session.getLoginStatus();
      const label = status?.logged_in
        ? `已登录酷狗 Lite · ${status.nickname || status.user_id || status.userId || ""}`
        : "未登录酷狗 Lite。";
      const statusEl = document.getElementById("setting-kugou-login-status");
      if (statusEl) statusEl.textContent = label;
    } catch (error) {
      alertRequestFailed(error, "get_kugou_login_status");
    }
  }

  document.getElementById("btn-kugou-open-import")?.addEventListener("click", () => {
    setImportMethod("kugou");
    setImportStep("config");
    setPage("import");
  });

  document.getElementById("btn-kugou-logout")?.addEventListener("click", async () => {
    try {
      await session.logout();
      await refreshStatus();
    } catch (error) {
      alertRequestFailed(error, "logout_kugou");
    }
  });

  void refreshStatus();
  return { refreshStatus };
}
