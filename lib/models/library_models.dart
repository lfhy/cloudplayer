// Library models cover playlists and track rows shared across search, import, daily, and playback flows.

import 'package:cloudplayer_flutter/models/model_utils.dart';

class PlaylistRow {
  PlaylistRow({
    required this.id,
    required this.name,
    required this.isBuiltin,
    required this.isCloud,
    required this.isFavorites,
    required this.cloudListId,
    required this.cloudSource,
    required this.cloudWritable,
  });

  factory PlaylistRow.fromJson(Map<String, dynamic> json) {
    return PlaylistRow(
      id: readModelInt64(json, 'id'),
      name: readModelString(json, 'name', fallback: '歌单'),
      isBuiltin: readModelBool(json, 'is_builtin'),
      isCloud: readModelBool(json, 'is_cloud'),
      isFavorites: readModelBool(json, 'is_favorites'),
      cloudListId: readNullableModelInt64(json, 'cloud_list_id'),
      cloudSource: readModelString(json, 'cloud_source'),
      cloudWritable: readModelBool(json, 'cloud_writable'),
    );
  }

  final int id;
  final String name;
  final bool isBuiltin;
  final bool isCloud;
  final bool isFavorites;
  final int? cloudListId;
  final String cloudSource;
  final bool cloudWritable;
}

class PlaylistSearchResult {
  PlaylistSearchResult({
    required this.playlist,
    required this.trackCount,
    required this.matchedTracks,
    this.coverTrack,
  });

  final PlaylistRow playlist;
  final int trackCount;
  final List<TrackRow> matchedTracks;
  final TrackRow? coverTrack;
}

class TrackRow {
  TrackRow({
    required this.id,
    required this.title,
    required this.artist,
    required this.album,
    required this.sourceId,
    required this.localPath,
    required this.coverUrl,
    required this.coverCachePath,
    required this.durationMs,
    required this.kugouFileId,
    required this.syncOrigin,
    required this.providerKey,
    required this.kind,
  });

  factory TrackRow.fromSearchJson(Map<String, dynamic> json) {
    return TrackRow(
      id: readModelInt64(json, 'id'),
      title: readModelString(json, 'title', fallback: '未命名曲目'),
      artist: readModelString(json, 'artist'),
      album: readModelString(json, 'album'),
      sourceId: readModelString(json, 'source_id'),
      localPath: '',
      coverUrl: readModelString(json, 'cover_url'),
      coverCachePath: '',
      durationMs: readModelInt64(json, 'duration_ms'),
      kugouFileId: 0,
      syncOrigin: '',
      providerKey: sourceProviderKeyForSourceId(
        readModelString(json, 'source_id'),
      ),
      kind: 'search',
    );
  }

  factory TrackRow.fromPlaylistJson(Map<String, dynamic> json) {
    return TrackRow(
      id: readModelInt64(json, 'id'),
      title: readModelString(json, 'title', fallback: '未命名曲目'),
      artist: readModelString(json, 'artist'),
      album: readModelString(json, 'album'),
      sourceId: readModelString(json, 'pjmp3_source_id'),
      localPath: readModelString(json, 'audio_cache_path'),
      coverUrl: readModelString(json, 'cover_url'),
      coverCachePath: readModelString(json, 'cover_cache_path'),
      durationMs: readModelInt64(json, 'duration_ms'),
      kugouFileId: readModelInt64(json, 'kugou_file_id'),
      syncOrigin: readModelString(json, 'sync_origin'),
      providerKey: sourceProviderKeyForSourceId(
        readModelString(json, 'pjmp3_source_id'),
      ),
      kind: 'playlist',
    );
  }

  factory TrackRow.fromRecentJson(Map<String, dynamic> json) {
    return TrackRow(
      id: 0,
      title: readModelString(json, 'title', fallback: '未命名曲目'),
      artist: readModelString(json, 'artist'),
      album: readModelString(json, 'album'),
      sourceId: readModelString(json, 'pjmp3_source_id'),
      localPath: readModelString(json, 'file_path'),
      coverUrl: readModelString(json, 'cover_url'),
      coverCachePath: readModelString(json, 'cover_cache_path'),
      durationMs: readModelInt64(json, 'duration_ms'),
      kugouFileId: 0,
      syncOrigin: '',
      providerKey: sourceProviderKeyForSourceId(
        readModelString(json, 'pjmp3_source_id'),
      ),
      kind: readModelString(json, 'kind', fallback: 'recent'),
    );
  }

