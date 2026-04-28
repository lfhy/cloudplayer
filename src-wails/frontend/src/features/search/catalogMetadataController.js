// Catalog metadata loading fills album and duration lazily because the source list page omits them.
export function createCatalogMetadataController(deps) {
  const { invoke, renderSearchTable, searchState, warnRequestFailed } = deps;
  const retryDelayMS = 15_000;
  const batchLimit = 8;

  function shouldLoadMetadata(row, now) {
    if (!row?.source_id || row.__metaLoaded || row.__metaPending) return false;
    if (Number(row.__metaRetryAt || 0) > now) return false;
    return !(String(row.album || "").trim() && Number(row.duration_ms) > 0);
  }

  async function ensureVisibleMetadata(rows) {
    const now = Date.now();
    const targetIDs = [];
    rows.forEach((row) => {
      if (!shouldLoadMetadata(row, now) || targetIDs.length >= batchLimit) return;
      row.__metaPending = true;
      targetIDs.push(row.source_id);
    });
    if (!targetIDs.length) return;

    try {
      const metadataRows = await invoke("get_search_song_metadata", { songIds: targetIDs });
      const metadataByID = new Map((Array.isArray(metadataRows) ? metadataRows : []).map((row) => [row.source_id, row]));
      applyMetadataRows(targetIDs, metadataByID, 0);
    } catch (error) {
      warnRequestFailed(error, "get_search_song_metadata");
      applyMetadataRows(targetIDs, new Map(), now + retryDelayMS);
    }
  }

  function applyMetadataRows(targetIDs, metadataByID, retryAt) {
    const targetSet = new Set(targetIDs);
    let changed = false;
    searchState.results = searchState.results.map((row) => {
      if (!targetSet.has(row.source_id)) return row;
      const metadata = metadataByID.get(row.source_id);
      const next = {
        ...row,
        __metaLoaded: retryAt <= 0,
        __metaPending: false,
        __metaRetryAt: retryAt,
      };
      if (metadata) {
        if (!String(next.album || "").trim() && String(metadata.album || "").trim()) next.album = metadata.album;
        if (!(Number(next.duration_ms) > 0) && Number(metadata.duration_ms) > 0) next.duration_ms = metadata.duration_ms;
      }
      changed = changed || next.album !== row.album || next.duration_ms !== row.duration_ms || next.__metaPending !== row.__metaPending;
      return next;
    });
    if (changed) renderSearchTable();
  }

  return { ensureVisibleMetadata };
}
