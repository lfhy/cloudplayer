// Lyrics replace state is shared across search, preview and apply flows.

function readTrackContext() {
  const params = new URLSearchParams(window.location.search);
  const durationMs = Number(params.get("durationMs") || "");
  const title = params.get("title") || "";
  const artist = params.get("artist") || "";
  const keyword = (params.get("keyword") || `${artist} ${title}`).trim();
  return {
    keyword,
    title,
    artist,
    album: params.get("album") || "",
    trackKey: params.get("trackKey") || "",
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : null,
  };
}

export const trackContext = readTrackContext();

export const lyricsReplaceState = {
  candidates: [],
  selectedIndex: -1,
  previewPayload: null,
  fetchGen: 0,
  pendingRequestId: "",
  applySeq: 0,
};
