import Cocoa

// Tray player content mirrors the legacy compact menu-bar card instead of a
// stock popover so the rebuilt macOS shell keeps the same visual language.

struct TrayPlaybackState {
  var themeMode: String
  var title: String
  var subtitle: String
  var label: String
  var coverSource: String
  var hasTrack: Bool
  var hasPrev: Bool
  var hasNext: Bool
  var playing: Bool
  var progressValue: Double

  static let empty = TrayPlaybackState(
    themeMode: "dark",
    title: "CloudPlayer",
    subtitle: "从菜单栏快速控制当前播放",
    label: "",
    coverSource: "",
    hasTrack: false,
    hasPrev: false,
    hasNext: false,
    playing: false,
    progressValue: 0
  )
}

final class TrayPopoverContentViewController: NSViewController {
  var onPrevious: (() -> Void)?
  var onPlayPause: (() -> Void)?
  var onNext: (() -> Void)?
  var onShowMainWindow: (() -> Void)?

  private let accentColor = NSColor(calibratedRed: 0.78, green: 0.18, blue: 0.18, alpha: 1)
  private let backgroundView = NSVisualEffectView()
  private let artworkView = NSImageView()
  private let titleButton = NSButton(title: "CloudPlayer", target: nil, action: nil)
  private let subtitleLabel = NSTextField(labelWithString: "从菜单栏快速控制当前播放")
  private let progressView = TrayProgressView()
  private let previousButton = NSButton()
  private let playPauseButton = NSButton()
  private let nextButton = NSButton()
  private let openButton = NSButton(title: "打开", target: nil, action: nil)
  private var currentThemeMode = "dark"
  private var currentCoverSource = ""
  private var currentCoverTask: URLSessionDataTask?

  override func loadView() {
    view = TrayPanelRootView(frame: NSRect(x: 0, y: 0, width: 364, height: 182))
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    configureView()
    applyState(.empty)
  }

  func applyState(_ nextState: TrayPlaybackState) {
    currentThemeMode = nextState.themeMode == "light" ? "light" : "dark"
    applyAppearance()
    titleButton.title = nextState.title
    subtitleLabel.stringValue = nextState.subtitle
    progressView.progress = nextState.progressValue
    previousButton.isEnabled = nextState.hasPrev
    nextButton.isEnabled = nextState.hasNext
    playPauseButton.isEnabled = nextState.hasTrack
    playPauseButton.alphaValue = nextState.hasTrack ? 1 : 0.38
    configureSymbolButton(
      playPauseButton,
      symbolName: nextState.playing ? "pause.fill" : "play.fill"
    )
    updateArtwork(from: nextState.coverSource, hasTrack: nextState.hasTrack)
  }

