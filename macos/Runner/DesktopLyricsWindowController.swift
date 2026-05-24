import Cocoa

// Desktop-lyrics window controller owns the transparent floating panel,
// geometry persistence callbacks, and interaction state changes.

final class DesktopLyricsWindowController: NSObject, NSWindowDelegate {
  private let eventSink: (String, [String: Any]) -> Void
  private var panel: DesktopLyricsPanel?
  private var contentView: DesktopLyricsContentView?
  private var state = DesktopLyricsState(payload: [:])
  private var suppressBoundsEvent = false

  init(eventSink: @escaping (String, [String: Any]) -> Void) {
    self.eventSink = eventSink
    super.init()
  }

  func applyState(_ nextState: DesktopLyricsState) {
    state = nextState
    guard nextState.visible else {
      hide()
      return
    }
    let panel = ensurePanel(with: nextState)
    applyInteractionState()
    contentView?.state = nextState
    if !panel.isVisible {
      panel.orderFrontRegardless()
    }
  }

  func hide() {
    panel?.orderOut(nil)
  }

  func resetBounds() -> [String: Any] {
    let nextFrame = defaultFrame(from: state)
    if let panel {
      suppressBoundsEvent = true
      panel.setFrame(nextFrame, display: true, animate: false)
      suppressBoundsEvent = false
      return boundsPayload(for: panel)
    }
    return boundsPayload(for: nextFrame, screen: NSScreen.main)
  }

  func windowDidMove(_ notification: Notification) {
    emitBoundsChanged()
  }

  func windowDidResize(_ notification: Notification) {
    emitBoundsChanged()
  }

  private func ensurePanel(with state: DesktopLyricsState) -> DesktopLyricsPanel {
    if let panel {
      return panel
    }
    let frame = frameFromState(state)
    let panel = DesktopLyricsPanel(
      contentRect: frame,
      styleMask: [.borderless, .nonactivatingPanel],
      backing: .buffered,
      defer: false
    )
    panel.delegate = self
    panel.isReleasedWhenClosed = false
    panel.level = .floating
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
    panel.backgroundColor = .clear
    panel.isOpaque = false
    panel.hasShadow = false
    panel.titleVisibility = .hidden
    panel.titlebarAppearsTransparent = true
    panel.isMovableByWindowBackground = true
    panel.hidesOnDeactivate = false
    panel.acceptsMouseMovedEvents = true

    let contentView = DesktopLyricsContentView(frame: NSRect(origin: .zero, size: frame.size))
    contentView.autoresizingMask = [.width, .height]
    contentView.state = state
    contentView.onClose = { [weak self] in
      self?.hide()
      self?.eventSink("closed", [:])
    }
    contentView.onToggleLock = { [weak self] in
      self?.toggleLock()
    }
    contentView.onScaleDelta = { [weak self] delta in
      self?.adjustScale(delta)
    }
    panel.contentView = contentView
    self.panel = panel
    self.contentView = contentView
    return panel
  }

  private func toggleLock() {
    state = state.with(locked: !state.locked)
    applyInteractionState()
    contentView?.state = state
    eventSink("lockChanged", ["locked": state.locked])
  }

  private func adjustScale(_ delta: CGFloat) {
    let nextScale = (state.scale + delta).clamped(to: 0.5...2.5)
    state = state.with(scale: nextScale)
    contentView?.state = state
    eventSink("scaleChanged", ["scale": Double(nextScale)])
  }

  private func applyInteractionState() {
    guard let panel else {
      return
    }
    panel.ignoresMouseEvents = state.locked
    panel.isMovableByWindowBackground = !state.locked
  }

  private func emitBoundsChanged() {
    guard let panel, !suppressBoundsEvent else {
      return
    }
    eventSink("boundsChanged", boundsPayload(for: panel))
  }

  private func frameFromState(_ state: DesktopLyricsState) -> NSRect {
    guard let panel else {
      return defaultFrame(from: state)
    }
    return panel.frame
  }

  private func defaultFrame(from state: DesktopLyricsState) -> NSRect {
    let screenFrame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
    let width = CGFloat(max(320, min(state.width ?? 720, Int(screenFrame.width) - 40)))
    let height = CGFloat(max(96, state.height ?? 132))
    let x = CGFloat(state.x ?? Int(screenFrame.minX + (screenFrame.width - width) / 2))
    let topInset = CGFloat(state.y ?? 48)
    let y = screenFrame.maxY - topInset - height
    return NSRect(x: x, y: y, width: width, height: height)
  }

  private func boundsPayload(for panel: NSWindow) -> [String: Any] {
    boundsPayload(for: panel.frame, screen: panel.screen)
  }

  private func boundsPayload(
    for frame: NSRect,
    screen: NSScreen?
  ) -> [String: Any] {
    let screenFrame = screen?.frame ?? NSScreen.main?.frame ?? .zero
    let y = Int(round(screenFrame.maxY - frame.maxY))
    return [
      "x": Int(round(frame.minX)),
      "y": y,
      "width": Int(round(frame.width)),
      "height": Int(round(frame.height)),
    ]
  }
}

private final class DesktopLyricsPanel: NSPanel {
  override var canBecomeKey: Bool {
    true
  }

  override var canBecomeMain: Bool {
    false
  }
}

private extension NSColor {
  var hexString: String {
    guard let color = usingColorSpace(.deviceRGB) else {
      return "#FFFFFF"
    }
    let red = Int(round(color.redComponent * 255))
    let green = Int(round(color.greenComponent * 255))
    let blue = Int(round(color.blueComponent * 255))
    return String(format: "#%02X%02X%02X", red, green, blue)
  }
}
