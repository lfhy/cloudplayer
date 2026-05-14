// Playback fallback chain editor keeps provider ordering and enable/disable state in a compact control.
const PROVIDERS = [
  { key: "kugou", label: "酷狗" },
  { key: "pjmp3", label: "泡椒" },
  { key: "netease", label: "网易云" },
];

function parseChain(raw) {
  const tokens = String(raw || "")
    .toLowerCase()
    .split(",")
    .map((value) => value.trim())
    .filter((value) => PROVIDERS.some((provider) => provider.key === value));
  const enabled = [];
  const seen = new Set();
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    enabled.push(token);
  }
  return enabled.length ? enabled : ["kugou", "pjmp3", "netease"];
}

export function createFallbackChainEditor({ onChange }) {
  let enabled = parseChain("kugou,pjmp3,netease");

  function syncHiddenInput() {
    const hidden = document.getElementById("setting-playback-fallback-chain");
    if (hidden) hidden.value = enabled.join(",");
  }

  function render() {
    const host = document.getElementById("setting-playback-fallback-chain-editor");
    if (!host) return;
    const rows = PROVIDERS.map((provider, index) => {
      const active = enabled.includes(provider.key);
      const pos = enabled.indexOf(provider.key);
      const canMoveUp = active && pos > 0;
      const canMoveDown = active && pos >= 0 && pos < enabled.length - 1;
      return `
        <div class="fallback-chain-row">
          <label class="fallback-chain-toggle">
            <input type="checkbox" data-fallback-toggle="${provider.key}" ${active ? "checked" : ""} />
            <span>${provider.label}</span>
          </label>
          <div class="fallback-chain-actions">
            <button type="button" class="settings-action-button fallback-chain-btn" data-fallback-up="${provider.key}" ${canMoveUp ? "" : "disabled"}>上移</button>
            <button type="button" class="settings-action-button fallback-chain-btn" data-fallback-down="${provider.key}" ${canMoveDown ? "" : "disabled"}>下移</button>
          </div>
          <span class="fallback-chain-order muted">${active ? `#${pos + 1}` : "-"}</span>
        </div>
      `;
    }).join("");
    host.innerHTML = `<div class="fallback-chain-grid">${rows}</div>`;

    host.querySelectorAll("[data-fallback-toggle]").forEach((element) => {
      element.addEventListener("change", () => {
        const key = element.getAttribute("data-fallback-toggle");
        if (!key) return;
        if (element.checked) {
          if (!enabled.includes(key)) enabled.push(key);
        } else {
          enabled = enabled.filter((item) => item !== key);
          if (!enabled.length) enabled = ["kugou"];
        }
        syncHiddenInput();
        render();
        onChange?.();
      });
    });

    host.querySelectorAll("[data-fallback-up]").forEach((element) => {
      element.addEventListener("click", () => {
        const key = element.getAttribute("data-fallback-up");
        if (!key) return;
        const index = enabled.indexOf(key);
        if (index <= 0) return;
        const swapped = enabled.slice();
        [swapped[index - 1], swapped[index]] = [swapped[index], swapped[index - 1]];
        enabled = swapped;
        syncHiddenInput();
        render();
        onChange?.();
      });
    });

    host.querySelectorAll("[data-fallback-down]").forEach((element) => {
      element.addEventListener("click", () => {
        const key = element.getAttribute("data-fallback-down");
        if (!key) return;
        const index = enabled.indexOf(key);
        if (index < 0 || index >= enabled.length - 1) return;
        const swapped = enabled.slice();
        [swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]];
        enabled = swapped;
        syncHiddenInput();
        render();
        onChange?.();
      });
    });
  }

  function setValue(raw) {
    enabled = parseChain(raw);
    syncHiddenInput();
    render();
  }

  function getValue() {
    return enabled.join(",");
  }

  return { getValue, render, setValue };
}
