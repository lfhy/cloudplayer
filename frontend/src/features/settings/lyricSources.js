// Lyric source helpers keep provider-order UI logic out of the main settings controller.
const LYRIC_SOURCE_KEYS = ["qq", "kugou", "netease", "lrclib"];

export function normalizeLyricsProviderOrder(raw, lrclibEnabled = true) {
  const seen = new Set();
  const picked = [];
  for (const part of String(raw || "").toLowerCase().split(",")) {
    const source = String(part || "").trim();
    if (source === "pjmp3") {
      for (const alias of ["qq", "kugou"]) {
        if (seen.has(alias)) continue;
        seen.add(alias);
        picked.push(alias);
      }
      continue;
    }
    if (!LYRIC_SOURCE_KEYS.includes(source) || seen.has(source)) continue;
    seen.add(source);
    picked.push(source);
  }
  const filtered = picked.filter((source) => lrclibEnabled || source !== "lrclib");
  return filtered.length ? filtered.join(",") : (lrclibEnabled ? "qq,kugou,netease,lrclib" : "qq,kugou,netease");
}

export function readLyricsSourceSettingsFromDom() {
  const activeSources = Array.from(document.querySelectorAll("[data-lyrics-source-toggle].is-active"))
    .map((button) => String(button.getAttribute("data-lyrics-source-toggle") || "").trim())
    .filter((source) => LYRIC_SOURCE_KEYS.includes(source));
  const lrclibEnabled = activeSources.includes("lrclib");
  return {
    lyricsProviderOrder: normalizeLyricsProviderOrder(activeSources.join(","), lrclibEnabled),
    lyricsLRCLibEnabled: lrclibEnabled,
  };
}

export function applyLyricsSourceSelectionToDom(providerOrder, lrclibEnabled = true) {
  const normalized = normalizeLyricsProviderOrder(providerOrder, lrclibEnabled).split(",");
  document.querySelectorAll("[data-lyrics-source-toggle]").forEach((button) => {
    const source = String(button.getAttribute("data-lyrics-source-toggle") || "").trim();
    const active = normalized.includes(source);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  const status = document.getElementById("setting-lyrics-source-status");
  if (status) {
    const labels = normalized.map((source) => lyricSourceLabel(source));
    status.textContent = `按当前顺序依次尝试：${labels.join(" → ")}`;
  }
}

export function wireLyricsSourceSelection(onChange) {
  document.querySelectorAll("[data-lyrics-source-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = String(button.getAttribute("data-lyrics-source-toggle") || "").trim();
      const wasActive = button.classList.contains("is-active");
      if (wasActive && document.querySelectorAll("[data-lyrics-source-toggle].is-active").length <= 1) return;
      button.classList.toggle("is-active", !wasActive);
      const state = readLyricsSourceSettingsFromDom();
      applyLyricsSourceSelectionToDom(state.lyricsProviderOrder, state.lyricsLRCLibEnabled);
      onChange?.();
      if (!LYRIC_SOURCE_KEYS.includes(source)) return;
    });
  });
}

function lyricSourceLabel(source) {
  switch (source) {
    case "qq":
      return "QQ";
    case "kugou":
      return "酷狗官方";
    case "netease":
      return "网易云";
    case "lrclib":
      return "LRCLib";
    default:
      return source;
  }
}
