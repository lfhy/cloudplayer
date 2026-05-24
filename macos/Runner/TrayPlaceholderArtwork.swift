import Cocoa

// Tray placeholder artwork keeps the menu-bar fallback cover aligned with the
// legacy Wails gradient card instead of a plain monochrome note.

func makeTrayPlaceholderArtwork(
  size: NSSize = NSSize(width: 96, height: 96),
  isDarkMode: Bool,
  accentColor: NSColor
) -> NSImage {
  if let svgImage = makeTrayPlaceholderSVGImage(
    size: size,
    isDarkMode: isDarkMode,
    accentColor: accentColor
  ) {
    svgImage.isTemplate = false
    return svgImage
  }
  let image = NSImage(size: size)
  image.isTemplate = false
  image.lockFocus()
  defer { image.unlockFocus() }

  let bounds = NSRect(origin: .zero, size: size)
  let radius: CGFloat = 14
  let frame = NSBezierPath(roundedRect: bounds, xRadius: radius, yRadius: radius)
  let topColor = isDarkMode
    ? NSColor(calibratedRed: 0x26 / 255, green: 0x2B / 255, blue: 0x33 / 255, alpha: 1)
    : NSColor(calibratedRed: 0xF6 / 255, green: 0xF7 / 255, blue: 0xF8 / 255, alpha: 1)
  let bottomColor = isDarkMode
    ? NSColor(calibratedRed: 0x1D / 255, green: 0x21 / 255, blue: 0x28 / 255, alpha: 1)
    : NSColor(calibratedRed: 0xE7 / 255, green: 0xEA / 255, blue: 0xEE / 255, alpha: 1)
  NSGradient(starting: topColor, ending: bottomColor)?.draw(
    in: frame,
    angle: 315
  )

  let borderInset = max(0.5, round(size.width * 0.015))
  let borderRect = bounds.insetBy(dx: borderInset, dy: borderInset)
  let borderRadius = max(4, radius - 1)
  let borderPath = NSBezierPath(
    roundedRect: borderRect,
    xRadius: borderRadius,
    yRadius: borderRadius
  )
  let borderColor = isDarkMode
    ? NSColor.white.withAlphaComponent(0.08)
    : NSColor(calibratedRed: 78 / 255, green: 89 / 255, blue: 104 / 255, alpha: 0.12)
  borderColor.setStroke()
  borderPath.lineWidth = 1
  borderPath.stroke()

  let iconBounds = NSRect(
    x: size.width * 0.27,
    y: size.height * 0.27,
    width: size.width * 0.46,
    height: size.height * 0.46
  )
  let noteAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: iconBounds.width * 0.82, weight: .medium),
    .foregroundColor: accentColor,
  ]
  NSString(string: "♪").draw(in: iconBounds, withAttributes: noteAttributes)
  return image
}

private func makeTrayPlaceholderSVGImage(
  size: NSSize,
  isDarkMode: Bool,
  accentColor: NSColor
) -> NSImage? {
  let safeSize = max(24, Int(round(size.width)))
  let safeRadius = max(8, Int(round(CGFloat(safeSize) * 0.2)))
  let bgStart = isDarkMode ? "#000000" : "#FFFFFF"
  let bgEnd = isDarkMode ? "#000000" : "#FFFFFF"
  let border = isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"
  let iconBody =
    "<path fill=\"\(accentColor.hexString)\" d=\"M14.319 2.505A2.75 2.75 0 0 0 11.414 4.3c-.098.27-.132.563-.148.869A17 17 0 0 0 11.25 6v8.536A4.75 4.75 0 1 0 12.75 18V9.21q.156.083.343.175L15.8 10.74c.418.21.759.38 1.038.5c.281.123.558.223.843.257A2.75 2.75 0 0 0 20.586 9.7c.098-.27.132-.563.148-.87c.016-.303.016-.683.016-1.151v-.083c0-.348 0-.62-.049-.878a2.75 2.75 0 0 0-1.03-1.667c-.21-.16-.453-.281-.764-.436L16.2 3.262a22 22 0 0 0-1.038-.501c-.28-.123-.558-.223-.843-.256\"/>"
  let iconSize = CGFloat(safeSize) * 0.46
  let iconScale = iconSize / 24
  let iconOffset = (CGFloat(safeSize) - iconSize) / 2
  let borderInset = max(0.5, CGFloat(safeSize) * 0.015)
  let innerSize = CGFloat(safeSize) - max(1, CGFloat(safeSize) * 0.03)
  let innerRadius = max(4, CGFloat(safeRadius - 1))
  let svg = """
  <svg xmlns="http://www.w3.org/2000/svg" width="\(safeSize)" height="\(safeSize)" viewBox="0 0 \(safeSize) \(safeSize)">
    <defs>
      <linearGradient id="cp-cover-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="\(bgStart)"/>
        <stop offset="100%" stop-color="\(bgEnd)"/>
      </linearGradient>
    </defs>
    <rect width="\(safeSize)" height="\(safeSize)" rx="\(safeRadius)" fill="url(#cp-cover-bg)"/>
    <rect x="\(borderInset)" y="\(borderInset)" width="\(innerSize)" height="\(innerSize)" rx="\(innerRadius)" fill="none" stroke="\(border)"/>
    <g transform="translate(\(iconOffset) \(iconOffset)) scale(\(iconScale))">
      \(iconBody)
    </g>
  </svg>
  """
  guard let data = svg.data(using: .utf8) else {
    return nil
  }
  return NSImage(data: data)
}

private extension NSColor {
  var hexString: String {
    guard let color = usingColorSpace(.deviceRGB) else {
      return "#C62F2F"
    }
    let red = Int(round(color.redComponent * 255))
    let green = Int(round(color.greenComponent * 255))
    let blue = Int(round(color.blueComponent * 255))
    return String(format: "#%02X%02X%02X", red, green, blue)
  }
}
