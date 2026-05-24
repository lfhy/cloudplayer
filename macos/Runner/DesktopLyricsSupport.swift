import Cocoa

// Desktop-lyrics support types keep button styling and shared color helpers out
// of the main content view so the window rendering file stays focused.

final class DesktopLyricsToolButton: NSButton {
  init(symbolName: String) {
    super.init(frame: .zero)
    isBordered = false
    bezelStyle = .regularSquare
    setButtonType(.momentaryChange)
    wantsLayer = true
    layer?.cornerRadius = 14
    layer?.backgroundColor = NSColor.black.withAlphaComponent(0.22).cgColor
    layer?.borderColor = NSColor.white.withAlphaComponent(0.12).cgColor
    layer?.borderWidth = 1
    imagePosition = .imageOnly
    if #available(macOS 11.0, *) {
      image = NSImage(
        systemSymbolName: symbolName,
        accessibilityDescription: nil
      )
      contentTintColor = .white
    } else {
      title = fallbackTitle(symbolName)
      font = NSFont.systemFont(ofSize: 13, weight: .semibold)
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func updateLayer() {
    super.updateLayer()
    layer?.backgroundColor = (isHighlighted
      ? NSColor.black.withAlphaComponent(0.34)
      : NSColor.black.withAlphaComponent(0.22)).cgColor
  }

  private func fallbackTitle(_ symbolName: String) -> String {
    switch symbolName {
    case "xmark":
      return "×"
    case "minus":
      return "–"
    case "plus":
      return "+"
    default:
      return "锁"
    }
  }
}

extension NSColor {
  var perceivedBrightness: CGFloat {
    guard let color = usingColorSpace(.deviceRGB) else {
      return 0
    }
    return (color.redComponent * 0.299) +
      (color.greenComponent * 0.587) +
      (color.blueComponent * 0.114)
  }
}
