import Cocoa
import FlutterMacOS

// Desktop-lyrics channel bridges Flutter state pushes into the native macOS
// floating lyrics panel and sends window events back to Dart.

final class DesktopLyricsChannel {
  private let channel: FlutterMethodChannel
  private let controller: DesktopLyricsWindowController

  init(binaryMessenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(
      name: "cloudplayer/desktop_lyrics",
      binaryMessenger: binaryMessenger
    )
    controller = DesktopLyricsWindowController { [weak channel] method, payload in
      channel?.invokeMethod(method, arguments: payload)
    }
    channel.setMethodCallHandler(handleMethodCall)
  }

  private func handleMethodCall(
    _ call: FlutterMethodCall,
    result: @escaping FlutterResult
  ) {
    switch call.method {
    case "applyState":
      let payload = call.arguments as? [String: Any] ?? [:]
      controller.applyState(DesktopLyricsState(payload: payload))
      result(nil)
    case "hide":
      controller.hide()
      result(nil)
    case "resetBounds":
      result(controller.resetBounds())
    default:
      result(FlutterMethodNotImplemented)
    }
  }
}