  private func configureView() {
    backgroundView.material = .hudWindow
    backgroundView.state = .active
    backgroundView.blendingMode = .behindWindow
    backgroundView.wantsLayer = true
    backgroundView.layer?.cornerRadius = 18
    backgroundView.layer?.borderWidth = 1
    backgroundView.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(backgroundView)

    let content = NSStackView()
    content.orientation = .horizontal
    content.spacing = 16
    content.edgeInsets = NSEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
    content.translatesAutoresizingMaskIntoConstraints = false
    backgroundView.addSubview(content)

    configureArtworkView()
    let mainColumn = NSStackView()
    mainColumn.orientation = .vertical
    mainColumn.spacing = 16

    let metaColumn = NSStackView()
    metaColumn.orientation = .vertical
    metaColumn.spacing = 6
    configureTitleButton()
    subtitleLabel.font = .systemFont(ofSize: 12, weight: .regular)
    subtitleLabel.lineBreakMode = .byTruncatingTail
    progressView.translatesAutoresizingMaskIntoConstraints = false
    metaColumn.addArrangedSubview(titleButton)
    metaColumn.addArrangedSubview(subtitleLabel)
    metaColumn.addArrangedSubview(progressView)

    let transportRow = NSStackView()
    transportRow.orientation = .horizontal
    transportRow.spacing = 8
    configureTransportButton(
      previousButton,
      symbolName: "backward.fill",
      primary: false,
      action: #selector(handlePrevious)
    )
    configureTransportButton(
      playPauseButton,
      symbolName: "play.fill",
      primary: true,
      action: #selector(handlePlayPause)
    )
    configureTransportButton(
      nextButton,
      symbolName: "forward.fill",
      primary: false,
      action: #selector(handleNext)
    )
    transportRow.addArrangedSubview(previousButton)
    transportRow.addArrangedSubview(playPauseButton)
    transportRow.addArrangedSubview(nextButton)

    let controlsRow = NSStackView()
    controlsRow.orientation = .horizontal
    controlsRow.spacing = 10
    controlsRow.alignment = .centerY
    controlsRow.distribution = .fill
    controlsRow.addArrangedSubview(transportRow)
    controlsRow.addArrangedSubview(NSView())
    configureOpenButton()
    controlsRow.addArrangedSubview(openButton)

    mainColumn.addArrangedSubview(metaColumn)
    mainColumn.addArrangedSubview(controlsRow)
    content.addArrangedSubview(artworkView)
    content.addArrangedSubview(mainColumn)

    NSLayoutConstraint.activate([
      backgroundView.topAnchor.constraint(equalTo: view.topAnchor),
      backgroundView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      backgroundView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      backgroundView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      content.topAnchor.constraint(equalTo: backgroundView.topAnchor),
      content.leadingAnchor.constraint(equalTo: backgroundView.leadingAnchor),
      content.trailingAnchor.constraint(equalTo: backgroundView.trailingAnchor),
      content.bottomAnchor.constraint(equalTo: backgroundView.bottomAnchor),
      artworkView.widthAnchor.constraint(equalToConstant: 96),
      artworkView.heightAnchor.constraint(equalToConstant: 96),
      progressView.heightAnchor.constraint(equalToConstant: 14),
      previousButton.widthAnchor.constraint(equalToConstant: 38),
      previousButton.heightAnchor.constraint(equalToConstant: 38),
      playPauseButton.widthAnchor.constraint(equalToConstant: 44),
      playPauseButton.heightAnchor.constraint(equalToConstant: 44),
      nextButton.widthAnchor.constraint(equalToConstant: 38),
      nextButton.heightAnchor.constraint(equalToConstant: 38),
      openButton.heightAnchor.constraint(equalToConstant: 32),
      openButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 64)
    ])
    applyAppearance()
  }

  private func configureArtworkView() {
    artworkView.wantsLayer = true
    artworkView.layer?.cornerRadius = 14
    artworkView.layer?.masksToBounds = true
    artworkView.imageScaling = .scaleAxesIndependently
    artworkView.translatesAutoresizingMaskIntoConstraints = false
    artworkView.image = placeholderArtwork()
    artworkView.toolTip = "打开主窗口"
    artworkView.addGestureRecognizer(
      NSClickGestureRecognizer(target: self, action: #selector(handleOpenMainWindow))
    )
  }

  private func configureTitleButton() {
    titleButton.isBordered = false
    titleButton.bezelStyle = .inline
    titleButton.font = .systemFont(ofSize: 15, weight: .semibold)
    titleButton.lineBreakMode = .byTruncatingTail
    titleButton.alignment = .left
    titleButton.imagePosition = .noImage
    titleButton.target = self
    titleButton.action = #selector(handleOpenMainWindow)
  }

  private func configureTransportButton(
    _ button: NSButton,
    symbolName: String,
    primary: Bool,
    action: Selector
  ) {
    button.bezelStyle = .regularSquare
    button.isBordered = false
    button.wantsLayer = true
    button.translatesAutoresizingMaskIntoConstraints = false
    button.imageScaling = .scaleProportionallyDown
    button.layer?.cornerRadius = primary ? 22 : 19
    button.layer?.borderWidth = 1
    button.identifier = NSUserInterfaceItemIdentifier(primary ? "tray-primary" : "tray-secondary")
    button.target = self
    button.action = action
    configureSymbolButton(
      button,
      symbolName: symbolName,
      pointSize: primary ? 16 : 14
    )
  }

  private func configureOpenButton() {
    openButton.isBordered = false
    openButton.bezelStyle = .regularSquare
    openButton.wantsLayer = true
    openButton.layer?.cornerRadius = 16
    openButton.layer?.borderWidth = 1
    openButton.font = .systemFont(ofSize: 12, weight: .semibold)
    openButton.target = self
    openButton.action = #selector(handleOpenMainWindow)
  }

  private func applyAppearance() {
    let colors = trayPalette()
    backgroundView.layer?.borderColor = colors.panelBorder.cgColor
    artworkView.layer?.backgroundColor = colors.coverBackground.cgColor
    if currentCoverSource.isEmpty {
      artworkView.image = placeholderArtwork()
    }
    titleButton.contentTintColor = colors.primaryText
    subtitleLabel.textColor = colors.secondaryText
    openButton.contentTintColor = colors.primaryText
    openButton.layer?.borderColor = colors.secondaryButtonBorder.cgColor
    openButton.layer?.backgroundColor = colors.secondaryButtonBackground.cgColor
    previousButton.contentTintColor = colors.secondaryButtonText
    previousButton.layer?.borderColor = colors.secondaryButtonBorder.cgColor
    previousButton.layer?.backgroundColor = colors.secondaryButtonBackground.cgColor
    nextButton.contentTintColor = colors.secondaryButtonText
    nextButton.layer?.borderColor = colors.secondaryButtonBorder.cgColor
    nextButton.layer?.backgroundColor = colors.secondaryButtonBackground.cgColor
    playPauseButton.contentTintColor = colors.primaryButtonText
    playPauseButton.layer?.borderColor = colors.primaryButtonBorder.cgColor
    playPauseButton.layer?.backgroundColor = colors.primaryButtonBackground.cgColor
    progressView.trackColor = colors.progressTrack
    progressView.fillColor = accentColor
  }

  private func trayPalette() -> TrayAppearancePalette {
    if currentThemeMode != "light" {
      return TrayAppearancePalette(
        panelBorder: NSColor.white.withAlphaComponent(0.1),
        coverBackground: NSColor.white.withAlphaComponent(0.08),
        primaryText: NSColor.white.withAlphaComponent(0.96),
        secondaryText: NSColor.white.withAlphaComponent(0.68),
        secondaryButtonBackground: NSColor.white.withAlphaComponent(0.08),
        secondaryButtonBorder: NSColor.white.withAlphaComponent(0.08),
        secondaryButtonText: NSColor.white.withAlphaComponent(0.96),
        primaryButtonBackground: accentColor,
        primaryButtonBorder: accentColor.withAlphaComponent(0.35),
        primaryButtonText: .white,
        progressTrack: NSColor.white.withAlphaComponent(0.12)
      )
    }
    return TrayAppearancePalette(
      panelBorder: NSColor(calibratedWhite: 0.1, alpha: 0.08),
      coverBackground: NSColor(calibratedWhite: 0.1, alpha: 0.06),
      primaryText: NSColor(calibratedWhite: 0.08, alpha: 0.92),
      secondaryText: NSColor(calibratedWhite: 0.25, alpha: 0.8),
      secondaryButtonBackground: NSColor(calibratedWhite: 0.1, alpha: 0.06),
      secondaryButtonBorder: NSColor(calibratedWhite: 0.1, alpha: 0.08),
      secondaryButtonText: NSColor(calibratedWhite: 0.08, alpha: 0.92),
      primaryButtonBackground: accentColor,
      primaryButtonBorder: accentColor.withAlphaComponent(0.35),
      primaryButtonText: .white,
      progressTrack: NSColor(calibratedWhite: 0.1, alpha: 0.1)
    )
  }

  private func configureSymbolButton(
    _ button: NSButton,
    symbolName: String,
    pointSize: CGFloat = 14
  ) {
    if #available(macOS 11.0, *) {
      let configuration = NSImage.SymbolConfiguration(
        pointSize: pointSize,
        weight: .semibold,
        scale: .medium
      )
      if let image = NSImage(
        systemSymbolName: symbolName,
        accessibilityDescription: nil
      )?.withSymbolConfiguration(configuration) {
        image.isTemplate = true
        button.image = image
        button.title = ""
        button.imagePosition = .imageOnly
        return
      }
    }
    button.image = nil
    button.title = fallbackButtonTitle(for: symbolName)
  }

  private func fallbackButtonTitle(for symbolName: String) -> String {
    switch symbolName {
    case "backward.fill":
      return "⏮"
    case "forward.fill":
      return "⏭"
    case "pause.fill":
      return "⏸"
    case "play.fill":
      return "▶"
    default:
      return symbolName
    }
  }

  private func updateArtwork(from coverSource: String, hasTrack: Bool) {
    guard currentCoverSource != coverSource else {
      if !hasTrack {
        artworkView.image = placeholderArtwork()
      }
      return
    }
    currentCoverSource = coverSource
    currentCoverTask?.cancel()
    guard hasTrack, !coverSource.isEmpty else {
      artworkView.image = placeholderArtwork()
      return
    }
    if coverSource.hasPrefix("/") {
      artworkView.image = NSImage(contentsOfFile: coverSource) ?? placeholderArtwork()
      return
    }
    guard let url = URL(string: coverSource) else {
      artworkView.image = placeholderArtwork()
      return
    }
    artworkView.image = placeholderArtwork()
    currentCoverTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
      guard let self, self.currentCoverSource == coverSource else {
        return
      }
      let image = data.flatMap(NSImage.init(data:)) ?? self.placeholderArtwork()
      DispatchQueue.main.async {
        guard self.currentCoverSource == coverSource else {
          return
        }
        self.artworkView.image = image
      }
    }
    currentCoverTask?.resume()
  }

  private func placeholderArtwork() -> NSImage {
    let colors = trayPalette()
    return makeTrayPlaceholderArtwork(
      isDarkMode: colors.primaryText.perceivedBrightness > 0.7,
      accentColor: accentColor
    )
  }

  @objc private func handlePrevious() {
    onPrevious?()
  }

  @objc private func handlePlayPause() {
    onPlayPause?()
  }

  @objc private func handleNext() {
    onNext?()
  }

  @objc private func handleOpenMainWindow() {
    onShowMainWindow?()
  }
}