  factory TrackRow.fromLocalSongJson(Map<String, dynamic> json) {
    return TrackRow(
      id: readModelInt64(json, 'id'),
      title: readModelString(json, 'title', fallback: '未命名曲目'),
      artist: readModelString(json, 'artist'),
      album: '',
      sourceId: '',
      localPath: readModelString(json, 'file_path'),
      coverUrl: '',
      coverCachePath: '',
      durationMs: 0,
      kugouFileId: 0,
      syncOrigin: '',
      providerKey: 'local',
      kind: 'local',
    );
  }

  factory TrackRow.fromImportJson(Map<String, dynamic> json) {
    return TrackRow(
      id: 0,
      title: readModelString(json, 'title', fallback: '未命名曲目'),
      artist: readModelString(json, 'artist'),
      album: readModelString(json, 'album'),
      sourceId: readModelString(json, 'pjmp3_source_id'),
      localPath: '',
      coverUrl: readModelString(json, 'cover_url'),
      coverCachePath: readModelString(json, 'cover_cache_path'),
      durationMs: readModelInt64(json, 'duration_ms'),
      kugouFileId: 0,
      syncOrigin: '',
      providerKey: sourceProviderKeyForSourceId(
        readModelString(json, 'pjmp3_source_id'),
      ),
      kind: 'import',
    );
  }

  factory TrackRow.fromPlaybackQueueJson(Map<String, dynamic> json) {
    final sourceId = readModelString(json, 'source_id');
    final localPath = readModelString(json, 'local_path');
    return TrackRow(
      id: 0,
      title: readModelString(json, 'title', fallback: '未命名曲目'),
      artist: readModelString(json, 'artist'),
      album: readModelString(json, 'album'),
      sourceId: sourceId,
      localPath: localPath,
      coverUrl: readModelString(json, 'cover_url'),
      coverCachePath: '',
      durationMs: readModelInt64(json, 'duration_ms'),
      kugouFileId: 0,
      syncOrigin: '',
      providerKey: localPath.isNotEmpty
          ? 'local'
          : sourceProviderKeyForSourceId(sourceId),
      kind: 'queue',
    );
  }

  final int id;
  final String title;
  final String artist;
  final String album;
  final String sourceId;
  final String localPath;
  final String coverUrl;
  final String coverCachePath;
  final int durationMs;
  final int kugouFileId;
  final String syncOrigin;
  final String providerKey;
  final String kind;

  bool get isLocalOnly => sourceId.isEmpty && localPath.isNotEmpty;

  Map<String, dynamic> toRecentPlayJson() {
    return <String, dynamic>{
      'kind': isLocalOnly ? 'local' : 'online',
      'title': title,
      'artist': artist,
      'album': album,
      'cover_url': coverUrl.isEmpty ? null : coverUrl,
      'pjmp3_source_id': sourceId.isEmpty ? null : sourceId,
      'file_path': localPath.isEmpty ? null : localPath,
      'duration_ms': durationMs,
    };
  }

  Map<String, dynamic> toFavoriteTrackJson() {
    return <String, dynamic>{
      'title': title,
      'artist': artist,
      'album': album,
      'pjmp3_source_id': sourceId,
      'cover_url': coverUrl,
      'duration_ms': durationMs,
    };
  }

  Map<String, dynamic> toImportJson() {
    return <String, dynamic>{
      'title': title,
      'artist': artist,
      'album': album,
      'pjmp3_source_id': sourceId,
      'cover_url': coverUrl,
      'duration_ms': durationMs,
    };
  }

  Map<String, dynamic> toPlaybackQueueJson() {
    return <String, dynamic>{
      'source_id': sourceId,
      'title': title,
      'artist': artist,
      'album': album,
      'cover_url': coverUrl,
      'duration_ms': durationMs,
      'local_path': localPath,
    };
  }
}
