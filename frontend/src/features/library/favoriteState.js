import { saveLikedSet } from "../../app/helpers/likedSet.js";

// Favorite state helpers keep playlist-derived liked ids and UI refresh events in one place.
const FAVORITE_STATE_EVENT = "cloudplayer:favorites-changed";

function favoriteSourceIdsFromRows(rows) {
  return new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => String(row?.pjmp3_source_id || row?.source_id || "").trim())
      .filter(Boolean)
  );
}

function likedIdsFromDeps(getLikedIds) {
  const likedIds = typeof getLikedIds === "function" ? getLikedIds() : null;
  return likedIds instanceof Set ? likedIds : null;
}

export function emitFavoriteStateChanged() {
  window.dispatchEvent(new CustomEvent(FAVORITE_STATE_EVENT));
}

export function syncLikedIdsFromRows(rows, getLikedIds) {
  const likedIds = likedIdsFromDeps(getLikedIds);
  if (!likedIds) return false;
  const nextIds = favoriteSourceIdsFromRows(rows);
  let changed = nextIds.size !== likedIds.size;
  if (!changed) {
    for (const id of nextIds) {
      if (!likedIds.has(id)) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) return false;
  likedIds.clear();
  nextIds.forEach((id) => likedIds.add(id));
  saveLikedSet(likedIds);
  emitFavoriteStateChanged();
  return true;
}

export async function syncLikedIdsFromPlaylist(playlist, invoke, getLikedIds) {
  if (!playlist || (playlist.is_builtin !== true && playlist.is_favorites !== true)) return false;
  if (typeof invoke !== "function") return false;
  const rows = await invoke("list_playlist_import_items", { playlistId: playlist.id });
  return syncLikedIdsFromRows(rows, getLikedIds);
}
