// Track search shortcuts keep clickable artist/album actions consistent across tables.
export function triggerTrackSearch(keyword) {
  const value = String(keyword || "").trim();
  if (!value) return;
  document.querySelectorAll("#page-search, #page-search-results").forEach((input) => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  document.getElementById("btn-page-search")?.click();
}
