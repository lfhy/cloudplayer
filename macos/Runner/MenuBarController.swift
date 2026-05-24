import Cocoa
import FlutterMacOS

// Menu-bar controller restores the legacy CloudPlayer status item on macOS and
// keeps its playback shortcuts synchronized with Flutter state.

func cloudPlayerMainWindow() -> NSWindow? {
  NSApp.windows.first { $0 is MainFlutterWindow } ?? NSApp.mainWindow ?? NSApp.windows.first
}

func showCloudPlayerMainWindow() {
  guard let window = cloudPlayerMainWindow() else {
    return
  }
  if window.isMiniaturized {
    window.deminiaturize(nil)
  }
  NSApp.activate(ignoringOtherApps: true)
  window.makeKeyAndOrderFront(nil)
}

func hideCloudPlayerMainWindow() {
  cloudPlayerMainWindow()?.orderOut(nil)
}

final class MenuBarController: NSObject {
  private let channel: FlutterMethodChannel
  private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
  private let menu = NSMenu()
  private let trayPlayerWindowController = TrayPlayerWindowController()
  private let titleItem = NSMenuItem(title: "CloudPlayer", action: nil, keyEquivalent: "")
  private let subtitleItem = NSMenuItem(
    title: "从菜单栏快速控制当前播放",
    action: nil,
    keyEquivalent: ""
  )
  private let previousItem = NSMenuItem(title: "上一首", action: nil, keyEquivalent: "")
  private let playPauseItem = NSMenuItem(title: "播放", action: nil, keyEquivalent: "")
  private let nextItem = NSMenuItem(title: "下一首", action: nil, keyEquivalent: "")

  init(binaryMessenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(
      name: "cloudplayer/macos_tray",
      binaryMessenger: binaryMessenger
    )
    super.init()
    configureTrayPlayerWindow()
    configureStatusItem()
    configureMenu()
    channel.setMethodCallHandler(handleMethodCall)
  }

  private func configureTrayPlayerWindow() {
    trayPlayerWindowController.onPrevious = { [weak self] in self?.sendCommand("prev") }
    trayPlayerWindowController.onPlayPause = { [weak self] in self?.sendCommand("toggle") }
    trayPlayerWindowController.onNext = { [weak self] in self?.sendCommand("next") }
    trayPlayerWindowController.onShowMainWindow = {
      showCloudPlayerMainWindow()
    }
  }

  private func configureStatusItem() {
    guard let button = statusItem.button else {
      return
    }
    button.toolTip = "CloudPlayer"
    button.lineBreakMode = .byTruncatingTail
    button.target = self
    button.action = #selector(handleStatusItemPressed(_:))
    button.sendAction(on: [.leftMouseUp, .rightMouseUp])
    button.imageScaling = .scaleProportionallyDown
    if let image = NSImage(named: "TrayIcon")?.copy() as? NSImage {
      image.isTemplate = true
      image.size = NSSize(width: 18, height: 18)
      button.image = image
    } else {
      if let fallbackImage = NSApp.applicationIconImage.copy() as? NSImage {
        fallbackImage.isTemplate = true
        fallbackImage.size = NSSize(width: 18, height: 18)
        button.image = fallbackImage
      }
    }
    button.imagePosition = .imageOnly
  }

