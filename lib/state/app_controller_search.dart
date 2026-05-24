// Search shortcuts stay in their own controller part so list-driven navigation
// can reuse the same legacy search trigger behavior across pages.

part of 'app_controller.dart';

extension AppControllerSearch on AppController {
  Future<void> triggerTrackSearch(String keyword) async {
    final normalized = keyword.trim();
    if (normalized.isEmpty) return;
    if (searchScope != SearchScope.catalog) {
      setSearchScope(SearchScope.catalog);
    }
    if (currentPage != AppPage.search) {
      await setPage(AppPage.search);
    }
    await performSearch(normalized);
  }
}
