import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";

// Child-window auto sizing uses backend-native centering so modal dialogs stay visually aligned with the main window.
export function wireChildWindowAutoSize(config) {
  const {
    element,
    windowLabel = "",
    windowRef,
    minHeight = 160,
    minWidth = 320,
    paddingHeight = 28,
    paddingWidth = 28,
  } = config;
  if (!element || (!windowLabel && !windowRef)) {
    return {
      cleanup() {},
      scheduleResize() {},
      scheduleDebouncedResize() {},
    };
  }
  let frame = 0;
  let lastWidth = 0;
  let lastHeight = 0;
  let debounceTimer = 0;

  async function resizeToContent() {
    const rect = element.getBoundingClientRect();
    const targetWidth = Math.max(minWidth, Math.ceil(rect.width + paddingWidth));
    const targetHeight = Math.max(minHeight, Math.ceil(rect.height + paddingHeight));
    if (Math.abs(targetWidth - lastWidth) < 2 && Math.abs(targetHeight - lastHeight) < 2) return;
    lastWidth = targetWidth;
    lastHeight = targetHeight;
    try {
      if (windowLabel) {
        await DesktopService.ResizeWindowCenteredOnMain(windowLabel, targetWidth, targetHeight);
        return;
      }
      await windowRef.SetSize(targetWidth, targetHeight);
    } catch (error) {
      console.warn("auto resize child window", error);
    }
  }

  function scheduleResize() {
    if (frame) cancelAnimationFrame(frame);
    if (debounceTimer) window.clearTimeout(debounceTimer);
    frame = requestAnimationFrame(() => {
      frame = 0;
      void resizeToContent();
    });
  }

  function scheduleDebouncedResize(delay = 80) {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = 0;
      scheduleResize();
    }, delay);
  }

  const observer = new ResizeObserver(() => {
    scheduleResize();
  });
  observer.observe(element);
  window.addEventListener("load", scheduleResize, { once: true });
  setTimeout(scheduleResize, 30);

  return {
    cleanup() {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (debounceTimer) window.clearTimeout(debounceTimer);
    },
    scheduleResize,
    scheduleDebouncedResize,
  };
}
