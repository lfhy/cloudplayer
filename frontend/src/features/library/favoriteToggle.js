import { saveLikedSet } from "../../app/helpers/likedSet.js";
import { emitFavoriteStateChanged } from "./favoriteState.js";

// Favorite toggle helpers keep dock and table heart actions on the same backend flow.
function normalizedFavoriteTrack(track) {
  return {
    title: String(track?.title || "").trim(),
    artist: String(track?.artist || "").trim(),
    album: String(track?.album || "").trim(),
    coverUrl: String(track?.cover_url || track?.coverUrl || "").trim(),
    durationMs: Number(track?.duration_ms || track?.durationMs || 0) || 0,
    localPath: String(track?.local_path || track?.localPath || "").trim(),
    sourceId: String(track?.like_source_id || track?.source_id || track?.sourceId || track?.pjmp3_source_id || "").trim(),
  };
}

export async function toggleFavoriteTrack(track, deps) {
  const { alertRequestFailed, getLikedIds, invoke, onAfterToggle } = deps;
  const likedIds = typeof getLikedIds === "function" ? getLikedIds() : null;
  const normalized = normalizedFavoriteTrack(track);
  if (!(likedIds instanceof Set) || !normalized.sourceId || normalized.localPath) return false;
  try {
    if (likedIds.has(normalized.sourceId)) {
      await invoke("remove_favorite_track", { sourceId: normalized.sourceId });
      likedIds.delete(normalized.sourceId);
    } else {
      await invoke("add_favorite_track", {
        track: {
          title: normalized.title,
          artist: normalized.artist,
          album: normalized.album,
          pjmp3_source_id: normalized.sourceId,
          cover_url: normalized.coverUrl,
          duration_ms: normalized.durationMs,
        },
      });
      likedIds.add(normalized.sourceId);
    }
    saveLikedSet(likedIds);
    emitFavoriteStateChanged();
    await onAfterToggle?.({
      liked: likedIds.has(normalized.sourceId),
      sourceId: normalized.sourceId,
      track: normalized,
    });
    return true;
  } catch (error) {
    if (typeof alertRequestFailed === "function") {
      alertRequestFailed(error, "toggle favorite track");
      return false;
    }
    throw error;
  }
}
