// Cover helpers centralize fallback SVG artwork and failed-image recovery.

// Use a single path from the existing Solar icon set instead of bundling the whole JSON file.
const FALLBACK_COVER_ICON_BODY =
  '<path fill="currentColor" d="M14.319 2.505A2.75 2.75 0 0 0 11.414 4.3c-.098.27-.132.563-.148.869A17 17 0 0 0 11.25 6v8.536A4.75 4.75 0 1 0 12.75 18V9.21q.156.083.343.175L15.8 10.74c.418.21.759.38 1.038.5c.281.123.558.223.843.257A2.75 2.75 0 0 0 20.586 9.7c.098-.27.132-.563.148-.87c.016-.303.016-.683.016-1.151v-.083c0-.348 0-.62-.049-.878a2.75 2.75 0 0 0-1.03-1.667c-.21-.16-.453-.281-.764-.436L16.2 3.262a22 22 0 0 0-1.038-.501c-.28-.123-.558-.223-.843-.256"/>';

function escapeSvgText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeAccentColor(value) {
  const normalized = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : "#c62f2f";
}

function resolveThemeAccentColor() {
  if (typeof document === "undefined" || !document.documentElement) return "#c62f2f";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--accent");
  return normalizeAccentColor(value);
}

function resolveCoverPalette() {
  const accent = resolveThemeAccentColor();
  const resolvedMode =
    typeof document !== "undefined" && document.documentElement
      ? String(document.documentElement.dataset.themeModeResolved || "").trim().toLowerCase()
      : "";
  if (resolvedMode === "dark") {
    return {
      accent,
      bgStart: "#262B33",
      bgEnd: "#1D2128",
      border: "rgba(255,255,255,0.08)",
    };
  }
  return {
    accent,
    bgStart: "#F6F7F8",
    bgEnd: "#E7EAEE",
    border: "rgba(78,89,104,0.12)",
  };
}

export function fallbackCoverDataUri(size = 64, radius = null) {
  const safeSize = Number.isFinite(size) ? Math.max(24, Math.round(size)) : 64;
  const safeRadius = Number.isFinite(radius) ? Math.max(4, Math.round(radius)) : Math.max(8, Math.round(safeSize * 0.2));
  const { accent, bgStart, bgEnd, border } = resolveCoverPalette();
  const iconBody = FALLBACK_COVER_ICON_BODY.replace(/currentColor/g, escapeSvgText(accent));
  const iconSize = safeSize * 0.46;
  const iconScale = iconSize / 24;
  const iconOffset = (safeSize - iconSize) / 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize}" viewBox="0 0 ${safeSize} ${safeSize}">
      <defs>
        <linearGradient id="cp-cover-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${escapeSvgText(bgStart)}"/>
          <stop offset="100%" stop-color="${escapeSvgText(bgEnd)}"/>
        </linearGradient>
      </defs>
      <rect width="${safeSize}" height="${safeSize}" rx="${safeRadius}" fill="url(#cp-cover-bg)"/>
      <rect x="${Math.max(0.5, safeSize * 0.015)}" y="${Math.max(0.5, safeSize * 0.015)}" width="${safeSize - Math.max(1, safeSize * 0.03)}" height="${safeSize - Math.max(1, safeSize * 0.03)}" rx="${Math.max(4, safeRadius - 1)}" fill="none" stroke="${escapeSvgText(border)}"/>
      <g transform="translate(${iconOffset} ${iconOffset}) scale(${iconScale})">
        ${iconBody}
      </g>
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function coverImgHtml({
  src = "",
  className = "",
  width = 40,
  height = width,
  radius = null,
  alt = "",
  loading = "lazy",
} = {}) {
  const safeWidth = Number.isFinite(width) ? Math.max(1, Math.round(width)) : 40;
  const safeHeight = Number.isFinite(height) ? Math.max(1, Math.round(height)) : safeWidth;
  const fallback = fallbackCoverDataUri(Math.max(safeWidth, safeHeight), radius);
  const resolved = String(src || "").trim() || fallback;
  const loadingAttr = loading ? ` loading="${escapeAttr(loading)}"` : "";
  const fallbackClass = resolved === fallback ? " is-fallback-cover" : "";
  return `<img class="${escapeAttr(className)}${fallbackClass}" src="${escapeAttr(resolved)}" data-cover-fallback="${escapeAttr(fallback)}" onerror="this.onerror=null;this.classList.add('is-fallback-cover');this.src=this.dataset.coverFallback" alt="${escapeAttr(alt)}" width="${safeWidth}" height="${safeHeight}"${loadingAttr} />`;
}

export function setCoverImageSource(img, src, { size = 64, radius = null } = {}) {
  if (!img) return;
  const fallback = fallbackCoverDataUri(size, radius);
  const nextSrc = String(src || "").trim() || fallback;
  img.dataset.coverFallback = fallback;
  img.onerror = () => {
    img.onerror = null;
    img.classList.add("is-fallback-cover");
    img.src = img.dataset.coverFallback || fallback;
  };
  img.classList.toggle("is-fallback-cover", nextSrc === fallback);
  img.src = nextSrc;
}
