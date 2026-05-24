// Playlist management helpers stay in a separate controller part so playlist
// page actions and sidebar context menus do not bloat the root controller file.

part of 'app_controller.dart';

extension AppControllerPlaylistOps on AppController {
  Future<void> renamePlaylistRow(PlaylistRow playlist, String nextName) async {
    final trimmed = nextName.trim();
    if (trimmed.isEmpty) {
      return;
    }
    await api.renamePlaylist(playlist.id, trimmed);
    await refreshPlaylists();
    statusMessage = '歌单已重命名。';
    _notifyStateChanged();
  }

  Future<void> removeTracksFromSelectedPlaylist(List<int> itemIds) async {
    final playlist = selectedPlaylist;
    if (playlist == null) {
      return;
    }
    final uniqueIds = itemIds.where((id) => id > 0).toSet().toList()..sort();
    if (uniqueIds.isEmpty) {
      return;
    }
    for (final itemId in uniqueIds) {
      await api.deletePlaylistImportItem(playlist.id, itemId);
    }
    await loadSelectedPlaylist();
    statusMessage = '已从歌单移除 ${uniqueIds.length} 首歌曲。';
    _notifyStateChanged();
  }
}
