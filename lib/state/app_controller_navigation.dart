// Navigation helpers centralize platform back-button behavior so Android can
// unwind immersive and top-level page state without a Navigator route stack.

part of 'app_controller.dart';

extension AppControllerNavigation on AppController {
  Future<bool> handleSystemBack() async {
    if (!isMobileHost) {
      return true;
    }
    if (immersiveOpen) {
      if (immersiveLyricsVisible) {
        immersiveLyricsVisible = false;
        _notifyStateChanged();
      } else {
        closeImmersive();
      }
      return false;
    }
    if (currentPage != AppPage.home) {
      await setPage(AppPage.home);
      return false;
    }
    return true;
  }
}
