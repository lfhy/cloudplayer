import Cocoa
import FlutterMacOS

// App delegate keeps CloudPlayer alive after the main window hides so the
// legacy macOS menu-bar workflow continues to work.
@main
class AppDelegate: FlutterAppDelegate {
  override func applicationDidFinishLaunching(_ notification: Notification) {
    super.applicationDidFinishLaunching(notification)
    DispatchQueue.main.async {
      NSApp.setActivationPolicy(.regular)
      showCloudPlayerMainWindow()
    }
  }

  override func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    return false
  }

  override func applicationShouldHandleReopen(
    _ sender: NSApplication,
    hasVisibleWindows flag: Bool
  ) -> Bool {
    showCloudPlayerMainWindow()
    return true
  }

  override func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
    return true
  }
}
