import Cocoa

// Desktop-lyrics content view draws the two-line floating lyric surface and
// reveals compact controls only while the overlay is unlocked and hovered.

final class DesktopLyricsContentView: NSView {
  var onClose: (() -> Void)?
  var onToggleLock: (() -> Void)?
  var onScaleDelta: ((CGFloat) -> Void)?

  var state: DesktopLyricsState = DesktopLyricsState(payload: [:]) {
    didSet {
      updateControlVisibility()
      needsDisplay = true
    }
  }

  private var hovered = false {
    didSet {
      updateControlVisibility()
    }
  }

  private var trackingAreaRef: NSTrackingArea?
  private let closeButton = DesktopLyricsToolButton(symbolName: "xmark")
  private let lockButton = DesktopLyricsToolButton(symbolName: "lock")
  private let minusButton = DesktopLyricsToolButton(symbolName: "minus")
  private let plusButton = DesktopLyricsToolButton(symbolName: "plus")
  private var displayTimer: Timer?
  private var progressLineKey = ""
  private var progressValue: CGFloat = 0
  private var progressAudioNow: Double = 0
  private var syncedAudioNow: Double = 0
  private var syncedWallNow: CFTimeInterval = 0
  private var lastReportedAudioNow: Double = 0
  private var wasAudioPlaying = false
  private var syncToken = ""

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    wantsLayer = true
    layer?.backgroundColor = NSColor.clear.cgColor
    layer?.masksToBounds = false
    setupControls()
    startDisplayTimer()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    wantsLayer = true
    layer?.backgroundColor = NSColor.clear.cgColor
    setupControls()
    startDisplayTimer()
  }

  deinit {
    displayTimer?.invalidate()
  }

  override var isOpaque: Bool {
    false
  }

  override func updateTrackingAreas() {
    super.updateTrackingAreas()
    if let trackingAreaRef {
      removeTrackingArea(trackingAreaRef)
    }
    let trackingAreaRef = NSTrackingArea(
      rect: bounds,
      options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
      owner: self,
      userInfo: nil
    )
    addTrackingArea(trackingAreaRef)
    self.trackingAreaRef = trackingAreaRef
  }

  override func mouseEntered(with event: NSEvent) {
    super.mouseEntered(with: event)
    hovered = true
  }

  override func mouseExited(with event: NSEvent) {
    super.mouseExited(with: event)
    hovered = false
  }

  override func layout() {
    super.layout()
    let inset: CGFloat = 10
    let topY = bounds.height - 36
    let rightStart = bounds.width - inset - 28
    plusButton.frame = NSRect(x: rightStart, y: topY, width: 28, height: 28)
    minusButton.frame = plusButton.frame.offsetBy(dx: -30, dy: 0)
    lockButton.frame = minusButton.frame.offsetBy(dx: -30, dy: 0)
    closeButton.frame = lockButton.frame.offsetBy(dx: -30, dy: 0)
  }

  override func draw(_ dirtyRect: NSRect) {
    super.draw(dirtyRect)
    guard let context = NSGraphicsContext.current?.cgContext else {
      return
    }
    context.clear(bounds)
    let fontSize = max(24, 32 * state.scale)
    let font = NSFont.systemFont(ofSize: fontSize, weight: .semibold)
    let topRect = lineRect(top: true, font: font)
    let bottomRect = lineRect(top: false, font: font)
    let progress = resolvedProgress()
    drawLine(
      state.line1,
      in: topRect,
      alignment: .left,
      font: font,
      baseColor: state.baseColor,
      fillColor: state.highlightColor,
      progress: progress.line1
    )
    drawLine(
      state.line2,
      in: bottomRect,
      alignment: .right,
      font: font,
      baseColor: state.baseColor.withAlphaComponent(0.92),
      fillColor: state.highlightColor,
      progress: progress.line2
    )
  }

  private func setupControls() {
    closeButton.toolTip = "关闭歌词"
    lockButton.toolTip = "锁定桌面歌词"
    minusButton.toolTip = "缩小字号"
    plusButton.toolTip = "放大字号"
    closeButton.target = self
    lockButton.target = self
    minusButton.target = self
    plusButton.target = self
    closeButton.action = #selector(handleClose)
    lockButton.action = #selector(handleToggleLock)
    minusButton.action = #selector(handleScaleDown)
    plusButton.action = #selector(handleScaleUp)
    [closeButton, lockButton, minusButton, plusButton].forEach { button in
      addSubview(button)
    }
    updateControlVisibility()
  }

  private func startDisplayTimer() {
    displayTimer?.invalidate()
    let timer = Timer(timeInterval: 1 / 30, repeats: true) { [weak self] _ in
      self?.needsDisplay = true
    }
    RunLoop.main.add(timer, forMode: .common)
    displayTimer = timer
  }

  private func updateControlVisibility() {
    let visible = hovered && !state.locked
    closeButton.isHidden = !visible
    lockButton.isHidden = !visible
    minusButton.isHidden = !visible
    plusButton.isHidden = !visible
  }

  private func lineRect(top: Bool, font: NSFont) -> NSRect {
    let insetX: CGFloat = 18
    let lineHeight = font.ascender - font.descender + 6
    let gap: CGFloat = 10
    let totalHeight = lineHeight * 2 + gap
    let baseY = (bounds.height - totalHeight) / 2
    let y = top ? baseY + lineHeight + gap : baseY
    return NSRect(
      x: insetX,
      y: y,
      width: bounds.width - insetX * 2,
      height: lineHeight
    )
  }

  private func resolvedProgress() -> (line1: CGFloat, line2: CGFloat) {
    if state.idleMode {
      progressLineKey = ""
      return (state.line1Progress, state.line2Progress)
    }
    let currentTime = syncedCurrentTime()
    if state.activeSlot == 2 {
      return (
        1,
        resolvedLineProgress(
          lineID: "line2",
          text: state.line2,
          startT: state.line2StartT,
          endT: state.line2EndT,
          wordLine: state.line2Words,
          fallback: state.line2Progress,
          currentTime: currentTime,
          reportedTime: state.audioNow
        )
      )
    }
    return (
      resolvedLineProgress(
        lineID: "line1",
        text: state.line1,
        startT: state.line1StartT,
        endT: state.line1EndT,
        wordLine: state.line1Words,
        fallback: state.line1Progress,
        currentTime: currentTime,
        reportedTime: state.audioNow
      ),
      0
    )
  }

  private func resolvedLineProgress(
    lineID: String,
    text: String,
    startT: Double,
    endT: Double,
    wordLine: DesktopLyricsWordLine?,
    fallback: CGFloat,
    currentTime: Double,
    reportedTime: Double
  ) -> CGFloat {
    let rawRatio: CGFloat
    if let wordLine, !wordLine.words.isEmpty, wordLine.joinedText == text {
      rawRatio = wordCoverageRatio(wordLine, currentTime: currentTime)
    } else if endT > startT {
      rawRatio = plainCoverageRatio(
        startT: startT,
        endT: endT,
        currentTime: currentTime
      )
    } else {
      rawRatio = fallback
    }
    return monotonicLineProgress(
      lineID: lineID,
      text: text,
      startT: startT,
      endT: endT,
      rawRatio: rawRatio,
      reportedTime: reportedTime
    )
  }

  private func wordCoverageRatio(
    _ wordLine: DesktopLyricsWordLine,
    currentTime: Double
  ) -> CGFloat {
    let totalChars = wordLine.words.reduce(0) { partialResult, word in
      partialResult + word.text.unicodeScalars.count
    }
    if totalChars <= 0 {
      return 0
    }
    var covered = 0.0
    for word in wordLine.words {
      let start = Double(word.startMs) / 1000
      let end = Double(word.endMs) / 1000
      let duration = end - start
      let progress: Double
      if duration > 0 {
        progress = ((currentTime - start) / duration).clamped(to: 0...1)
      } else {
        progress = currentTime >= end ? 1 : 0
      }
      covered += progress * Double(word.text.unicodeScalars.count)
    }
    return CGFloat((covered / Double(totalChars)).clamped(to: 0...1))
  }

  private func plainCoverageRatio(
    startT: Double,
    endT: Double,
    currentTime: Double
  ) -> CGFloat {
    let duration = endT - startT
    if duration <= 0 {
      return 1
    }
    return CGFloat(((currentTime - startT) / duration).clamped(to: 0...1))
  }

  private func monotonicLineProgress(
    lineID: String,
    text: String,
    startT: Double,
    endT: Double,
    rawRatio: CGFloat,
    reportedTime: Double
  ) -> CGFloat {
    let clamped = rawRatio.clamped(to: 0...1)
    let lineKey = "\(lineID)|\(text)|\(startT)|\(endT)"
    let sameLine = progressLineKey == lineKey
    let backwardSeek = sameLine && reportedTime < progressAudioNow - 0.35
    progressValue = sameLine && !backwardSeek ? max(progressValue, clamped) : clamped
    progressLineKey = lineKey
    progressAudioNow = reportedTime
    return progressValue
  }

  private func syncedCurrentTime() -> Double {
    let token = [
      state.line1,
      state.line2,
      String(state.activeSlot),
      String(state.line1StartT),
      String(state.line1EndT),
      String(state.line2StartT),
      String(state.line2EndT),
    ].joined(separator: "|")
    let reportedNow = state.audioNow
    let now = CACurrentMediaTime()
    if syncToken != token {
      syncToken = token
      syncedAudioNow = reportedNow
      syncedWallNow = now
      lastReportedAudioNow = reportedNow
    }
    let projectedNow = syncedAudioNow + max(0, now - syncedWallNow)
    if !state.audioPlaying {
      if wasAudioPlaying {
        let drift = reportedNow - projectedNow
        syncedAudioNow = drift >= -0.18 ? max(projectedNow, reportedNow) : reportedNow
      } else if abs(reportedNow - lastReportedAudioNow) > 0.18 {
        syncedAudioNow = reportedNow
      }
      syncedWallNow = now
      lastReportedAudioNow = reportedNow
      wasAudioPlaying = false
      return syncedAudioNow
    }
    wasAudioPlaying = true
    if abs(reportedNow - lastReportedAudioNow) > 0.0005 {
      let drift = reportedNow - projectedNow
      syncedAudioNow = drift >= -0.18 ? max(projectedNow, reportedNow) : reportedNow
      syncedWallNow = now
      lastReportedAudioNow = reportedNow
    }
    return syncedAudioNow + max(0, now - syncedWallNow)
  }

  private func drawLine(
    _ text: String,
    in rect: NSRect,
    alignment: NSTextAlignment,
    font: NSFont,
    baseColor: NSColor,
    fillColor: NSColor,
    progress: CGFloat
  ) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    paragraph.lineBreakMode = .byTruncatingTail
    let baseFillAttributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: baseColor,
      .paragraphStyle: paragraph,
      .shadow: lyricShadow(for: baseColor, font: font),
    ]
    let fillFillAttributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: fillColor,
      .paragraphStyle: paragraph,
      .shadow: lyricShadow(for: fillColor, font: font),
    ]
    let baseText = NSAttributedString(string: text, attributes: baseFillAttributes)
    let drawRect = textDrawRect(
      for: baseText,
      in: rect,
      alignment: alignment
    )
    baseText.draw(in: drawRect)
    let clipped = rect.intersection(
      NSRect(
        x: drawRect.minX,
        y: drawRect.minY,
        width: drawRect.width * progress,
        height: drawRect.height
      )
    )
    guard !clipped.isEmpty else {
      return
    }
    let fillText = NSAttributedString(string: text, attributes: fillFillAttributes)
    NSGraphicsContext.saveGraphicsState()
    clippedRect(clipped)
    fillText.draw(in: drawRect)
    NSGraphicsContext.restoreGraphicsState()
  }

  private func lyricShadow(for color: NSColor, font: NSFont) -> NSShadow {
    let shadow = NSShadow()
    shadow.shadowColor = darkerOutlineColor(for: color).withAlphaComponent(0.88)
    shadow.shadowBlurRadius = max(1.2, min(2.2, font.pointSize * 0.045))
    shadow.shadowOffset = NSSize(width: 0, height: -1)
    return shadow
  }

  private func darkerOutlineColor(for color: NSColor) -> NSColor {
    guard let rgb = color.usingColorSpace(.deviceRGB) else {
      return NSColor.black.withAlphaComponent(0.92)
    }
    let mixFactor: CGFloat = rgb.perceivedBrightness > 0.72 ? 0.3 : 0.44
    return NSColor(
      calibratedRed: rgb.redComponent * mixFactor,
      green: rgb.greenComponent * mixFactor,
      blue: rgb.blueComponent * mixFactor,
      alpha: max(0.9, rgb.alphaComponent)
    )
  }

  private func textDrawRect(
    for text: NSAttributedString,
    in rect: NSRect,
    alignment: NSTextAlignment
  ) -> NSRect {
    let measured = text.boundingRect(
      with: NSSize(width: rect.width, height: rect.height),
      options: [.usesLineFragmentOrigin, .usesFontLeading]
    )
    let width = min(rect.width, ceil(measured.width))
    let height = rect.height
    let originX: CGFloat
    switch alignment {
    case .right:
      originX = rect.maxX - width
    case .center:
      originX = rect.minX + (rect.width - width) / 2
    default:
      originX = rect.minX
    }
    return NSRect(x: originX, y: rect.minY, width: width, height: height)
  }

  private func clippedRect(_ rect: NSRect) {
    let path = NSBezierPath(rect: rect)
    path.addClip()
  }

  @objc private func handleClose() {
    onClose?()
  }

  @objc private func handleToggleLock() {
    onToggleLock?()
  }

  @objc private func handleScaleDown() {
    onScaleDelta?(-0.08)
  }

  @objc private func handleScaleUp() {
    onScaleDelta?(0.08)
  }
}
