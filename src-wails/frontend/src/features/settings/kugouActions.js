import { createKugouSessionBridge } from "../kugou/session.js";

// Settings only shows shared Kugou session status while the full import flow lives on the import page.
export function wireKugouSettingsActions(deps) {
  const { alertRequestFailed, invoke, openAccountCenter } = deps;
  const session = createKugouSessionBridge({ alertRequestFailed, invoke });
  const statusEl = () => document.getElementById("setting-kugou-login-status");
  const profileEl = () => document.getElementById("setting-kugou-profile");
  const avatarEl = () => document.getElementById("setting-kugou-avatar");
  const nameEl = () => document.getElementById("setting-kugou-name");
  const detailEl = () => document.getElementById("setting-kugou-detail");
  const logoutBtn = () => document.getElementById("btn-kugou-logout");

  function renderGuest() {
    if (statusEl()) statusEl().textContent = "未登录酷狗概念版。";
    if (profileEl()) profileEl().hidden = true;
    if (logoutBtn()) logoutBtn().hidden = true;
  }

  function renderStatus(status) {
    const loggedIn = !!status?.logged_in;
    const expired = status?.status === "expired";
    if (!loggedIn && !expired) {
      renderGuest();
      return;
    }
    const nickname = status?.nickname || "酷狗概念版";
    const userID = status?.user_id || status?.userId || "";
    if (profileEl()) profileEl().hidden = false;
    if (logoutBtn()) logoutBtn().hidden = !loggedIn && !expired;
    if (nameEl()) nameEl().textContent = nickname;
    if (detailEl()) detailEl().textContent = loggedIn ? `已登录 · ${userID || "当前账号"}` : `登录已过期 · ${userID || "请重新登录"}`;
    if (statusEl()) {
      statusEl().textContent = loggedIn
        ? `已连接酷狗概念版账号，可直接去导入歌单页面同步歌单。`
        : "酷狗概念版登录已过期，请重新进入导入歌单页登录。";
    }
    if (avatarEl()) {
      const avatarURL = status?.avatar_url || status?.avatarUrl || "";
      avatarEl().textContent = avatarURL ? "" : nickname.slice(0, 1).toUpperCase();
      avatarEl().style.backgroundImage = avatarURL ? `url("${avatarURL}")` : "";
      avatarEl().classList.toggle("is-image", !!avatarURL);
    }
  }

  async function refreshStatus() {
    try {
      const status = await session.getLoginStatus();
      renderStatus(status);
    } catch (error) {
      renderGuest();
      alertRequestFailed(error, "get_kugou_login_status");
    }
  }

  document.getElementById("btn-kugou-open-import")?.addEventListener("click", () => {
    openAccountCenter?.("kugou");
  });

  document.getElementById("btn-kugou-logout")?.addEventListener("click", async () => {
    try {
      await session.logout();
      renderGuest();
    } catch (error) {
      alertRequestFailed(error, "logout_kugou");
    }
  });

  renderGuest();
  void refreshStatus();
  return { refreshStatus };
}
