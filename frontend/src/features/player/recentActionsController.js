// Recent-action helpers keep destructive list actions out of render-heavy controllers.
export function createRecentActionsController(deps) {
  const {
    invoke,
    onRecentChanged,
    setSessionRecentPlays,
  } = deps;

  async function clearRecentPlays() {
    await invoke("clear_recent_plays");
    setSessionRecentPlays([]);
    onRecentChanged?.();
  }

  function wireRecentActions() {
    const selectors = ["btn-clear-recent", "btn-home-clear-recent"];
    selectors.forEach((id) => {
      document.getElementById(id)?.addEventListener("click", () => {
        void clearRecentPlays().catch((error) => {
          console.warn("clear_recent_plays", error);
        });
      });
    });
  }

  return { clearRecentPlays, wireRecentActions };
}
