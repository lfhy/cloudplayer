#include "flutter_window.h"

#include <optional>

#include "flutter/generated_plugin_registrant.h"

FlutterWindow::FlutterWindow(const flutter::DartProject& project)
    : project_(project) {}

FlutterWindow::~FlutterWindow() {}

namespace {

COLORREF ColorRefFromArgb(int32_t argb) {
  const BYTE red = static_cast<BYTE>((argb >> 16) & 0xFF);
  const BYTE green = static_cast<BYTE>((argb >> 8) & 0xFF);
  const BYTE blue = static_cast<BYTE>(argb & 0xFF);
  return RGB(red, green, blue);
}

std::optional<int32_t> ReadInt32Value(
    const flutter::EncodableMap& arguments,
    const char* key) {
  const auto value_it = arguments.find(flutter::EncodableValue(key));
  if (value_it == arguments.end()) {
    return std::nullopt;
  }
  if (const auto* int32_value = std::get_if<int32_t>(&value_it->second)) {
    return *int32_value;
  }
  if (const auto* int64_value = std::get_if<int64_t>(&value_it->second)) {
    return static_cast<int32_t>(*int64_value);
  }
  return std::nullopt;
}

}  // namespace

bool FlutterWindow::OnCreate() {
  if (!Win32Window::OnCreate()) {
    return false;
  }

  RECT frame = GetClientArea();

  // The size here must match the window dimensions to avoid unnecessary surface
  // creation / destruction in the startup path.
  flutter_controller_ = std::make_unique<flutter::FlutterViewController>(
      frame.right - frame.left, frame.bottom - frame.top, project_);
  // Ensure that basic setup of the controller was successful.
  if (!flutter_controller_->engine() || !flutter_controller_->view()) {
    return false;
  }
  RegisterWindowThemeChannel();
  RegisterPlugins(flutter_controller_->engine());
  SetChildContent(flutter_controller_->view()->GetNativeWindow());

  flutter_controller_->engine()->SetNextFrameCallback([&]() {
    this->Show();
  });

  // Flutter can complete the first frame before the "show window" callback is
  // registered. The following call ensures a frame is pending to ensure the
  // window is shown. It is a no-op if the first frame hasn't completed yet.
  flutter_controller_->ForceRedraw();

  return true;
}

void FlutterWindow::OnDestroy() {
  if (window_theme_channel_) {
    window_theme_channel_.reset();
  }
  if (flutter_controller_) {
    flutter_controller_ = nullptr;
  }

  Win32Window::OnDestroy();
}

LRESULT
FlutterWindow::MessageHandler(HWND hwnd, UINT const message,
                              WPARAM const wparam,
                              LPARAM const lparam) noexcept {
  // Give Flutter, including plugins, an opportunity to handle window messages.
  if (flutter_controller_) {
    std::optional<LRESULT> result =
        flutter_controller_->HandleTopLevelWindowProc(hwnd, message, wparam,
                                                      lparam);
    if (result) {
      return *result;
    }
  }

  switch (message) {
    case WM_FONTCHANGE:
      flutter_controller_->engine()->ReloadSystemFonts();
      break;
  }

  return Win32Window::MessageHandler(hwnd, message, wparam, lparam);
}

void FlutterWindow::RegisterWindowThemeChannel() {
  window_theme_channel_ =
      std::make_unique<flutter::MethodChannel<flutter::EncodableValue>>(
          flutter_controller_->engine()->messenger(),
          "cloudplayer/windows_window_theme",
          &flutter::StandardMethodCodec::GetInstance());

  window_theme_channel_->SetMethodCallHandler(
      [this](const flutter::MethodCall<flutter::EncodableValue>& call,
             std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>>
                 result) {
        if (call.method_name() != "setWindowTheme") {
          result->NotImplemented();
          return;
        }
        const auto* arguments = std::get_if<flutter::EncodableMap>(call.arguments());
        if (arguments == nullptr) {
          result->Error("bad-args", "Expected a map payload.");
          return;
        }
        const auto dark_mode_it =
            arguments->find(flutter::EncodableValue("darkMode"));
        if (dark_mode_it == arguments->end()) {
          result->Error("bad-args", "Missing darkMode.");
          return;
        }
        const auto* dark_mode =
            std::get_if<bool>(&dark_mode_it->second);
        if (dark_mode == nullptr) {
          result->Error("bad-args", "darkMode must be a bool.");
          return;
        }
        const auto caption_color = ReadInt32Value(*arguments, "captionColor");
        if (!caption_color.has_value()) {
          result->Error("bad-args", "Missing captionColor.");
          return;
        }
        const auto text_color = ReadInt32Value(*arguments, "textColor");
        if (!text_color.has_value()) {
          result->Error("bad-args", "Missing textColor.");
          return;
        }
        SetFrameDarkMode(*dark_mode);
        SetCaptionColor(ColorRefFromArgb(*caption_color));
        SetTextColor(ColorRefFromArgb(*text_color));
        result->Success();
      });
}
