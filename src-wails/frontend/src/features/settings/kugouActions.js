// Kugou settings actions keep QR login and playlist sync out of the generic settings button file.
export function wireKugouSettingsActions(deps) {
  const { alertRequestFailed, invoke, setImportDraft, setImportMethod, setImportStep, setPage } = deps;
  let qrKey = "";
  let qrURL = "";
  let pollTimer = null;

  function clearPollTimer() {
    if (pollTimer != null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function statusEl() {
    return document.getElementById("setting-kugou-login-status");
  }

  function qrWrapEl() {
    return document.getElementById("settings-kugou-qr");
  }

  function qrImageEl() {
    return document.getElementById("settings-kugou-qr-image");
  }

  function renderPlaylistSelect(rows) {
    const select = document.getElementById("setting-kugou-playlist-select");
    if (!select) return;
    const items = Array.isArray(rows) ? rows : [];
    select.innerHTML = items.length
      ? items.map((row) => `<option value="${row.id}">${row.name}${row.track_count ? ` · ${row.track_count} 首` : ""}</option>`).join("")
      : '<option value="">暂无可导入歌单</option>';
  }

  async function refreshLoginStatus() {
    try {
      const status = await invoke("get_kugou_login_status");
      const label = status?.nickname ? `已登录酷狗 Lite · ${status.nickname}` : status?.logged_in ? `已登录酷狗 Lite · ${status.user_id || ""}` : "未登录酷狗 Lite。";
      if (statusEl()) statusEl().textContent = label;
      if (status?.logged_in) {
        if (qrWrapEl()) qrWrapEl().hidden = true;
        clearPollTimer();
      }
    } catch (error) {
      alertRequestFailed(error, "get_kugou_login_status");
    }
  }

  async function refreshPlaylists() {
    try {
      const rows = await invoke("list_kugou_playlists");
      renderPlaylistSelect(rows || []);
      if (statusEl()) statusEl().textContent = `已同步 ${Array.isArray(rows) ? rows.length : 0} 个酷狗歌单。`;
    } catch (error) {
      alertRequestFailed(error, "list_kugou_playlists");
    }
  }

  async function pollQRCode() {
    if (!qrKey) return;
    try {
      const status = await invoke("poll_kugou_login_qr_code", { key: qrKey });
      if (status?.status === "waiting" || status?.status === "scanned") {
        if (statusEl()) statusEl().textContent = status.status === "scanned" ? "已扫码，等待确认…" : "等待扫码登录…";
        pollTimer = setTimeout(() => void pollQRCode(), 1800);
        return;
      }
      if (status?.logged_in) {
        if (statusEl()) statusEl().textContent = `已登录酷狗 Lite · ${status.nickname || status.user_id || ""}`;
        if (qrWrapEl()) qrWrapEl().hidden = true;
        clearPollTimer();
        await refreshPlaylists();
        return;
      }
      if (statusEl()) statusEl().textContent = "二维码已过期，请重新生成。";
    } catch (error) {
      clearPollTimer();
      alertRequestFailed(error, "poll_kugou_login_qr_code");
    }
  }

  document.getElementById("btn-kugou-login")?.addEventListener("click", async () => {
    clearPollTimer();
    try {
      const qr = await invoke("create_kugou_login_qr_code");
      qrKey = qr?.key || "";
      qrURL = qr?.url || "";
      if (qrImageEl()) qrImageEl().src = qr?.base64 || "";
      if (qrWrapEl()) qrWrapEl().hidden = !qr?.base64;
      if (statusEl()) statusEl().textContent = "等待扫码登录…";
      void pollQRCode();
    } catch (error) {
      alertRequestFailed(error, "create_kugou_login_qr_code");
    }
  });

  document.getElementById("btn-kugou-copy-qr-url")?.addEventListener("click", async () => {
    if (!qrURL) return;
    try {
      await navigator.clipboard.writeText(qrURL);
      if (statusEl()) statusEl().textContent = "已复制酷狗登录链接。";
    } catch (error) {
      alertRequestFailed(error, "copy kugou login url");
    }
  });

  document.getElementById("btn-kugou-refresh-playlists")?.addEventListener("click", () => void refreshPlaylists());

  document.getElementById("btn-kugou-logout")?.addEventListener("click", async () => {
    clearPollTimer();
    try {
      await invoke("logout_kugou");
      qrKey = "";
      qrURL = "";
      renderPlaylistSelect([]);
      if (qrWrapEl()) qrWrapEl().hidden = true;
      if (statusEl()) statusEl().textContent = "已退出酷狗 Lite。";
    } catch (error) {
      alertRequestFailed(error, "logout_kugou");
    }
  });

  document.getElementById("btn-kugou-import-playlist")?.addEventListener("click", async () => {
    const select = document.getElementById("setting-kugou-playlist-select");
    const listID = Number(select?.value || 0);
    if (!Number.isFinite(listID) || listID <= 0) return;
    try {
      const result = await invoke("sync_kugou_playlist", { listId: listID });
      setImportMethod("share");
      setImportDraft(result?.tracks || [], {
        suggestedName: result?.playlist_name || result?.playlistName || "酷狗同步歌单",
        method: "share",
        statusText: `已从酷狗同步 ${(result?.tracks || []).length} 首歌曲到导入草稿，可直接保存或合并。`,
      });
      setImportStep("result");
      setPage("import");
    } catch (error) {
      alertRequestFailed(error, "sync_kugou_playlist");
    }
  });

  void refreshLoginStatus();
}
