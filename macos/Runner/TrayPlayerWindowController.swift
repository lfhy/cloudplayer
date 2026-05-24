import Cocoa

// Tray player window controller owns the legacy-style floating panel that opens
// from the menu bar without using the stock NSPopover bubble chrome.

final class TrayPlayerWindowController: NSObject, NSWindowDelegate {
  private let panel: TrayPlayerPanel
  private let contentController = TrayPopoverContentViewController()

  override init() {
    panel = TrayPlayerPanel(
      contentRect: NSRect(x: 0, y: 0, width: 364, height: 182),
      styleMask: [.borderless],
      backing: .buffered,
      defer: false
    )
    super.init()
    configurePanel()
  }

  var onPrevious: (() -> Void)? {
    get { contentController.onPrevious }
    set { contentController.onPrevious = newValue }
  }

  var onPlayPause: (() -> Void)? {
    get { contentController.onPlayPause }
    set { contentController.onPlayPause = newValue }
  }

  var onNext: (() -> Void)? {
    get { contentController.onNext }
    set { contentController.onNext = newValue }
  }

  var onShowMainWindow: (() -> Void)? {
    get { contentController.onShowMainWindow }
    set { contentController.onShowMainWindow = newValue }
  }

  var isVisible: Bool {
    panel.isVisible
  }

  func applyState(_ state: TrayPlaybackState) {
    panel.appearance = state.themeMode == "light"
      ? NSAppearance(named: .aqua)
      : NSAppearance(named: .darkAqua)
    contentController.applyState(state)
  }

  func toggle(relativeTo button: NSStatusBarButton) {
    if panel.isVisible {
      panel.orderOut(nil)
      return
    }
    guard let screen = button.window?.screen ?? NSScreen.main else {
      panel.makeKeyAndOrderFront(nil)
      return
    }
    let buttonFrame = button.window?.convertToScreen(button.frame) ?? .zero
    var frame = panel.frame
    frame.origin.x = round(buttonFrame.midX - frame.width / 2)
    frame.origin.y = round(buttonFrame.minY - frame.height - 8)
    let visibleFrame = screen.visibleFrame.insetBy(dx: 6, dy: 6)
    frame.origin.x = min(max(frame.origin.x, visibleFrame.minX), visibleFrame.maxX - frame.width)
    frame.origin.y = max(frame.origin.y, visibleFrame.minY)
    panel.setFrame(frame, display: true)
    panel.orderFrontRegardless()
    NSApp.activate(ignoringOtherApps: true)
  }

  func hide() {
    panel.orderOut(nil)
  }

  func windowDidResignKey(_ notification: Notification) {
    hide()
  }

  private func configurePanel() {
    panel.delegate = self
    panel.isReleasedWhenClosed = false
    panel.backgroundColor = .clear
    panel.isOpaque = false
    panel.hasShadow = true
    panel.level = .statusBar
    panel.collectionBehavior = [.canJoinAllSpaces, .transient, .ignoresCycle]
    panel.titleVisibility = .hidden
    panel.titlebarAppearsTransparent = true
    panel.hidesOnDeactivate = true
    panel.contentViewController = contentController
  }
}

private final class TrayPlayerPanel: NSPanel {
  override var canBecomeKey: Bool {
    true
  }

  override var canBecomeMain: Bool {
    false
  }
}