private final class TrayPanelRootView: NSView {
  override var isOpaque: Bool {
    false
  }

  override func draw(_ dirtyRect: NSRect) {
    super.draw(dirtyRect)
    NSColor.clear.setFill()
    dirtyRect.fill()
  }
}

private final class TrayProgressView: NSView {
  var trackColor: NSColor = NSColor.white.withAlphaComponent(0.12) {
    didSet {
      needsDisplay = true
    }
  }

  var fillColor: NSColor = NSColor(calibratedRed: 0.78, green: 0.18, blue: 0.18, alpha: 1) {
    didSet {
      needsDisplay = true
    }
  }

  var progress: Double = 0 {
    didSet {
      needsDisplay = true
    }
  }

  override var intrinsicContentSize: NSSize {
    NSSize(width: 240, height: 14)
  }

  override var isOpaque: Bool {
    false
  }

  override func draw(_ dirtyRect: NSRect) {
    super.draw(dirtyRect)
    let clamped = max(0, min(progress, 1000)) / 1000
    let trackRect = NSRect(x: 0, y: 4, width: bounds.width, height: 6)
    let fillWidth = trackRect.width * clamped
    let fillRect = NSRect(x: trackRect.minX, y: trackRect.minY, width: fillWidth, height: trackRect.height)
    NSBezierPath(roundedRect: trackRect, xRadius: 3, yRadius: 3).addClip()
    trackColor.setFill()
    trackRect.fill()
    fillColor.setFill()
    fillRect.fill()
    let knobX = min(max(trackRect.minX + fillWidth - 6, trackRect.minX), trackRect.maxX - 12)
    let knobRect = NSRect(x: knobX, y: 1, width: 12, height: 12)
    fillColor.setFill()
    NSBezierPath(ovalIn: knobRect).fill()
  }
}

private struct TrayAppearancePalette {
  let panelBorder: NSColor
  let coverBackground: NSColor
  let primaryText: NSColor
  let secondaryText: NSColor
  let secondaryButtonBackground: NSColor
  let secondaryButtonBorder: NSColor
  let secondaryButtonText: NSColor
  let primaryButtonBackground: NSColor
  let primaryButtonBorder: NSColor
  let primaryButtonText: NSColor
  let progressTrack: NSColor
}
