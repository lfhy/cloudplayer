import { Events } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { emitTo } from "../../wails/tauri-event.js";
import { unwrapPayload } from "../../wails/shared.js";

const WINDOW_LABEL = "database-repair";
const WINDOW_URL = "/database_repair.html";
const WINDOW_TARGET = { kind: "WebviewWindow", label: WINDOW_LABEL };
export const MUSIC_COLLECTION_REPAIR_DEFAULT_STATUS = "清理本地缓存的云歌单副本并切回离线模式，之后再次切换到在线 / 混合模式时会重新拉取云歌单。";
let pendingDialog = null;

function normalizeDialogEvent(payload) {
  const data = unwrapPayload(payload);
  return typeof data === "object" && data ? data : { type: "cancelled" };
}

// Database-repair helpers keep the confirm window protocol out of the settings controller.
export function musicCollectionRepairStatusText(result) {
  const removedCloudPlaylists = Math.max(0, Number(result?.removed_cloud_playlists ?? result?.removedCloudPlaylists ?? 0) || 0);
  const detachedCloudBindings = Math.max(0, Number(result?.detached_cloud_bindings ?? result?.detachedCloudBindings ?? 0) || 0);
  const removedPlaylistItems = Math.max(0, Number(result?.removed_playlist_items ?? result?.removedPlaylistItems ?? 0) || 0);
  return `数据库修复完成：已清理 ${removedCloudPlaylists} 个云歌单副本、解除 ${detachedCloudBindings} 个云端绑定，并整理 ${removedPlaylistItems} 条本地云端条目；当前已切回离线模式。`;
}

export function setMusicCollectionRepairBusy(busy, message = MUSIC_COLLECTION_REPAIR_DEFAULT_STATUS) {
  const button = document.getElementById("btn-repair-music-collection-db");
  const status = document.getElementById("setting-music-collection-repair-status");
  if (button) {
    button.disabled = !!busy;
    button.classList.toggle("is-busy", !!busy);
    button.textContent = busy ? "正在修复..." : "修复数据库";
  }
  if (status && message) status.textContent = message;
}

export async function notifyMusicCollectionRepairFinished(requestId, payload = {}) {
  if (!requestId) return;
  await emitTo(WINDOW_TARGET, "settings-database-repair-finished", {
    requestId,
    ...payload,
  });
}

export async function openMusicCollectionRepairDialog() {
  if (pendingDialog) return pendingDialog;
  pendingDialog = new Promise((resolve, reject) => {
    let settled = false;
    let offVisibility = null;
    let offClosing = null;
    const finish = (value, asError = false) => {
      if (settled) return;
      settled = true;
      offVisibility?.();
      offClosing?.();
      if (asError) {
        reject(value);
        return;
      }
      resolve(value);
    };
    Events.Once("settings-database-repair-dialog", (event) => {
      finish(normalizeDialogEvent(event?.data));
    });
    offVisibility = Events.On("wails:window:visibility", (event) => {
      if (String(event?.data?.name || "").trim() !== WINDOW_LABEL) return;
      if (event?.data?.visible === false) {
        finish({ type: "cancelled" });
      }
    });
    offClosing = Events.On("wails:window:closing", (event) => {
      if (String(event?.data?.name || "").trim() !== WINDOW_LABEL) return;
      finish({ type: "cancelled" });
    });
    void DesktopService.EnsureWindow({
      label: WINDOW_LABEL,
      url: WINDOW_URL,
      title: "修复数据库",
      width: 468,
      height: 228,
      center_on_main: true,
      resizable: false,
      always_on_top: true,
      decorations: true,
      transparent: false,
      shadow: true,
      skip_taskbar: true,
      focus: true,
      mac_title_bar_style: "hiddenInset",
      invisible_title_bar_height: 44,
    }).catch((error) => finish(error, true));
  });
  try {
    return await pendingDialog;
  } finally {
    pendingDialog = null;
  }
}
