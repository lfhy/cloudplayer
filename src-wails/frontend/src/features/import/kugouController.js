import { createKugouSessionBridge } from "../kugou/session.js";
import { proxyRemoteAssetSrc } from "../../wails/tauri-core.js";

// Kugou import controller owns login-mode switching and playlist selection inside the import page.
export function createImportKugouController(deps) {
  const { alertRequestFailed, escapeHtml, invoke, setImportDraft, refreshPlaylistSelect } = deps;
  const session = createKugouSessionBridge({ alertRequestFailed, invoke });
  let selectedIDs = new Set();

  function loginStatusEl() {
    return document.getElementById("import-kugou-login-status");
  }

  function playlistListEl() {
    return document.getElementById("import-kugou-playlist-list");
  }

  function selectionHintEl() {
    return document.getElementById("import-kugou-selection-hint");
  }

  function readSelectedPlaylistIDs() {
    return Array.from(selectedIDs.values());
  }

  function setLoginUiVisible(visible) {
    const loginShell = document.getElementById("import-kugou-login-shell");
    const logoutButton = document.getElementById("btn-import-kugou-logout");
    const refreshButton = document.getElementById("btn-import-kugou-refresh");
    const selectAllButton = document.getElementById("btn-import-kugou-select-all");
    const clearButton = document.getElementById("btn-import-kugou-clear");
    const importButton = document.getElementById("btn-import-kugou-import");
    const headCopy = document.getElementById("import-kugou-head-copy");
    if (loginShell) loginShell.hidden = !visible;
    if (logoutButton) logoutButton.hidden = visible;
    if (refreshButton) refreshButton.hidden = visible;
    if (selectAllButton) selectAllButton.hidden = visible;
    if (clearButton) clearButton.hidden = visible;
    if (importButton) importButton.hidden = visible;
    if (headCopy) {
      headCopy.textContent = visible
        ? "登录酷狗概念版后勾选要同步的歌单，导入结果会统一进入保存步骤。"
        : "当前账号已连接，可直接刷新并勾选要导入的歌单。";
    }
  }

  function setMode(mode = "qr") {
    document.querySelectorAll("[data-kugou-login-mode]").forEach((button) => {
      const active = button.getAttribute("data-kugou-login-mode") === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const qrPanel = document.getElementById("import-kugou-qr-panel");
    const smsPanel = document.getElementById("import-kugou-sms-panel");
    if (qrPanel) qrPanel.hidden = mode !== "qr";
    if (smsPanel) smsPanel.hidden = mode !== "sms";
  }

  function updateSelectionHint() {
    const count = selectedIDs.size;
    if (!selectionHintEl()) return;
    selectionHintEl().textContent = count > 0 ? `已选择 ${count} 个歌单。` : "还没有选择歌单。";
  }

  function renderPlaylists(rows) {
    const host = playlistListEl();
    if (!host) return;
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      host.innerHTML = '<p class="muted">当前没有可导入的酷狗歌单。</p>';
      updateSelectionHint();
      return;
    }
    host.innerHTML = items.map((row) => {
      const checked = selectedIDs.has(Number(row.id));
      const cover = row.cover_url || row.coverUrl || row.CoverURL || "";
      const coverSrc = proxyRemoteAssetSrc(cover);
      const suffix = row.track_count ? `${row.track_count} 首` : "歌单";
      return `
        <label class="import-kugou-playlist-row">
          <input type="checkbox" class="import-kugou-playlist-row__checkbox" data-kugou-playlist-id="${row.id}" ${checked ? "checked" : ""} />
          <span class="import-kugou-playlist-row__cover">${coverSrc ? `<img src="${coverSrc}" alt="" />` : "♪"}</span>
          <span class="import-kugou-playlist-row__meta">
            <strong>${escapeHtml(row.name || "")}</strong>
            <span class="muted">${escapeHtml(suffix)}</span>
          </span>
        </label>
      `;
    }).join("");
    host.querySelectorAll("[data-kugou-playlist-id]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = Number(checkbox.getAttribute("data-kugou-playlist-id") || 0);
        if (checkbox.checked) selectedIDs.add(id);
        else selectedIDs.delete(id);
        updateSelectionHint();
      });
    });
    updateSelectionHint();
  }

  function renderLoginStatus(status) {
    if (!loginStatusEl()) return;
    if (status?.logged_in) {
      setLoginUiVisible(false);
      loginStatusEl().textContent = `已登录酷狗概念版 · ${status.nickname || status.user_id || status.userId || ""}`;
      return;
    }
    setLoginUiVisible(true);
    if (status?.status === "scanned") {
      loginStatusEl().textContent = "已扫码，等待确认…";
      return;
    }
    if (status?.status === "waiting") {
      loginStatusEl().textContent = "等待扫码登录…";
      return;
    }
    loginStatusEl().textContent = "未登录酷狗概念版。";
  }

  async function refreshLoginStatus() {
    const status = await session.getLoginStatus();
    renderLoginStatus(status);
    if (status?.logged_in) await refreshPlaylists();
    else renderPlaylists([]);
    return status;
  }

  async function refreshPlaylists() {
    const rows = await session.listPlaylists();
    renderPlaylists(rows || []);
    return rows;
  }

  async function importSelectedPlaylists() {
    const listIds = readSelectedPlaylistIDs();
    if (!listIds.length) {
      window.alert("请先选择至少一个酷狗歌单。");
      return;
    }
    const result = await invoke("sync_kugou_playlists", { listIds });
    const tracks = result?.tracks || [];
    setImportDraft(tracks, {
      suggestedName: result?.playlist_name || result?.playlistName || "酷狗导入歌单",
      method: "kugou",
      statusText: `已从酷狗导入 ${tracks.length} 首歌曲，请确认名称后保存。`,
    });
    await refreshPlaylistSelect();
  }

  function wireModeSwitch() {
    document.querySelectorAll("[data-kugou-login-mode]").forEach((button) => {
      button.addEventListener("click", () => setMode(button.getAttribute("data-kugou-login-mode") || "qr"));
    });
  }

  function wireActions() {
    document.getElementById("btn-import-kugou-qr")?.addEventListener("click", async () => {
      try {
        const qr = await session.createQRCode();
        const image = document.getElementById("import-kugou-qr-image");
        if (image) {
          image.src = qr?.base64 || "";
          image.hidden = !qr?.base64;
        }
        renderLoginStatus({ status: "waiting", logged_in: false });
        void session.pollQRCode(async (status) => {
          renderLoginStatus(status);
          if (status?.logged_in) await refreshPlaylists();
        });
      } catch (error) {
        alertRequestFailed(error, "create_kugou_login_qr_code");
      }
    });
    document.getElementById("btn-import-kugou-copy-qr")?.addEventListener("click", async () => {
      const { qrURL } = session.state();
      if (!qrURL) return;
      try {
        await navigator.clipboard.writeText(qrURL);
        if (loginStatusEl()) loginStatusEl().textContent = "已复制酷狗概念版登录链接。";
      } catch (error) {
        alertRequestFailed(error, "copy kugou login url");
      }
    });
    document.getElementById("btn-import-kugou-captcha")?.addEventListener("click", async () => {
      const mobile = document.getElementById("import-kugou-mobile")?.value?.trim() || "";
      try {
        const result = await session.sendCaptcha(mobile);
        if (loginStatusEl()) loginStatusEl().textContent = result?.message || "验证码已发送。";
      } catch (error) {
        alertRequestFailed(error, "send_kugou_login_captcha");
      }
    });
    document.getElementById("btn-import-kugou-sms-login")?.addEventListener("click", async () => {
      const mobile = document.getElementById("import-kugou-mobile")?.value?.trim() || "";
      const code = document.getElementById("import-kugou-code")?.value?.trim() || "";
      try {
        const status = await session.loginByCellphone(mobile, code);
        renderLoginStatus(status);
        await refreshPlaylists();
      } catch (error) {
        alertRequestFailed(error, "login_kugou_by_cellphone");
      }
    });
    document.getElementById("btn-import-kugou-refresh")?.addEventListener("click", () => void refreshPlaylists());
    document.getElementById("btn-import-kugou-logout")?.addEventListener("click", async () => {
      try {
        await session.logout();
        selectedIDs = new Set();
        renderLoginStatus({ status: "logged_out", logged_in: false });
        renderPlaylists([]);
      } catch (error) {
        alertRequestFailed(error, "logout_kugou");
      }
    });
    document.getElementById("btn-import-kugou-select-all")?.addEventListener("click", () => {
      playlistListEl()?.querySelectorAll("[data-kugou-playlist-id]").forEach((checkbox) => {
        checkbox.checked = true;
        selectedIDs.add(Number(checkbox.getAttribute("data-kugou-playlist-id") || 0));
      });
      updateSelectionHint();
    });
    document.getElementById("btn-import-kugou-clear")?.addEventListener("click", () => {
      selectedIDs = new Set();
      playlistListEl()?.querySelectorAll("[data-kugou-playlist-id]").forEach((checkbox) => {
        checkbox.checked = false;
      });
      updateSelectionHint();
    });
    document.getElementById("btn-import-kugou-import")?.addEventListener("click", () => void importSelectedPlaylists());
  }

  function wireKugouImport() {
    wireModeSwitch();
    wireActions();
    setMode("qr");
    setLoginUiVisible(true);
    void refreshLoginStatus().catch((error) => alertRequestFailed(error, "get_kugou_login_status"));
  }

  return { refreshKugouImport: refreshLoginStatus, wireKugouImport };
}
