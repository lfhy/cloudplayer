// Track table template keeps shared cover-list table markup consistent across pages.
export function trackTableTemplate(options = {}) {
  const {
    id,
    tableClassName = "",
    wrapperClassName = "",
    includeCheck = false,
    includeIndex = false,
    includeLike = true,
    checkInputId = "track-table-select-all",
  } = options;
  const wrapperClass = wrapperClassName ? ` ${wrapperClassName}` : "";
  const tableClass = tableClassName ? ` ${tableClassName}` : "";
  return `
    <div class="table-wrap${wrapperClass}">
      <table class="search-table${tableClass}" id="${id}">
        <thead>
          <tr>
            ${includeCheck ? `<th class="col-check" hidden><input type="checkbox" id="${checkInputId}" aria-label="全选当前列表" /></th>` : ""}
            ${includeIndex ? '<th class="col-idx">#</th>' : ""}
            <th class="col-cover"></th>
            <th>标题</th>
            <th>专辑</th>
            ${includeLike ? '<th class="col-like">喜欢</th>' : ""}
            <th class="col-dur">时长</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
}
