// Typed API helpers keep the Flutter state layer focused on app behavior instead of JSON plumbing.

import 'package:cloudplayer_flutter/bridge/cloudplayer_bridge.dart';
import 'package:cloudplayer_flutter/models/app_models.dart';

class CloudPlayerApi {
  CloudPlayerApi(this._bridge);

  static Future<CloudPlayerApi> bootstrap() async {
    final bridge = await CloudPlayerBridge.connect();
    return CloudPlayerApi(bridge);
  }

  final CloudPlayerBridge _bridge;

  String get libraryPath => _bridge.libraryPath;
  String get mediaProxyBase => _bridge.mediaProxyBase;

  Future<AppSettings> getSettings() async {
    final payload = _bridge.call('get_settings') as Map<String, dynamic>;
    return AppSettings.fromJson(payload);
  }

  Future<void> saveSettings(AppSettings settings) async {
    _bridge.call('save_settings', settings.toPatchJson());
  }

  Future<void> savePlaybackSnapshot({
    required List<TrackRow> playQueue,
    required int playQueueIndex,
    required String playbackTrackKey,
    required int playbackPositionMs,
    required int playbackDurationMs,
  }) async {
    _bridge.call('save_settings', <String, dynamic>{
      'play_queue': playQueue
          .map((track) => track.toPlaybackQueueJson())
          .toList(growable: false),
      'play_queue_index': playQueueIndex,
      'playback_track_key': playbackTrackKey,
      'playback_position_ms': playbackPositionMs,
      'playback_duration_ms': playbackDurationMs,
    });
  }

  Future<bool> localPathAccessible(String path) async {
    final result = _bridge.call('local_path_accessible', <String, dynamic>{
      'path': path,
    });
    if (result is bool) return result;
    if (result is num) return result != 0;
    if (result is String) return result == 'true' || result == '1';
    return false;
  }

  Future<void> resetDesktopLyricsBounds() async {
    _bridge.call('reset_desktop_lyrics_bounds');
  }

  Future<String> dbStatus() async {
    return (_bridge.call('db_status') ?? '').toString();
  }

  Future<int> clearSearchCache() async {
    final result = _bridge.call('clear_search_cache');
    if (result is num) return result.toInt();
    return 0;
  }

  Future<List<PlaylistRow>> listPlaylists() async {
    final payload =
        (_bridge.call('list_playlists') as List<dynamic>? ?? <dynamic>[]);
    return payload
        .whereType<Map<String, dynamic>>()
        .map(PlaylistRow.fromJson)
        .toList();
  }

  Future<List<TrackRow>> listPlaylistImportItems(int playlistId) async {
    final payload =
        (_bridge.call('list_playlist_import_items', <String, dynamic>{
              'playlist_id': playlistId,
            })
            as List<dynamic>? ??
        <dynamic>[]);
    return payload
        .whereType<Map<String, dynamic>>()
        .map(TrackRow.fromPlaylistJson)
        .toList();
  }

  Future<List<TrackRow>> refreshPlaylistImportItems(int playlistId) async {
    final payload =
        (_bridge.call('refresh_playlist_import_items', <String, dynamic>{
              'playlist_id': playlistId,
            })
            as List<dynamic>? ??
        <dynamic>[]);
    return payload
        .whereType<Map<String, dynamic>>()
        .map(TrackRow.fromPlaylistJson)
        .toList();
  }

  Future<int> createPlaylist(String name) async {
    final result = _bridge.call('create_playlist', <String, dynamic>{
      'name': name,
    });
    if (result is num) return result.toInt();
    return 0;
  }

  Future<void> renamePlaylist(int playlistId, String name) async {
    _bridge.call('rename_playlist', <String, dynamic>{
      'playlist_id': playlistId,
      'name': name,
    });
  }

  Future<void> deletePlaylist(int playlistId) async {
    _bridge.call('delete_playlist', <String, dynamic>{
      'playlist_id': playlistId,
    });
  }

  Future<void> replacePlaylistItems(
    int playlistId,
    List<TrackRow> tracks,
  ) async {
    _bridge.call('replace_playlist_import_items', <String, dynamic>{
      'playlist_id': playlistId,
      'items': tracks.map((track) => track.toImportJson()).toList(),
    });
  }

