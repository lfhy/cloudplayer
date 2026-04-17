/**
 * 导入结果导出为 TXT/CSV，与桌面端、移动端共用，避免「手机与 PC 行尾/BOM 不一致」。
 * TXT/CSV 行尾均为 CRLF；CSV 带 UTF-8 BOM，便于 Windows Excel 正确识别中文。
 */

/** @param {{ title: string, artist: string, album?: string }[]} tracks */
export function buildImportTxtBody(tracks) {
  return tracks.map((t) => (t.artist ? `${t.title} - ${t.artist}` : t.title)).join("\r\n");
}

/** @param {{ title: string, artist: string, album?: string }[]} tracks */
export function buildImportCsvText(tracks) {
  const lines = ["title,artist,album"].concat(
    tracks.map((t) => {
      const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
      return [esc(t.title), esc(t.artist), esc(t.album || "")].join(",");
    }),
  );
  return lines.join("\r\n");
}

/** @param {{ title: string, artist: string, album?: string }[]} tracks */
export function buildImportCsvBlobUtf8(tracks) {
  return new Blob(["\ufeff", buildImportCsvText(tracks)], { type: "text/csv;charset=utf-8" });
}

/** @param {{ title: string, artist: string, album?: string }[]} tracks */
export function buildImportTxtBlob(tracks) {
  return new Blob([buildImportTxtBody(tracks)], { type: "text/plain;charset=utf-8" });
}

export function triggerBlobDownload(filename, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
