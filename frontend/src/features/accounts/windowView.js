import { normalizeMusicCollectionMode } from "../../app/helpers/platformTheme.js";
import { iconSvgByName } from "../../app/helpers/icons.js";
import { proxyRemoteAssetSrc } from "../../wails/tauri-core.js";
import { createKugouSessionBridge } from "../kugou/session.js";
import { applyCollectionModeState, formatAccountID, wireKugouCollectionModeToggle } from "./collectionModeUi.js";
import { kugouAccountPanelTemplate } from "./kugouAccountPanel.js";
import { ACCOUNT_PROVIDERS } from "./providers.js";

// Account-center view owns provider tabs and Kugou login state inside the standalone child window.
export function createAccountCenterView(deps) {
  const {
    alertRequestFailed,
    closeAccountCenter,
    escapeHtml,
    invoke,
    onImportRequested,
    onKugouAuthChanged,
    onKugouStatusChanged,
    onLayoutSettled,
    onOnlineModeToggleRequested,
  } = deps;
  const kugou = createKugouSessionBridge({ alertRequestFailed, invoke, onAuthChanged: onKugouAuthChanged });
  let activeProvider = "kugou";
  let collectionMode = "offline";

  function providerListEl() { return document.getElementById("account-center-provider-list"); }
  function panelEl() { return document.getElementById("account-center-panel"); }
  function kugouPanelEl() { return panelEl()?.querySelector('[data-account-provider-panel="kugou"]'); }
  function kugouLoadingEl() { return document.getElementById("account-kugou-loading"); }
  function kugouCollectionModeWrapEl() { return document.getElementById("account-kugou-collection-mode-wrap"); }

  function notifyLayoutSettled(delay = 90) { window.setTimeout(() => onLayoutSettled?.(), delay); }

  function openAccountCenter(provider = "kugou") {
    activeProvider = provider;
    renderProviderTabs();
    renderProviderPanel();
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
          class="account-center-tab${active ? " is-active" : ""}"
          data-account-provider="${provider.key}"
          role="tab"
          aria-selected="${active ? "true" : "false"}"
          ${disabled}
        >
          <span class="account-center-tab__icon">${iconSvgByName(provider.icon)}</span>
          <span class="account-center-tab__text">${escapeHtml(provider.title)}</span>
        </button>
      `;
    }).join("");
    host.querySelectorAll("[data-account-provider]").forEach((button) => {
      button.addEventListener("click", () => {
        activeProvider = button.getAttribute("data-account-provider") || "kugou";
        renderProviderTabs();
        renderProviderPanel();
      });
    });
  }

  function renderProviderPanel() {
    const host = panelEl();
    if (!host) return;
    host.innerHTML = activeProvider === "kugou"
      ? kugouAccountPanelTemplate()
      : '<div class="account-provider-empty"><strong>网易云音乐</strong><p class="muted">账号接入即将支持。</p></div>';
    if (activeProvider === "kugou") {
      wireKugouPanel();
    }
    notifyLayoutSettled(30);
  }

  function setKugouState(state) { kugouPanelEl()?.setAttribute("data-account-state", state); }

  function setCollectionModeState({ mode = "offline", visible = false, busy = false } = {}) {
    collectionMode = applyCollectionModeState({
      mode,
      visible,
      busy,
      wrap: kugouCollectionModeWrapEl(),
      hiddenInput: document.getElementById("account-kugou-collection-mode"),
    });
  }

  async function refreshCollectionModeState() {
    try {
      const settings = await invoke("get_settings");
      collectionMode = normalizeMusicCollectionMode(settings?.music_collection_mode ?? settings?.musicCollectionMode ?? ((settings?.music_online_mode ?? settings?.musicOnlineMode) ? "online" : "offline"));
    } catch (error) {
      console.warn("get_settings for account collection mode", error);
      collectionMode = "offline";
    }
    setCollectionModeState({ mode: collectionMode, visible: false, busy: false });
    return collectionMode;
  }

  function setKugouLoading(loading, message = "正在同步登录状态...") {
    const loadingEl = kugouLoadingEl();
    const textEl = document.getElementById("account-kugou-loading-text");
    if (textEl) textEl.textContent = message;
    if (loadingEl) loadingEl.hidden = !loading;
    kugouPanelEl()?.setAttribute("aria-busy", loading ? "true" : "false");
  }

  function setKugouLoginControlsVisible(visible) {
    const root = kugouPanelEl();
    const modeSwitch = root?.querySelector(".account-provider-mode-switch");
    const smsPanel = root?.querySelector("#account-kugou-sms-panel");
    const qrPanel = root?.querySelector("#account-kugou-qr-panel");
    if (modeSwitch) modeSwitch.hidden = !visible;
    if (!visible) {
      if (smsPanel) smsPanel.hidden = true;
      if (qrPanel) qrPanel.hidden = true;
      return;
    }
    const activeMode = root?.querySelector("[data-account-kugou-mode].is-active")?.getAttribute("data-account-kugou-mode") || "sms";
    if (smsPanel) smsPanel.hidden = activeMode !== "sms";
    if (qrPanel) qrPanel.hidden = activeMode !== "qr";
  }

  async function setKugouMode(mode = "sms") {
    const root = kugouPanelEl();
    root?.querySelectorAll("[data-account-kugou-mode]").forEach((button) => {
      const active = button.getAttribute("data-account-kugou-mode") === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const qrPanel = root?.querySelector("#account-kugou-qr-panel");
    const smsPanel = root?.querySelector("#account-kugou-sms-panel");
    if (qrPanel) qrPanel.hidden = mode !== "qr";
    if (smsPanel) smsPanel.hidden = mode !== "sms";
    notifyLayoutSettled();
    if (mode === "qr") await ensureKugouQRCode();
  }

  function renderKugouGuest() {
    const status = document.getElementById("account-kugou-status");
    const profile = document.getElementById("account-kugou-profile");
    const logout = document.getElementById("btn-account-kugou-logout");
    const importBtn = document.getElementById("btn-account-kugou-open-import");
    setCollectionModeState({ mode: collectionMode, visible: false, busy: false });
    setKugouState("guest");
    if (status) status.textContent = "登录后可同步账号状态与云歌单。";
    if (profile) profile.hidden = true;
    if (logout) logout.hidden = true;
    if (importBtn) importBtn.hidden = true;
    setKugouLoginControlsVisible(true);
  }

  function renderKugouStatus(status) {
    const statusEl = document.getElementById("account-kugou-status");
    const profileEl = document.getElementById("account-kugou-profile");
    const avatarEl = document.getElementById("account-kugou-avatar");
    const nameEl = document.getElementById("account-kugou-name");
    const detailEl = document.getElementById("account-kugou-detail");
    const logoutEl = document.getElementById("btn-account-kugou-logout");
    const importEl = document.getElementById("btn-account-kugou-open-import");
    const loggedIn = !!status?.logged_in;
    const expired = status?.status === "expired";
    if (!loggedIn && !expired) {
      renderKugouGuest();
      notifyLayoutSettled();
      return;
    }
    setKugouState(loggedIn ? "logged-in" : "expired");
    const nickname = status?.nickname || "酷狗概念版";
    const userID = formatAccountID(status?.user_id || status?.userId || "");
    if (profileEl) profileEl.hidden = false;
    if (logoutEl) logoutEl.hidden = false;
    if (importEl) importEl.hidden = !loggedIn;
    setCollectionModeState({ mode: collectionMode, visible: loggedIn, busy: false });
    setKugouLoginControlsVisible(!loggedIn);
    if (nameEl) nameEl.textContent = nickname;
    if (detailEl) detailEl.textContent = loggedIn ? `已登录 · ${userID || "当前账号"}` : `登录已过期 · ${userID || "请重新登录"}`;
    if (statusEl) {
      statusEl.textContent = loggedIn ? "账号已连接，可直接同步歌单。" : "登录已过期，请重新登录。";
    }
    if (avatarEl) {
      const avatarURL = status?.avatar_url || status?.avatarUrl || "";
      avatarEl.textContent = avatarURL ? "" : nickname.slice(0, 1).toUpperCase();
      avatarEl.style.backgroundImage = avatarURL ? `url("${proxyRemoteAssetSrc(avatarURL)}")` : "";
      avatarEl.classList.toggle("is-image", !!avatarURL);
    }
    notifyLayoutSettled();
  }

  async function refreshKugouAccountStatus() {
    setKugouState("loading");
    setKugouLoading(true);
    try {
      await refreshCollectionModeState();
      const status = await kugou.getLoginStatus();
      renderKugouStatus(status);
      onKugouStatusChanged?.(status);
      return status;
    } catch (error) {
      renderKugouGuest();
      alertRequestFailed(error, "get_kugou_login_status");
      notifyLayoutSettled();
      return null;
    } finally {
      setKugouLoading(false);
    }
  }

  async function ensureKugouQRCode() {
    try {
      const qr = await kugou.createQRCode();
      const image = document.getElementById("account-kugou-qr-image");
      if (image) {
        image.src = qr?.base64 || "";
        image.hidden = !qr?.base64;
      }
      const statusEl = document.getElementById("account-kugou-status");
      if (statusEl) statusEl.textContent = "等待扫码登录...";
      notifyLayoutSettled();
      void kugou.pollQRCode((status) => {
        renderKugouStatus(status);
        onKugouStatusChanged?.(status);
      });
    } catch (error) {
      alertRequestFailed(error, "create_kugou_login_qr_code");
    }
  }

  function wireKugouPanel() {
    void setKugouMode("sms");
    renderKugouGuest();
    kugouPanelEl()?.querySelectorAll("[data-account-kugou-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        void setKugouMode(button.getAttribute("data-account-kugou-mode") || "sms");
      });
    });
    document.getElementById("btn-account-kugou-captcha")?.addEventListener("click", async () => {
      try {
        const mobile = document.getElementById("account-kugou-mobile")?.value?.trim() || "";
        const result = await kugou.sendCaptcha(mobile);
        const statusEl = document.getElementById("account-kugou-status");
        if (statusEl) statusEl.textContent = result?.message || "验证码已发送。";
        notifyLayoutSettled();
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
    document.getElementById("btn-account-kugou-open-import")?.addEventListener("click", async () => {
      await onImportRequested?.("kugou");
    });
    wireKugouCollectionModeToggle({
      alertRequestFailed,
      getCurrentMode: () => collectionMode,
      getWrapEl: kugouCollectionModeWrapEl,
      notifyLayoutSettled,
      onOnlineModeToggleRequested,
      setCollectionModeState,
      setCurrentMode: (mode) => {
        collectionMode = normalizeMusicCollectionMode(mode);
      },
      setKugouLoading,
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
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void closeAccountCenter?.();
    });
  }

  return { openAccountCenter, refreshKugouAccountStatus, refreshCollectionModeState, wireAccountCenter };
}
