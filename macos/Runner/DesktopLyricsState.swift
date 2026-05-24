import Cocoa

// Desktop-lyrics state keeps the method-channel payload strongly typed before
// it reaches the window controller and drawing view.

struct DesktopLyricsState {
  let visible: Bool
  let locked: Bool
  let scale: CGFloat
  let baseColor: NSColor
  let highlightColor: NSColor
  let line1: String
  let line2: String
  let idleMode: Bool
  let activeSlot: Int
  let line1StartT: Double
  let line1EndT: Double
  let line2StartT: Double
  let line2EndT: Double
  let line1Words: DesktopLyricsWordLine?
  let line2Words: DesktopLyricsWordLine?
  let audioNow: Double
  let audioPlaying: Bool
  let line1Progress: CGFloat
  let line2Progress: CGFloat
  let x: Int?
  let y: Int?
  let width: Int?
  let height: Int?

  init(
    visible: Bool,
    locked: Bool,
    scale: CGFloat,
    baseColor: NSColor,
    highlightColor: NSColor,
    line1: String,
    line2: String,
    idleMode: Bool,
    activeSlot: Int,
    line1StartT: Double,
    line1EndT: Double,
    line2StartT: Double,
    line2EndT: Double,
    line1Words: DesktopLyricsWordLine?,
    line2Words: DesktopLyricsWordLine?,
    audioNow: Double,
    audioPlaying: Bool,
    line1Progress: CGFloat,
    line2Progress: CGFloat,
    x: Int?,
    y: Int?,
    width: Int?,
    height: Int?
  ) {
    self.visible = visible
    self.locked = locked
    self.scale = scale
    self.baseColor = baseColor
    self.highlightColor = highlightColor
    self.line1 = line1
    self.line2 = line2
    self.idleMode = idleMode
    self.activeSlot = activeSlot
    self.line1StartT = line1StartT
    self.line1EndT = line1EndT
    self.line2StartT = line2StartT
    self.line2EndT = line2EndT
    self.line1Words = line1Words
    self.line2Words = line2Words
    self.audioNow = audioNow
    self.audioPlaying = audioPlaying
    self.line1Progress = line1Progress
    self.line2Progress = line2Progress
    self.x = x
    self.y = y
    self.width = width
    self.height = height
  }

  init(payload: [String: Any]) {
    visible = payload.boolValue("visible")
    locked = payload.boolValue("locked", fallback: true)
    scale = CGFloat(payload.doubleValue("scale", fallback: 1.0)).clamped(
      to: 0.5...2.5
    )
    baseColor = NSColor(hexString: payload.stringValue("baseColor"), fallback: .white)
    highlightColor = NSColor(
      hexString: payload.stringValue("highlightColor"),
      fallback: NSColor(calibratedRed: 1, green: 0.72, blue: 0.83, alpha: 1)
    )
    line1 = payload.stringValue("line1", fallback: "CloudPlayer")
    line2 = payload.stringValue("line2", fallback: "让音乐陪你此刻")
    idleMode = payload.boolValue("idleMode")
    activeSlot = payload.intValue("activeSlot", fallback: 1) == 2 ? 2 : 1
    line1StartT = payload.doubleValue("line1StartT")
    line1EndT = payload.doubleValue("line1EndT")
    line2StartT = payload.doubleValue("line2StartT")
    line2EndT = payload.doubleValue("line2EndT")
    line1Words = DesktopLyricsWordLine(payload: payload["line1Words"])
    line2Words = DesktopLyricsWordLine(payload: payload["line2Words"])
    audioNow = payload.doubleValue("audioNow")
    audioPlaying = payload.boolValue("audioPlaying")
    line1Progress = CGFloat(payload.doubleValue("line1Progress")).clamped(to: 0...1)
    line2Progress = CGFloat(payload.doubleValue("line2Progress")).clamped(to: 0...1)
    x = payload.optionalIntValue("x")
    y = payload.optionalIntValue("y")
    width = payload.optionalIntValue("width")
    height = payload.optionalIntValue("height")
  }

