import { coverImgHtml } from "../../app/helpers/covers.js";

// Download page helpers isolate queue rendering and download-folder selection.
export function createDownloadController(deps) {
  const {
    alertRequestFailed,
    escapeHtml,
    getDownloadTasks,
    invoke,
    messageRequestFailed,
    open,
    setLocalLibraryRows,
    updateHomeAfterQueueChange,
    warnRequestFailed,
  } = deps;

  function renderDownloadQueueTable() {
    const tbody = document.querySelector("#download-queue-table tbody");
    if (!tbody) return;
    const rows = [...getDownloadTasks().values()];
    if (!rows.length) {
      tbody.innerHTML = "";
      return;
    }
    tbody.innerHTML = "";
    rows.forEach((row) => tbody.appendChild(buildDownloadRow(row)));
  }

  function updateDownloadFolderHint(path) {
    const hint = document.getElementById("download-folder-hint");
    if (!hint) return;
    hint.textContent = path && String(path).trim() ? `当前：${path}` : "默认：用户音乐/CloudPlayer";
  }

  async function refreshLocalLibraryTable() {
    try {
      const rows = await invoke("list_local_songs");
      const nextRows = Array.isArray(rows) ? rows : [];
      setLocalLibraryRows(nextRows);
      return nextRows;
    } catch (error) {
      warnRequestFailed(error, "list_local_songs");
      return [];
    }
  }

  function wireDownloadPage() {
    document.getElementById("btn-pick-download-folder")?.addEventListener("click", async () => {
      const hint = document.getElementById("download-folder-hint");
      try {
        const settings = await invoke("get_settings");
        const current =
          ((settings && (settings.download_folder || settings.downloadFolder)) || "").trim();
        const picked = await open({
          directory: true,
          multiple: false,
          defaultPath: current || undefined,
          title: "选择下载保存目录",
        });
        if (picked == null) return;
        const folder = Array.isArray(picked) ? picked[0] : picked;
        if (!folder || !String(folder).trim()) return;
        const nextPath = String(folder).trim();
        await invoke("save_settings", { patch: { download_folder: nextPath } });
        updateDownloadFolderHint(nextPath);
      } catch (error) {
        if (hint) hint.textContent = messageRequestFailed;
        alertRequestFailed(error, "pick download folder");
      }
    });
  }

  function applyDownloadTaskChanged(payload) {
    const sourceId = payload?.source_id ?? payload?.sourceId;
    if (sourceId == null || String(sourceId) === "") return;
    getDownloadTasks().set(String(sourceId), payload);
    renderDownloadQueueTable();
    updateHomeAfterQueueChange();
  }

  function buildDownloadRow(task) {
    const tr = document.createElement("tr");
    const cover = coverImgHtml({ src: task.cover_url || task.coverUrl || "", className: "row-cover", width: 40, height: 40, radius: 4, alt: task.title || "" });
    const progress = Math.round((task.progress ?? 0) * 100);
    const status = task.status || "";
    const rawMessage = (task.message && String(task.message)) || "";
    const message = status === "failed" && rawMessage ? messageRequestFailed : rawMessage;
    tr.innerHTML = `
      <td class="col-cover">${cover}</td>
      <td>${task.artist ? `<span class="t-title">${escapeHtml(task.title || "—")}</span><span class="t-art">${escapeHtml(task.artist)}</span>` : `<span class="t-title">${escapeHtml(task.title || "—")}</span>`}</td>
      <td class="muted">${escapeHtml(downloadStatusText(status))}</td>
      <td class="muted">${escapeHtml(downloadQualityText(task.quality || ""))}</td>
      <td class="muted col-dlprog">${escapeHtml(String(progress))}%${message ? ` · ${escapeHtml(message)}` : ""}</td>`;
    return tr;
  }

  function downloadQualityText(value) {
    switch (String(value || "").trim().toLowerCase()) {
      case "flac":
        return "FLAC";
      case "320":
        return "320";
      default:
        return "128";
    }
  }

  function downloadStatusText(value) {
    switch (String(value || "").trim().toLowerCase()) {
      case "queued":
        return "排队中";
      case "downloading":
        return "下载中";
      case "completed":
        return "已完成";
      case "failed":
        return "失败";
      default:
        return value || "—";
    }
  }

  return {
    applyDownloadTaskChanged,
    refreshLocalLibraryTable,
    renderDownloadQueueTable,
    updateDownloadFolderHint,
    wireDownloadPage,
  };
}
