// Favorites sync keeps the cloud-backed "我喜欢" playlist fresh on entry and
// after explicit heart actions, without polling in the background.

part of 'app_controller.dart';

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
      _favoritesPlaylistRefreshPlaylistId = -1;
      return;
    }
    final playlistId = selectedPlaylist!.id;
    if (_favoritesPlaylistRefreshPlaylistId != playlistId) {
      _favoritesPlaylistRefreshPlaylistId = playlistId;
      unawaited(_refreshFavoritesPlaylistState());
    }
  }

  void _refreshFavoritesPlaylistAfterFavoriteMutation() {
    if (!_shouldAutoRefreshFavoritesPlaylist) {
      return;
    }
    unawaited(_refreshFavoritesPlaylistState());
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
