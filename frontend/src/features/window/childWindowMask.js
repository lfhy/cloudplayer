function maskEl() {
  return document.getElementById("child-window-mask");
}

// Child windows should not dim the main window; keep any legacy mask node hidden.
export function wireChildWindowMask() {
  const el = maskEl();
  if (!el) return () => {};
  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
  return () => {};
}
