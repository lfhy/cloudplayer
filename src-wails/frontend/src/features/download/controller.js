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
      tbody.innerHTML =
        '<tr><td colspan="4" class="muted">队列为空。在「搜索」、歌单或每日推荐里选择「下载」后会出现在这里。</td></tr>';
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
    const progress = Math.round((task.progress ?? 0) * 100);
    const status = task.status || "";
    const rawMessage = (task.message && String(task.message)) || "";
    const message = status === "failed" && rawMessage ? messageRequestFailed : rawMessage;
    tr.innerHTML = `<td>${escapeHtml(status)}</td><td>${escapeHtml(`${task.title || ""} — ${task.artist || ""}`)}</td><td>${escapeHtml(task.quality || "")}</td><td>${escapeHtml(String(progress))}%${message ? ` · ${escapeHtml(message)}` : ""}</td>`;
    return tr;
  }

  return {
    applyDownloadTaskChanged,
    refreshLocalLibraryTable,
    renderDownloadQueueTable,
    updateDownloadFolderHint,
    wireDownloadPage,
  };
}
