// Core controller helpers keep lifecycle and small shared state mutations out
// of the main controller file so repository size limits stay enforced.

part of 'app_controller.dart';

extension AppControllerCore on AppController {
  void clearStatus() {
    if (statusMessage.isEmpty) return;
    statusMessage = '';
    _notifyStateChanged();
  }

  void _applyImportDraft(
    List<TrackRow> tracks, {
    required String suggestedName,
    required String method,
  }) {
    importTracks = tracks;
    importSuggestedName = suggestedName;
    selectedImportMethod = method;
    _notifyStateChanged();
  }

  Future<List<PlaylistSearchResult>> _searchLocalPlaylists(
    String keyword,
  ) async {
    final normalized = keyword.trim().toLowerCase();
    if (normalized.isEmpty) {
      return <PlaylistSearchResult>[];
    }
    final rows = await api.listPlaylists();
    final results = await Future.wait(
      rows.map((playlist) async {
        final items = await api.listPlaylistImportItems(playlist.id);
        final matchedTracks = items
            .where((track) {
              final haystack = <String>[
                playlist.name,
                track.title,
                track.artist,
                track.album,
              ].join(' ').toLowerCase();
              return haystack.contains(normalized);
            })
            .toList(growable: false);
        final playlistMatched = playlist.name.toLowerCase().contains(
          normalized,
        );
        if (!playlistMatched && matchedTracks.isEmpty) {
          return null;
        }
        return PlaylistSearchResult(
          playlist: playlist,
          trackCount: items.length,
          matchedTracks: matchedTracks,
          coverTrack: _pickPlaylistSearchCover(matchedTracks, items),
        );
      }),
    );
    return results.whereType<PlaylistSearchResult>().toList(growable: false);
  }

  TrackRow? _pickPlaylistSearchCover(
    List<TrackRow> primary,
    List<TrackRow> fallback,
  ) {
    for (final track in primary) {
      if (track.coverUrl.trim().isNotEmpty ||
          track.coverCachePath.trim().isNotEmpty) {
        return track;
      }
    }
    for (final track in fallback) {
      if (track.coverUrl.trim().isNotEmpty ||
          track.coverCachePath.trim().isNotEmpty) {
        return track;
      }
    }
    return fallback.isEmpty ? null : fallback.first;
  }
}
