import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  private var desktopLyricsChannel: DesktopLyricsChannel?
  private var menuBarController: MenuBarController?

  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)

    RegisterGeneratedPlugins(registry: flutterViewController)
    desktopLyricsChannel = DesktopLyricsChannel(
      binaryMessenger: flutterViewController.engine.binaryMessenger
    )
    menuBarController = MenuBarController(
      binaryMessenger: flutterViewController.engine.binaryMessenger
    )

    super.awakeFromNib()
  }
}
