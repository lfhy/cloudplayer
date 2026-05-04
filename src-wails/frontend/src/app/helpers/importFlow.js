// Import flow helpers encapsulate step transitions while the runtime keeps ownership of state.
export function createImportFlowHelpers(deps) {
  const {
    getImportMethod,
    setImportMethodValue,
    getImportTracks,
    setImportTracksValue,
    setImportShareSuggestedName,
    setImportDraftDirty,
    getImportDraftDirty,
    getNeteaseCookieEnabled,
    getNeteaseCookieValue,
    renderImportTable,
  } = deps;

  function syncNeteaseCookieUi() {
    const chk = document.getElementById("opt-netease-cookie-enabled");
    const inp = document.getElementById("opt-netease-cookie");
    if (chk) chk.checked = !!getNeteaseCookieEnabled();
    if (inp) {
      inp.value = getNeteaseCookieValue() || "";
      inp.disabled = !getNeteaseCookieEnabled();
    }
  }

  function setImportStep(step = "choose") {
    const chooser = document.getElementById("import-method-stage");
    const config = document.getElementById("import-config-stage");
    const result = document.getElementById("import-result-stage");
    if (chooser) chooser.hidden = step !== "choose";
    if (config) config.hidden = step !== "config";
    if (result) result.hidden = step !== "result";
    const order = ["choose", "config", "result"];
    const currentIndex = order.indexOf(step);
    document.querySelectorAll("[data-import-step-nav]").forEach((el) => {
      const idx = order.indexOf(el.getAttribute("data-import-step-nav") || "");
      el.classList.toggle("is-active", idx === currentIndex);
      el.classList.toggle("is-done", idx > -1 && idx < currentIndex);
      const disabled = idx > currentIndex || (idx === 1 && !getImportMethod()) || (idx === 2 && getImportTracks().length === 0);
      el.disabled = disabled;
    });
  }

  function setImportMethod(method = "", { syncStep = true } = {}) {
    setImportMethodValue(method);
    document.querySelectorAll("[data-import-method]").forEach((card) => {
      card.classList.toggle("is-active", card.getAttribute("data-import-method") === method);
    });
    document.querySelectorAll(".import-panel").forEach((panel) => {
      panel.hidden = panel.id !== `import-panel-${method}`;
    });
    const title = document.getElementById("import-config-title");
    const desc = document.getElementById("import-config-desc");
    const copy = {
      local: ["导入本地目录", "选择一个音乐文件夹，扫描完成后会自动把结果带入歌单草稿。"],
      share: ["导入分享链接", "粘贴歌单分享链接并解析，完成后可以直接保存或合并到已有歌单。"],
      kugou: ["导入酷狗歌单", "登录酷狗概念版后勾选要同步的歌单，导入结果会统一进入保存步骤。"],
      text: ["导入文本列表", "把歌单文本、CSV 或 JSON 粘贴进来，解析后统一进入保存步骤。"],
    };
    if (title) title.textContent = copy[method]?.[0] || "配置导入参数";
    if (desc) desc.textContent = copy[method]?.[1] || "";
    if (syncStep) setImportStep(method ? "config" : getImportTracks().length > 0 ? "result" : "choose");
  }

  function showImportResultStage(show = true) {
    setImportStep(show ? "result" : getImportMethod() ? "config" : "choose");
  }

  function resetImportFlow({ keepDraft = false } = {}) {
    setImportMethod("");
    showImportResultStage(keepDraft && getImportTracks().length > 0);
    if (!keepDraft) {
      setImportTracksValue([]);
      setImportShareSuggestedName("");
      setImportDraftDirty(false);
      renderImportTable();
    }
    const shareStatus = document.getElementById("import-share-status");
    if (shareStatus) shareStatus.textContent = "";
  }

  function setImportDraft(tracks, { suggestedName = "", method = getImportMethod(), statusText = "" } = {}) {
    setImportTracksValue(Array.isArray(tracks) ? tracks : []);
    setImportShareSuggestedName(suggestedName || "");
    setImportDraftDirty(getImportTracks().length > 0);
    const nameEl = document.getElementById("import-playlist-name");
    if (nameEl) nameEl.value = suggestedName || (method === "local" ? "本地导入歌单" : "导入歌单");
    const hintEl = document.getElementById("import-result-hint");
    if (hintEl) {
      hintEl.textContent = statusText || `已整理 ${getImportTracks().length} 首歌曲。建议先保存为歌单，再继续调整或切换页面。`;
    }
    renderImportTable();
    showImportResultStage(getImportTracks().length > 0 || getImportDraftDirty());
  }

  return {
    resetImportFlow,
    setImportDraft,
    setImportMethod,
    setImportStep,
    showImportResultStage,
    syncNeteaseCookieUi,
  };
}
