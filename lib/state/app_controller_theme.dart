// Theme-mode updates live in their own controller part so dock quick-toggle
// actions can persist appearance changes without reusing generic save toasts.

part of 'app_controller.dart';

extension AppControllerThemeSettings on AppController {
  Future<void> saveThemeModeQuietly(String mode) async {
    final current = settings;
    if (current == null || current.appThemeMode == mode) {
      return;
    }
    settings = current.copyWith(appThemeMode: mode);
    _notifyStateChanged();
    await api.saveSettings(settings!);
    if (isDesktopHost) {
      await syncTrayState();
    }
  }
}
