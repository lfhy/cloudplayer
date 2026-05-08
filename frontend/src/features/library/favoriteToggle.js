import { saveLikedSet } from "../../app/helpers/likedSet.js";
import { emitFavoriteStateChanged } from "./favoriteState.js";

// Favorite toggle helpers keep dock and table heart actions on the same backend flow.
const pendingFavoriteSourceIds = new Set();

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
  if (pendingFavoriteSourceIds.has(normalized.sourceId)) return false;
  const wasLiked = likedIds.has(normalized.sourceId);
  const nextLiked = !wasLiked;
  pendingFavoriteSourceIds.add(normalized.sourceId);
  try {
    if (nextLiked) likedIds.add(normalized.sourceId);
    else likedIds.delete(normalized.sourceId);
    saveLikedSet(likedIds);
    emitFavoriteStateChanged();
    if (nextLiked) {
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
    } else {
      await invoke("remove_favorite_track", { sourceId: normalized.sourceId });
    }
    Promise.resolve(onAfterToggle?.({
      liked: nextLiked,
      sourceId: normalized.sourceId,
      track: normalized,
    })).catch((error) => {
      console.warn("favorite toggle follow-up", error);
    });
    return true;
  } catch (error) {
    if (wasLiked) likedIds.add(normalized.sourceId);
    else likedIds.delete(normalized.sourceId);
    saveLikedSet(likedIds);
    emitFavoriteStateChanged();
    if (typeof alertRequestFailed === "function") {
      alertRequestFailed(error, "toggle favorite track");
      return false;
    }
    throw error;
  } finally {
    pendingFavoriteSourceIds.delete(normalized.sourceId);
  }
}
