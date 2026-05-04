import { iconSvgByName } from "../../app/helpers/icons.js";
import { createKugouSessionBridge } from "../kugou/session.js";
import { kugouAccountPanelTemplate } from "./kugouAccountPanel.js";
import { ACCOUNT_PROVIDERS } from "./providers.js";

// Account center owns cross-provider login UX so sidebar and settings can reuse one source of truth.
export function createAccountCenterController(deps) {
  const { alertRequestFailed, escapeHtml, invoke, onKugouStatusChanged, setImportMethod, setImportStep, setPage } = deps;
  const kugou = createKugouSessionBridge({ alertRequestFailed, invoke });
  let activeProvider = "kugou";

  function modalEl() { return document.getElementById("account-center-modal"); }
  function providerListEl() { return document.getElementById("account-center-provider-list"); }
  function panelEl() { return document.getElementById("account-center-panel"); }

  function openAccountCenter(provider = "kugou") {
    activeProvider = provider;
    renderProviderTabs();
    renderProviderPanel();
    modalEl()?.removeAttribute("hidden");
    modalEl()?.setAttribute("aria-hidden", "false");
    if (provider === "kugou") void refreshKugouAccountStatus();
  }

  function closeAccountCenter() {
    modalEl()?.setAttribute("hidden", "true");
    modalEl()?.setAttribute("aria-hidden", "true");
  }

  function renderProviderTabs() {
    const host = providerListEl();
    if (!host) return;
    host.innerHTML = ACCOUNT_PROVIDERS.map((provider) => {
      const active = provider.key === activeProvider;
      const disabled = provider.disabled ? "disabled" : "";
      return `
        <button
          type="button"
          class="account-center-provider${active ? " is-active" : ""}"
          data-account-provider="${provider.key}"
          role="tab"
          aria-selected="${active ? "true" : "false"}"
          ${disabled}
        >
          <span class="account-center-provider__icon">${iconSvgByName(provider.icon)}</span>
          <span class="account-center-provider__meta">
            <strong>${escapeHtml(provider.title)}</strong>
            <span>${escapeHtml(provider.subtitle)}</span>
          </span>
        </button>
      `;
    }).join("");
    host.querySelectorAll("[data-account-provider]").forEach((button) => {
      button.addEventListener("click", () => {
        activeProvider = button.getAttribute("data-account-provider") || "kugou";
        renderProviderTabs();
        renderProviderPanel();
        if (activeProvider === "kugou") void refreshKugouAccountStatus();
      });
    });
  }

  function renderProviderPanel() {
    const host = panelEl();
    if (!host) return;
    host.innerHTML = activeProvider === "kugou"
      ? kugouAccountPanelTemplate()
      : '<div class="account-provider-empty"><strong>即将支持</strong><p class="muted">后续会接入这里。</p></div>';
    if (activeProvider === "kugou") wireKugouPanel();
  }

  function setKugouMode(mode = "qr") {
    document.querySelectorAll("[data-account-kugou-mode]").forEach((button) => {
      const active = button.getAttribute("data-account-kugou-mode") === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const qrPanel = document.getElementById("account-kugou-qr-panel");
    const smsPanel = document.getElementById("account-kugou-sms-panel");
    if (qrPanel) qrPanel.hidden = mode !== "qr";
    if (smsPanel) smsPanel.hidden = mode !== "sms";
  }

  function renderKugouGuest() {
    const status = document.getElementById("account-kugou-status");
    const profile = document.getElementById("account-kugou-profile");
    const logout = document.getElementById("btn-account-kugou-logout");
    if (status) status.textContent = "未登录酷狗概念版。";
    if (profile) profile.hidden = true;
    if (logout) logout.hidden = true;
  }

  function renderKugouStatus(status) {
    const statusEl = document.getElementById("account-kugou-status");
    const profileEl = document.getElementById("account-kugou-profile");
    const avatarEl = document.getElementById("account-kugou-avatar");
    const nameEl = document.getElementById("account-kugou-name");
    const detailEl = document.getElementById("account-kugou-detail");
    const logoutEl = document.getElementById("btn-account-kugou-logout");
    const loggedIn = !!status?.logged_in;
    const expired = status?.status === "expired";
    if (!loggedIn && !expired) return renderKugouGuest();
    const nickname = status?.nickname || "酷狗概念版";
    const userID = status?.user_id || status?.userId || "";
    if (profileEl) profileEl.hidden = false;
    if (logoutEl) logoutEl.hidden = false;
    if (nameEl) nameEl.textContent = nickname;
    if (detailEl) detailEl.textContent = loggedIn ? `已登录 · ${userID || "当前账号"}` : `登录已过期 · ${userID || "请重新登录"}`;
    if (statusEl) {
      statusEl.textContent = loggedIn
        ? "已连接酷狗概念版账号。"
        : "登录已过期，请重新登录。";
    }
    if (avatarEl) {
      const avatarURL = status?.avatar_url || status?.avatarUrl || "";
      avatarEl.textContent = avatarURL ? "" : nickname.slice(0, 1).toUpperCase();
      avatarEl.style.backgroundImage = avatarURL ? `url("${avatarURL}")` : "";
      avatarEl.classList.toggle("is-image", !!avatarURL);
    }
  }

  async function refreshKugouAccountStatus() {
    try {
      const status = await kugou.getLoginStatus();
      renderKugouStatus(status);
      onKugouStatusChanged?.(status);
      return status;
    } catch (error) {
      renderKugouGuest();
      alertRequestFailed(error, "get_kugou_login_status");
      return null;
    }
  }

  function wireKugouPanel() {
    setKugouMode("qr");
    renderKugouGuest();
    document.querySelectorAll("[data-account-kugou-mode]").forEach((button) => {
      button.addEventListener("click", () => setKugouMode(button.getAttribute("data-account-kugou-mode") || "qr"));
    });
    document.getElementById("btn-account-kugou-qr")?.addEventListener("click", async () => {
      try {
        const qr = await kugou.createQRCode();
        const image = document.getElementById("account-kugou-qr-image");
        if (image) {
          image.src = qr?.base64 || "";
          image.hidden = !qr?.base64;
        }
        const statusEl = document.getElementById("account-kugou-status");
        if (statusEl) statusEl.textContent = "等待扫码登录…";
        void kugou.pollQRCode((status) => renderKugouStatus(status));
      } catch (error) {
        alertRequestFailed(error, "create_kugou_login_qr_code");
      }
    });
    document.getElementById("btn-account-kugou-copy-qr")?.addEventListener("click", async () => {
      const { qrURL } = kugou.state();
      if (!qrURL) return;
      try {
        await navigator.clipboard.writeText(qrURL);
        const statusEl = document.getElementById("account-kugou-status");
        if (statusEl) statusEl.textContent = "已复制酷狗概念版登录链接。";
      } catch (error) {
        alertRequestFailed(error, "copy kugou login url");
      }
    });
    document.getElementById("btn-account-kugou-captcha")?.addEventListener("click", async () => {
      try {
        const mobile = document.getElementById("account-kugou-mobile")?.value?.trim() || "";
        const result = await kugou.sendCaptcha(mobile);
        const statusEl = document.getElementById("account-kugou-status");
        if (statusEl) statusEl.textContent = result?.message || "验证码已发送。";
      } catch (error) {
        alertRequestFailed(error, "send_kugou_login_captcha");
      }
    });
    document.getElementById("btn-account-kugou-login")?.addEventListener("click", async () => {
      try {
        const mobile = document.getElementById("account-kugou-mobile")?.value?.trim() || "";
        const code = document.getElementById("account-kugou-code")?.value?.trim() || "";
        const status = await kugou.loginByCellphone(mobile, code);
        renderKugouStatus(status);
        onKugouStatusChanged?.(status);
      } catch (error) {
        alertRequestFailed(error, "login_kugou_by_cellphone");
      }
    });
    document.getElementById("btn-account-kugou-open-import")?.addEventListener("click", () => {
      closeAccountCenter();
      setImportMethod("kugou");
      setImportStep("config");
      setPage("import");
    });
    document.getElementById("btn-account-kugou-logout")?.addEventListener("click", async () => {
      try {
        await kugou.logout();
        renderKugouGuest();
        onKugouStatusChanged?.(null);
      } catch (error) {
        alertRequestFailed(error, "logout_kugou");
      }
    });
    void refreshKugouAccountStatus();
  }

  function wireAccountCenter() {
    document.getElementById("btn-account-center-close")?.addEventListener("click", () => closeAccountCenter());
    modalEl()?.addEventListener("click", (event) => {
      if (event.target?.id === "account-center-modal") closeAccountCenter();
    });
  }

  return { closeAccountCenter, openAccountCenter, refreshKugouAccountStatus, wireAccountCenter };
}
