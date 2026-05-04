// Playlist manage modal centralizes create, rename and delete confirmations without relying on prompt/confirm.
export function createPlaylistManageModal(deps) {
  const { alertRequestFailed, invoke, onChanged } = deps;
  let state = { mode: "create", playlistId: null, playlistName: "" };
  let wired = false;
  let submitting = false;

  function modalEl() { return document.getElementById("playlist-manage-modal"); }
  function titleEl() { return document.getElementById("playlist-manage-title"); }
  function subtitleEl() { return document.getElementById("playlist-manage-subtitle"); }
  function inputWrapEl() { return document.getElementById("playlist-manage-input-wrap"); }
  function inputEl() { return document.getElementById("playlist-manage-input"); }
  function deleteCopyEl() { return document.getElementById("playlist-manage-delete-copy"); }
  function statusEl() { return document.getElementById("playlist-manage-status"); }
  function confirmEl() { return document.getElementById("btn-playlist-manage-confirm"); }

  function setStatus(message = "", tone = "muted") {
    if (!statusEl()) return;
    statusEl().textContent = String(message || "");
    statusEl().dataset.tone = tone;
  }

  function openCreate(defaultName = "新歌单") {
    state = { mode: "create", playlistId: null, playlistName: defaultName };
    render();
    show();
  }

  function openRename(playlistId, playlistName) {
    state = { mode: "rename", playlistId, playlistName: playlistName || "" };
    render();
    show();
  }

  function openDelete(playlistId) {
    state = { mode: "delete", playlistId, playlistName: "" };
    render();
    show();
  }

  function show() {
    modalEl()?.removeAttribute("hidden");
    modalEl()?.setAttribute("aria-hidden", "false");
    if (state.mode !== "delete") queueMicrotask(() => inputEl()?.focus());
  }

  function hide() {
    modalEl()?.setAttribute("hidden", "true");
    modalEl()?.setAttribute("aria-hidden", "true");
  }

  function close() {
    if (submitting) return;
    hide();
  }

  function render() {
    const deleting = state.mode === "delete";
    const renaming = state.mode === "rename";
    if (titleEl()) titleEl().textContent = deleting ? "删除歌单" : renaming ? "重命名歌单" : "新建歌单";
    if (subtitleEl()) subtitleEl().textContent = deleting ? "删除后歌单内导入条目也会一起移除。" : "";
    if (inputWrapEl()) inputWrapEl().hidden = deleting;
    if (deleteCopyEl()) {
      deleteCopyEl().hidden = !deleting;
      deleteCopyEl().textContent = deleting ? "确定删除这个歌单吗？" : "";
    }
    if (inputEl()) inputEl().value = deleting ? "" : state.playlistName || "";
    if (confirmEl()) {
      confirmEl().textContent = deleting ? "删除歌单" : renaming ? "保存名称" : "创建歌单";
      confirmEl().classList.toggle("playlist-manage-modal__confirm--danger", deleting);
    }
    setStatus("");
  }

  async function submit() {
    if (submitting) return;
    const deleting = state.mode === "delete";
    const value = String(inputEl()?.value || "").trim();
    if (!deleting && !value) {
      setStatus("歌单名称不能为空。", "error");
      inputEl()?.focus();
      return;
    }
    submitting = true;
    if (confirmEl()) confirmEl().disabled = true;
    setStatus(deleting ? "正在删除歌单…" : "正在保存歌单…");
    try {
      if (state.mode === "create") await invoke("create_playlist", { name: value });
      if (state.mode === "rename") await invoke("rename_playlist", { playlistId: state.playlistId, name: value });
      if (state.mode === "delete") await invoke("delete_playlist", { playlistId: state.playlistId });
      hide();
      await onChanged?.({ ...state, nextName: value || state.playlistName || "" });
    } catch (error) {
      setStatus("操作失败，请稍后重试。", "error");
      alertRequestFailed(error, `playlist_manage_${state.mode}`);
    } finally {
      submitting = false;
      if (confirmEl()) confirmEl().disabled = false;
    }
  }

  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && document.activeElement?.id === "playlist-manage-input") {
        event.preventDefault();
        void submit();
        return;
      }
      if (event.key !== "Escape") return;
      if (modalEl()?.hidden === false) close();
    });
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id === "btn-playlist-manage-close" || target.id === "btn-playlist-manage-cancel") {
        close();
        return;
      }
      if (target.id === "btn-playlist-manage-confirm") {
        void submit();
        return;
      }
      if (target.id === "playlist-manage-modal") {
        close();
      }
    });
  }

  return { openCreate, openDelete, openRename, wire };
}
