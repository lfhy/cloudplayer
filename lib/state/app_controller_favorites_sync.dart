// Favorites sync keeps the cloud-backed "我喜欢" playlist fresh while the user
// is browsing it, so new server-side additions can update hearts and rows.

part of 'app_controller.dart';

const Duration _favoritesPlaylistRefreshInterval = Duration(seconds: 45);

extension AppControllerFavoritesSync on AppController {
  bool get _shouldAutoRefreshFavoritesPlaylist {
    final playlist = selectedPlaylist;
    return currentPage == AppPage.playlist &&
        playlist != null &&
        playlist.isFavorites &&
        playlist.isCloud;
  }

  void _syncFavoritesPlaylistAutoRefresh() {
    if (!_shouldAutoRefreshFavoritesPlaylist) {
      _favoritesPlaylistRefreshTimer?.cancel();
      _favoritesPlaylistRefreshTimer = null;
      _favoritesPlaylistRefreshPlaylistId = -1;
      return;
    }
    final playlistId = selectedPlaylist!.id;
    if (_favoritesPlaylistRefreshPlaylistId != playlistId) {
      _favoritesPlaylistRefreshPlaylistId = playlistId;
      unawaited(_refreshFavoritesPlaylistState());
    }
    _favoritesPlaylistRefreshTimer ??= Timer.periodic(
      _favoritesPlaylistRefreshInterval,
      (_) => unawaited(_refreshFavoritesPlaylistState()),
    );
  }

  Future<void> _refreshFavoritesPlaylistState() async {
    if (_favoritesPlaylistRefreshInFlight ||
        !_shouldAutoRefreshFavoritesPlaylist) {
      return;
    }
    final playlist = selectedPlaylist;
    if (playlist == null) {
      return;
    }
    _favoritesPlaylistRefreshInFlight = true;
    try {
      final refreshedTracks = await api.refreshPlaylistImportItems(playlist.id);
      if (!_shouldAutoRefreshFavoritesPlaylist ||
          selectedPlaylist?.id != playlist.id) {
        return;
      }
      playlistTracks = refreshedTracks;
      favoriteIds = _favoriteSourceIdsFromTracks(refreshedTracks);
      _notifyStateChanged();
    } catch (_) {
      // Keep polling silent; users should not see periodic cloud refresh noise.
    } finally {
      _favoritesPlaylistRefreshInFlight = false;
    }
  }

  Set<String> _favoriteSourceIdsFromTracks(List<TrackRow> tracks) {
    return tracks
        .map((track) => track.sourceId.trim())
        .where((sourceId) => sourceId.isNotEmpty)
        .toSet();
  }
}