  private func configureMenu() {
    titleItem.isEnabled = false
    subtitleItem.isEnabled = false
    previousItem.target = self
    previousItem.action = #selector(handlePrevious)
    playPauseItem.target = self
    playPauseItem.action = #selector(handlePlayPause)
    nextItem.target = self
    nextItem.action = #selector(handleNext)

    let showItem = NSMenuItem(title: "显示主窗口", action: #selector(handleShowMainWindow), keyEquivalent: "")
    showItem.target = self
    let quitItem = NSMenuItem(title: "退出", action: #selector(handleTerminate), keyEquivalent: "")
    quitItem.target = self

    menu.autoenablesItems = false
    menu.items = [
      titleItem,
      subtitleItem,
      .separator(),
      previousItem,
      playPauseItem,
      nextItem,
      .separator(),
      showItem,
      quitItem,
    ]
  }

  private func handleMethodCall(
    _ call: FlutterMethodCall,
    result: @escaping FlutterResult
  ) {
    switch call.method {
    case "syncState":
      let payload = call.arguments as? [String: Any] ?? [:]
      applyState(payload)
      result(nil)
    case "hideMainWindow":
      hideCloudPlayerMainWindow()
      result(nil)
    case "showMainWindow":
      showCloudPlayerMainWindow()
      result(nil)
    case "terminateApp":
      NSApp.terminate(nil)
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func applyState(_ payload: [String: Any]) {
    let nextState = TrayPlaybackState(
      themeMode: normalizedThemeMode(payload["themeMode"] as? String),
      title: normalizedMenuText(payload["title"] as? String, fallback: "CloudPlayer"),
      subtitle: normalizedMenuText(
        payload["subtitle"] as? String,
        fallback: "从菜单栏快速控制当前播放"
      ),
      label: normalizedStatusLabel(payload["label"] as? String),
      coverSource: payload["coverSource"] as? String ?? "",
      hasTrack: payload["hasTrack"] as? Bool ?? false,
      hasPrev: payload["hasPrev"] as? Bool ?? false,
      hasNext: payload["hasNext"] as? Bool ?? false,
      playing: payload["playing"] as? Bool ?? false,
      progressValue: (payload["progressValue"] as? Double)
        ?? (payload["progressValue"] as? NSNumber)?.doubleValue
        ?? 0
    )

    titleItem.title = nextState.title
    subtitleItem.title = nextState.subtitle
    previousItem.isEnabled = nextState.hasPrev
    nextItem.isEnabled = nextState.hasNext
    playPauseItem.isEnabled = nextState.hasTrack
    playPauseItem.title = nextState.playing ? "暂停" : "播放"
    trayPlayerWindowController.applyState(nextState)

    guard let button = statusItem.button else {
      return
    }
    button.title = nextState.label.isEmpty ? "" : " \(nextState.label)"
    button.imagePosition = nextState.label.isEmpty ? .imageOnly : .imageLeading
    button.toolTip = nextState.label.isEmpty ? "CloudPlayer" : "CloudPlayer \(nextState.label)"
  }

  private func normalizedMenuText(_ value: String?, fallback: String) -> String {
    let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return trimmed.isEmpty ? fallback : trimmed
  }

  private func normalizedStatusLabel(_ value: String?) -> String {
    let collapsed = value?
      .replacingOccurrences(of: "\u{00A0}", with: " ")
      .replacingOccurrences(of: "\n", with: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return collapsed
  }

  private func normalizedThemeMode(_ value: String?) -> String {
    value == "light" ? "light" : "dark"
  }

  private func sendCommand(_ action: String) {
    channel.invokeMethod("command", arguments: ["action": action])
  }

  @objc private func handleStatusItemPressed(_ sender: NSStatusBarButton) {
    guard let event = NSApp.currentEvent else {
      trayPlayerWindowController.hide()
      showCloudPlayerMainWindow()
      return
    }
    if event.type == .rightMouseUp {
      trayPlayerWindowController.hide()
      menu.popUp(
        positioning: nil,
        at: NSPoint(x: 0, y: sender.bounds.maxY + 6),
        in: sender
      )
      return
    }
    trayPlayerWindowController.hide()
    showCloudPlayerMainWindow()
  }

  @objc private func handlePrevious() {
    sendCommand("prev")
  }

  @objc private func handlePlayPause() {
    sendCommand("toggle")
  }

  @objc private func handleNext() {
    sendCommand("next")
  }

  @objc private func handleShowMainWindow() {
    showCloudPlayerMainWindow()
  }

  @objc private func handleTerminate() {
    NSApp.terminate(nil)
  }
}
