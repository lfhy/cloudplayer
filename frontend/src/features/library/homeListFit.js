// Home list fitting prevents the last visible row from being clipped by the fixed-height homepage columns.
export function renderFittedHomeRows(container, items, renderRow) {
  if (!container) return 0;
  container.innerHTML = "";
  if (!Array.isArray(items) || !items.length) return 0;
  const limit = Math.max(0, container.clientHeight);
  let visibleCount = 0;
  for (const [index, item] of items.entries()) {
    const row = renderRow(item, index);
    container.appendChild(row);
    if (limit > 0 && container.scrollHeight > limit + 1) {
      row.remove();
      break;
    }
    visibleCount += 1;
  }
  return visibleCount;
}