  Future<void> appendPlaylistItems(
    int playlistId,
    List<TrackRow> tracks,
  ) async {
    _bridge.call('append_playlist_import_items', <String, dynamic>{
      'playlist_id': playlistId,
      'items': tracks.map((track) => track.toImportJson()).toList(),
    });
  }

  Future<void> deletePlaylistImportItem(int playlistId, int itemId) async {
    _bridge.call('delete_playlist_import_item', <String, dynamic>{
      'playlist_id': playlistId,
      'item_id': itemId,
    });
  }

  Future<void> startImportEnrich(int playlistId) async {
    _bridge.call('start_import_enrich', <String, dynamic>{
      'playlist_id': playlistId,
    });
  }

  Future<SearchCatalogResponse> searchSongs(
    String keyword, {
    int page = 1,
  }) async {
    final payload =
        _bridge.call('search_songs', <String, dynamic>{
              'keyword': keyword,
              'page': page,
            })
            as Map<String, dynamic>;
    return SearchCatalogResponse.fromJson(payload);
  }

  Future<List<TrackRow>> getSearchSongMetadata(List<String> songIds) async {
    final payload =
        (_bridge.call('get_search_song_metadata', <String, dynamic>{
              'song_ids': songIds,
            })
            as List<dynamic>? ??
        <dynamic>[]);
    return payload
        .whereType<Map<String, dynamic>>()
        .map(TrackRow.fromSearchJson)
        .toList();
  }

  Future<DailyRecommendation> getDailyRecommendation({
    bool force = false,
  }) async {
    final payload =
        _bridge.call('get_daily_recommendation', <String, dynamic>{
              'force': force,
            })
            as Map<String, dynamic>;
    return DailyRecommendation.fromJson(payload);
  }

  Future<List<TrackRow>> listRecentPlays() async {
    final payload =
        (_bridge.call('list_recent_plays') as List<dynamic>? ?? <dynamic>[]);
    return payload
        .whereType<Map<String, dynamic>>()
        .map(TrackRow.fromRecentJson)
        .toList();
  }

  Future<void> recordRecentPlay(TrackRow track) async {
    _bridge.call('record_recent_play', <String, dynamic>{
      'row': track.toRecentPlayJson(),
    });
  }

  Future<void> clearRecentPlays() async {
    _bridge.call('clear_recent_plays');
  }

  Future<List<TrackRow>> listLocalSongs() async {
    final payload =
        (_bridge.call('list_local_songs') as List<dynamic>? ?? <dynamic>[]);
    return payload
        .whereType<Map<String, dynamic>>()
        .map(TrackRow.fromLocalSongJson)
        .toList();
  }

  Future<ScanMusicFolderResult> scanMusicFolder(String selectedPath) async {
    final payload =
        _bridge.call('scan_music_folder', <String, dynamic>{
              'path': selectedPath,
            })
            as Map<String, dynamic>;
    return ScanMusicFolderResult.fromJson(payload);
  }

  Future<ResolveOnlinePlayOut> resolveOnlinePlay(TrackRow track) async {
    final payload =
        _bridge.call('resolve_online_play', <String, dynamic>{
              'song_id': track.sourceId,
              'title': track.title,
              'artist': track.artist,
            })
            as Map<String, dynamic>;
    return ResolveOnlinePlayOut.fromJson(payload);
  }

  Future<LyricsPayloadData> fetchSongLrcEnriched(
    TrackRow track, {
    int? durationMs,
  }) async {
    final payload =
        _bridge.call('fetch_song_lrc_enriched', <String, dynamic>{
              'request': <String, dynamic>{
                'pjmp3SourceId': track.sourceId.trim().isEmpty
                    ? null
                    : track.sourceId,
                'title': track.title,
                'artist': track.artist,
                'album': track.album,
                'localPath': track.localPath.trim().isEmpty
                    ? null
                    : track.localPath,
                'durationSeconds': durationMs == null || durationMs <= 0
                    ? null
                    : durationMs / 1000,
              },
            })
            as Map<String, dynamic>;
    return LyricsPayloadData.fromJson(payload);
  }

  Future<void> enqueueDownload(TrackRow track, {String quality = '128'}) async {
    _bridge.call('enqueue_download', <String, dynamic>{
      'job': <String, dynamic>{
        'source_id': track.sourceId,
        'title': track.title,
        'artist': track.artist,
        'cover_url': track.coverUrl,
        'quality': quality,
      },
    });
  }

