// Tray state and recent-play persistence share the same playback snapshot model.
export function createTrayRecentController(deps) {
  const {
    emitTo,
    escapeHtml,
    getAudioEl,
    getPlayIndex,
    getPlayQueue,
    getSessionRecentPlays,
    invoke,
    maxSessionRecent,
    onRecentChanged,
    playFromQueueIndex,
    renderQueuePanel,
    setPlayQueue,
    setSessionRecentPlays,
    trayPlayerTarget,
  } = deps;

  function currentTrayPlayerState() {
    const current = getPlayQueue()[getPlayIndex()] || null;
    const audio = getAudioEl();
    const title = document.getElementById("dock-title")?.textContent?.trim() || "CloudPlayer";
    const sub = document.getElementById("dock-sub")?.textContent?.trim() || "从菜单栏快速控制当前播放";
    const coverUrl = document.getElementById("dock-cover")?.getAttribute("src") || null;
    const rootStyle = getComputedStyle(document.documentElement);
    const accent = rootStyle.getPropertyValue("--accent").trim() || "#c62f2f";
    const accentRgb = rootStyle.getPropertyValue("--accent-rgb").trim() || "198, 47, 47";
    const prevDisabled = !!document.getElementById("btn-player-prev")?.disabled;
    const nextDisabled = !!document.getElementById("btn-player-next")?.disabled;
    const duration = audio?.duration;
    const currentTime = audio?.currentTime ?? 0;
    const progressPct =
      duration && Number.isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0;
    return {
      hasTrack: !!current,
      title,
      sub,
      coverUrl,
      playing: !!audio && !!audio.src && !audio.paused,
      hasPrev: !prevDisabled,
      hasNext: !nextDisabled,
      progressPct,
      accent,
      accentRgb,
    };
  }

  async function broadcastTrayPlayerState() {
    try {
      await emitTo(trayPlayerTarget, "tray-player-state", currentTrayPlayerState());
    } catch (error) {
      console.warn("emit tray-player-state", error);
    }
  }

  async function loadRecentPlaysFromDb() {
    try {
      const rows = await invoke("list_recent_plays");
      if (!Array.isArray(rows) || !rows.length) return;
      setSessionRecentPlays(
        rows.map((row) => {
          const filePath = row.filePath || row.file_path;
          if ((row.kind || "") === "local" && filePath) {
            return { title: row.title, artist: row.artist || "", local_path: filePath };
          }
          return {
            source_id: row.pjmp3SourceId || row.pjmp3_source_id || "",
            title: row.title,
            artist: row.artist || "",
            cover_url: row.coverUrl ?? row.cover_url ?? null,
          };
        })
      );
      onRecentChanged();
    } catch (error) {
      console.warn("list_recent_plays", error);
    }
  }

  function playFromRecentRow(rowIndex) {
    const item = getSessionRecentPlays()[rowIndex];
    if (!item) return;
    if (item.local_path) {
      setPlayQueue([{ title: item.title, artist: item.artist || "", local_path: item.local_path, cover_url: null }]);
    } else {
      setPlayQueue([
        {
          source_id: item.source_id,
          title: item.title,
          artist: item.artist || "",
          cover_url: item.cover_url || null,
        },
      ]);
    }
    void playFromQueueIndex(0);
    renderQueuePanel();
  }

  function renderRecentPlaysTable() {
    const tbody = document.querySelector("#recent-plays-table tbody");
    if (!tbody) return;
    const rows = getSessionRecentPlays();
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="muted">暂无记录。在「搜索」、每日推荐或歌单中播放曲目后将显示在此处。</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    rows.forEach((row, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${index + 1}</td><td>${escapeHtml(row.title || "—")}</td><td>${escapeHtml(row.artist || "—")}</td><td>${escapeHtml(row.local_path ? "本地" : "在线")}</td>`;
      tr.addEventListener("dblclick", () => playFromRecentRow(index));
      tbody.appendChild(tr);
    });
  }

  function pushSessionRecentFromCurrentTrack() {
    const item = getPlayQueue()[getPlayIndex()];
    if (!item) return;
    const snapshot = buildRecentSnapshot(item);
    if (!snapshot) return;
    const key = snapshot.local_path ? `L:${snapshot.local_path}` : `O:${snapshot.source_id}`;
    const nextRows = getSessionRecentPlays().filter((row) => {
      const rowKey = row.local_path ? `L:${row.local_path}` : `O:${String(row.source_id || "").trim()}`;
      return rowKey !== key;
    });
    nextRows.unshift(snapshot);
    if (nextRows.length > maxSessionRecent) nextRows.length = maxSessionRecent;
    setSessionRecentPlays(nextRows);
    void persistRecentPlaySnapshot(snapshot);
    onRecentChanged();
  }

  function buildRecentSnapshot(item) {
    if (item.local_path) {
      return { title: item.title, artist: item.artist || "", local_path: item.local_path };
    }
    const sourceId = String(item.source_id || "").trim();
    if (!sourceId) return null;
    return {
      source_id: sourceId,
      title: item.title,
      artist: item.artist || "",
      cover_url: item.cover_url || null,
    };
  }

  async function persistRecentPlaySnapshot(snapshot) {
    try {
      if (snapshot.local_path) {
        await invoke("record_recent_play", {
          row: {
            kind: "local",
            title: snapshot.title,
            artist: snapshot.artist || "",
            cover_url: null,
            pjmp3_source_id: null,
            file_path: snapshot.local_path,
          },
        });
        return;
      }
      await invoke("record_recent_play", {
        row: {
          kind: "online",
          title: snapshot.title,
          artist: snapshot.artist || "",
          cover_url: snapshot.cover_url ?? null,
          pjmp3_source_id: snapshot.source_id,
          file_path: null,
        },
      });
    } catch (error) {
      console.warn("record_recent_play", error);
    }
  }

  return {
    broadcastTrayPlayerState,
    currentTrayPlayerState,
    loadRecentPlaysFromDb,
    playFromRecentRow,
    pushSessionRecentFromCurrentTrack,
    renderRecentPlaysTable,
  };
}
