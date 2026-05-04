// Text helpers keep HTML escaping and empty-state rendering shared across controllers.

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]
  );
}

export function setTableMutedMessage(tbody, colSpan, message) {
  if (!tbody) return;
  tbody.innerHTML = "";
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colSpan;
  td.className = "muted";
  td.textContent = String(message ?? "");
  tr.appendChild(td);
  tbody.appendChild(tr);
}