  Future<List<TrackRow>> parseImportText(String text, String format) async {
    final payload =
        (_bridge.call('parse_import_text', <String, dynamic>{
              'text': text,
              'format': format,
            })
            as List<dynamic>? ??
        <dynamic>[]);
    return payload
        .whereType<Map<String, dynamic>>()
        .map(TrackRow.fromImportJson)
        .toList();
  }

  Future<SharePlaylistData> fetchSharePlaylist(String rawUrl) async {
    final payload =
        _bridge.call('fetch_share_playlist', <String, dynamic>{
              'raw_url': rawUrl,
            })
            as Map<String, dynamic>;
    return SharePlaylistData.fromJson(payload);
  }

  Future<PlaylistRow> ensureFavoritesPlaylist() async {
    final payload =
        _bridge.call('ensure_favorites_playlist') as Map<String, dynamic>;
    return PlaylistRow.fromJson(payload);
  }

  Future<List<String>> listFavoriteSourceIds() async {
    final payload =
        (_bridge.call('list_favorite_source_ids') as List<dynamic>? ??
        <dynamic>[]);
    return payload.map((item) => item.toString()).toList();
  }

  Future<void> addFavoriteTrack(TrackRow track) async {
    _bridge.call('add_favorite_track', <String, dynamic>{
      'track': track.toFavoriteTrackJson(),
    });
  }

  Future<void> removeFavoriteTrack(String sourceId) async {
    _bridge.call('remove_favorite_track', <String, dynamic>{
      'source_id': sourceId,
    });
  }

  Future<Map<String, dynamic>> repairMusicCollectionDatabase() async {
    final payload =
        _bridge.call('repair_music_collection_database')
            as Map<String, dynamic>;
    return payload;
  }

  Future<KugouLoginStatus> getKugouLoginStatus() async {
    final payload =
        _bridge.call('get_kugou_login_status') as Map<String, dynamic>;
    return KugouLoginStatus.fromJson(payload);
  }

  Future<KugouLoginQRCode> createKugouLoginQrCode() async {
    final payload =
        _bridge.call('create_kugou_login_qr_code') as Map<String, dynamic>;
    return KugouLoginQRCode.fromJson(payload);
  }

  Future<KugouLoginStatus> pollKugouLoginQrCode(String key) async {
    final payload =
        _bridge.call('poll_kugou_login_qr_code', <String, dynamic>{'key': key})
            as Map<String, dynamic>;
    return KugouLoginStatus.fromJson(payload);
  }

  Future<void> logoutKugou() async {
    _bridge.call('logout_kugou');
  }

  Future<KugouCaptchaResult> sendKugouLoginCaptcha(String mobile) async {
    final payload =
        _bridge.call('send_kugou_login_captcha', <String, dynamic>{
              'mobile': mobile,
            })
            as Map<String, dynamic>;
    return KugouCaptchaResult.fromJson(payload);
  }

  Future<KugouLoginStatus> loginKugouByCellphone(
    String mobile,
    String code,
  ) async {
    final payload =
        _bridge.call('login_kugou_by_cellphone', <String, dynamic>{
              'mobile': mobile,
              'code': code,
            })
            as Map<String, dynamic>;
    return KugouLoginStatus.fromJson(payload);
  }

  Future<List<KugouPlaylistRow>> listKugouPlaylists() async {
    final payload =
        (_bridge.call('list_kugou_playlists') as List<dynamic>? ?? <dynamic>[]);
    return payload
        .whereType<Map<String, dynamic>>()
        .map(KugouPlaylistRow.fromJson)
        .toList();
  }

  Future<KugouSyncResult> syncKugouPlaylist(int listId) async {
    final payload =
        _bridge.call('sync_kugou_playlist', <String, dynamic>{
              'list_id': listId,
            })
            as Map<String, dynamic>;
    return KugouSyncResult.fromJson(payload);
  }

  Future<KugouSyncResult> syncKugouPlaylists(List<int> listIds) async {
    final payload =
        _bridge.call('sync_kugou_playlists', <String, dynamic>{
              'list_ids': listIds,
            })
            as Map<String, dynamic>;
    return KugouSyncResult.fromJson(payload);
  }
}
