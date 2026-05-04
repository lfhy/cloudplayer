// Liked set persistence stays isolated because it only depends on localStorage.
export function loadLikedSet() {
  try {
    const raw = localStorage.getItem("cp_tauri_liked_ids");
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveLikedSet(set) {
  try {
    localStorage.setItem("cp_tauri_liked_ids", JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}