  func with(locked: Bool? = nil, scale: CGFloat? = nil) -> DesktopLyricsState {
    DesktopLyricsState(
      visible: visible,
      locked: locked ?? self.locked,
      scale: scale ?? self.scale,
      baseColor: baseColor,
      highlightColor: highlightColor,
      line1: line1,
      line2: line2,
      idleMode: idleMode,
      activeSlot: activeSlot,
      line1StartT: line1StartT,
      line1EndT: line1EndT,
      line2StartT: line2StartT,
      line2EndT: line2EndT,
      line1Words: line1Words,
      line2Words: line2Words,
      audioNow: audioNow,
      audioPlaying: audioPlaying,
      line1Progress: line1Progress,
      line2Progress: line2Progress,
      x: x,
      y: y,
      width: width,
      height: height
    )
  }
}

struct DesktopLyricsWordLine {
  let startMs: Int
  let endMs: Int
  let words: [DesktopLyricsWordTiming]

  init?(payload: Any?) {
    guard let dictionary = payload as? [String: Any] else {
      return nil
    }
    startMs = dictionary.intValue("startMs")
    endMs = dictionary.intValue("endMs")
    words = (dictionary["words"] as? [[String: Any]] ?? []).map(DesktopLyricsWordTiming.init)
  }

  var joinedText: String {
    words.map(\.text).joined()
  }
}

struct DesktopLyricsWordTiming {
  let startMs: Int
  let endMs: Int
  let text: String

  init(payload: [String: Any]) {
    startMs = payload.intValue("startMs")
    endMs = payload.intValue("endMs")
    text = payload.stringValue("text")
  }
}

private extension Dictionary where Key == String, Value == Any {
  func boolValue(_ key: String, fallback: Bool = false) -> Bool {
    switch self[key] {
    case let value as Bool:
      return value
    case let value as NSNumber:
      return value.boolValue
    case let value as String:
      return value == "true" || value == "1"
    default:
      return fallback
    }
  }

  func intValue(_ key: String, fallback: Int = 0) -> Int {
    optionalIntValue(key) ?? fallback
  }

  func optionalIntValue(_ key: String) -> Int? {
    switch self[key] {
    case let value as NSNumber:
      return value.intValue
    case let value as String:
      return Int(value)
    default:
      return nil
    }
  }

  func doubleValue(_ key: String, fallback: Double = 0) -> Double {
    switch self[key] {
    case let value as NSNumber:
      return value.doubleValue
    case let value as String:
      return Double(value) ?? fallback
    default:
      return fallback
    }
  }

  func stringValue(_ key: String, fallback: String = "") -> String {
    guard let value = self[key] else {
      return fallback
    }
    let text = String(describing: value)
    return text.isEmpty ? fallback : text
  }
}

private extension NSColor {
  convenience init(hexString: String, fallback: NSColor) {
    let normalized = hexString
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .replacingOccurrences(of: "#", with: "")
    let value = normalized.count == 6 ? "FF\(normalized)" : normalized
    guard
      let raw = UInt64(value, radix: 16)
    else {
      let fallbackColor = fallback.usingColorSpace(.deviceRGB) ?? .white
      self.init(
        calibratedRed: fallbackColor.redComponent,
        green: fallbackColor.greenComponent,
        blue: fallbackColor.blueComponent,
        alpha: fallbackColor.alphaComponent
      )
      return
    }
    let alpha = CGFloat((raw & 0xFF00_0000) >> 24) / 255
    let red = CGFloat((raw & 0x00FF_0000) >> 16) / 255
    let green = CGFloat((raw & 0x0000_FF00) >> 8) / 255
    let blue = CGFloat(raw & 0x0000_00FF) / 255
    self.init(calibratedRed: red, green: green, blue: blue, alpha: alpha)
  }
}

extension Comparable {
  func clamped(to range: ClosedRange<Self>) -> Self {
    min(max(self, range.lowerBound), range.upperBound)
  }
}
