// Cover helpers centralize fallback SVG artwork and failed-image recovery.

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function fallbackCoverDataUri(size = 64, radius = null) {
  const safeSize = Number.isFinite(size) ? Math.max(24, Math.round(size)) : 64;
  const safeRadius = Number.isFinite(radius) ? Math.max(4, Math.round(radius)) : Math.max(8, Math.round(safeSize * 0.2));
  const artScale = safeSize / 92;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize}" viewBox="0 0 ${safeSize} ${safeSize}">
      <defs>
        <linearGradient id="cp-cover-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F4F6F8"/>
          <stop offset="100%" stop-color="#D8DFE7"/>
        </linearGradient>
        <linearGradient id="cp-cover-wave" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7C8796"/>
          <stop offset="100%" stop-color="#4E5968"/>
        </linearGradient>
      </defs>
      <rect width="${safeSize}" height="${safeSize}" rx="${safeRadius}" fill="url(#cp-cover-bg)"/>
      <rect x="${safeSize * 0.16}" y="${safeSize * 0.16}" width="${safeSize * 0.68}" height="${safeSize * 0.68}" rx="${Math.max(6, safeRadius * 0.55)}" fill="#FFFFFF" fill-opacity="0.74"/>
      <g transform="translate(${safeSize * 0.195} ${safeSize * 0.195}) scale(${artScale})" fill="url(#cp-cover-wave)">
        <rect x="8" y="31" width="6" height="14" rx="3"/>
        <rect x="18" y="24" width="6" height="28" rx="3"/>
        <rect x="28" y="17" width="6" height="42" rx="3"/>
        <rect x="38" y="11" width="6" height="54" rx="3"/>
        <rect x="48" y="7" width="6" height="62" rx="3"/>
        <rect x="58" y="11" width="6" height="54" rx="3"/>
        <rect x="68" y="17" width="6" height="42" rx="3"/>
      </g>
      <rect x="${safeSize * 0.24}" y="${safeSize * 0.66}" width="${safeSize * 0.52}" height="${Math.max(2, safeSize * 0.03)}" rx="${Math.max(1, safeSize * 0.015)}" fill="#AAB4C0" fill-opacity="0.68"/>
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
