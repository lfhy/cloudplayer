// Shared Kugou session helpers keep QR polling and login-state copy consistent across import and preferences.
export function createKugouSessionBridge(deps) {
  const { alertRequestFailed, invoke } = deps;
  let qrKey = "";
  let qrURL = "";
  let pollTimer = null;

  function clearPollTimer() {
    if (pollTimer != null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  async function getLoginStatus() {
    return invoke("get_kugou_login_status");
  }

  async function createQRCode() {
    const qr = await invoke("create_kugou_login_qr_code");
    qrKey = qr?.key || "";
    qrURL = qr?.url || "";
    return qr;
  }

  async function pollQRCode(onStatus) {
    if (!qrKey) return null;
    try {
      const status = await invoke("poll_kugou_login_qr_code", { key: qrKey });
      onStatus?.(status, { qrKey, qrURL });
      if (status?.status === "waiting" || status?.status === "scanned") {
        pollTimer = setTimeout(() => void pollQRCode(onStatus), 1800);
      } else {
        clearPollTimer();
      }
      return status;
    } catch (error) {
      clearPollTimer();
      alertRequestFailed(error, "poll_kugou_login_qr_code");
      return null;
    }
  }

  async function sendCaptcha(mobile) {
    return invoke("send_kugou_login_captcha", { mobile });
  }

  async function loginByCellphone(mobile, code) {
    return invoke("login_kugou_by_cellphone", { mobile, code });
  }

  async function listPlaylists() {
    return invoke("list_kugou_playlists");
  }

  async function logout() {
    clearPollTimer();
    qrKey = "";
    qrURL = "";
    return invoke("logout_kugou");
  }

  return {
    clearPollTimer,
    createQRCode,
    getLoginStatus,
    listPlaylists,
    loginByCellphone,
    logout,
    pollQRCode,
    sendCaptcha,
    state: () => ({ qrKey, qrURL }),
  };
}
