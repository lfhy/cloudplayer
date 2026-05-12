// Child-window auto sizing keeps standalone dialogs matched to their rendered content instead of fixed viewport guesses.
export function wireChildWindowAutoSize(config) {
  const {
    element,
    windowRef,
    minHeight = 160,
    minWidth = 320,
    paddingHeight = 28,
    paddingWidth = 28,
  } = config;
  if (!element || !windowRef) return () => {};
  let frame = 0;
  let lastWidth = 0;
  let lastHeight = 0;

  async function resizeToContent() {
    const rect = element.getBoundingClientRect();
    const targetWidth = Math.max(minWidth, Math.ceil(rect.width + paddingWidth));
    const targetHeight = Math.max(minHeight, Math.ceil(rect.height + paddingHeight));
    if (Math.abs(targetWidth - lastWidth) < 2 && Math.abs(targetHeight - lastHeight) < 2) return;
    lastWidth = targetWidth;
    lastHeight = targetHeight;
    try {
      const [position, size] = await Promise.all([windowRef.Position(), windowRef.Size()]);
      const nextX = Math.max(0, Math.round(position.x + (size.width - targetWidth) / 2));
      const nextY = Math.max(0, Math.round(position.y + (size.height - targetHeight) / 2));
      await windowRef.SetSize(targetWidth, targetHeight);
      await windowRef.SetPosition(nextX, nextY);
    } catch (error) {
      console.warn("auto resize child window", error);
    }
  }

  function scheduleResize() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      void resizeToContent();
    });
  }

  const observer = new ResizeObserver(() => {
    scheduleResize();
  });
  observer.observe(element);
  window.addEventListener("load", scheduleResize, { once: true });
  setTimeout(scheduleResize, 30);

  return () => {
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
