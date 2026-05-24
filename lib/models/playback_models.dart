// Playback and import DTOs cover search results, share imports, daily picks, and resolved play media.

import 'package:cloudplayer_flutter/models/library_models.dart';
import 'package:cloudplayer_flutter/models/model_utils.dart';

class DailyRecommendation {
  DailyRecommendation({
    required this.date,
    required this.source,
    required this.rows,
  });

  factory DailyRecommendation.fromJson(Map<String, dynamic> json) {
    final rows = (json['rows'] as List<dynamic>? ?? <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(TrackRow.fromSearchJson)
        .toList();
    return DailyRecommendation(
      date: readModelString(json, 'date'),
      source: readModelString(json, 'source'),
      rows: rows,
    );
  }

  final String date;
  final String source;
  final List<TrackRow> rows;
}

class SearchCatalogResponse {
  SearchCatalogResponse({
    required this.results,
    required this.hasNext,
    required this.providerKey,
    required this.failedProviderKey,
    required this.fallbackApplied,
    required this.providerPersisted,
  });

  factory SearchCatalogResponse.fromJson(Map<String, dynamic> json) {
    final results = (json['results'] as List<dynamic>? ?? <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(TrackRow.fromSearchJson)
        .toList();
    return SearchCatalogResponse(
      results: results,
      hasNext: readModelBool(json, 'has_next'),
      providerKey: readModelString(json, 'provider_key'),
      failedProviderKey: readModelString(json, 'failed_provider_key'),
      fallbackApplied: readModelBool(json, 'fallback_applied'),
      providerPersisted: readModelBool(json, 'provider_persisted'),
    );
  }

  final List<TrackRow> results;
  final bool hasNext;
  final String providerKey;
  final String failedProviderKey;
  final bool fallbackApplied;
  final bool providerPersisted;
}

class ResolveOnlinePlayOut {
  ResolveOnlinePlayOut({
    required this.kind,
    required this.path,
    required this.url,
    required this.via,
    required this.resolvedSourceId,
  });

  factory ResolveOnlinePlayOut.fromJson(Map<String, dynamic> json) {
    return ResolveOnlinePlayOut(
      kind: readModelString(json, 'kind'),
      path: readModelString(json, 'path'),
      url: readModelString(json, 'url'),
      via: readModelString(json, 'via'),
      resolvedSourceId: readModelString(json, 'resolved_source_id'),
    );
  }

  final String kind;
  final String path;
  final String url;
  final String via;
  final String resolvedSourceId;
}

class ScanMusicFolderResult {
  ScanMusicFolderResult({
    required this.audioFilesSeen,
    required this.rowsWritten,
  });

  factory ScanMusicFolderResult.fromJson(Map<String, dynamic> json) {
    return ScanMusicFolderResult(
      audioFilesSeen: readModelInt(json, 'audio_files_seen'),
      rowsWritten: readModelInt(json, 'rows_written'),
    );
  }

  final int audioFilesSeen;
  final int rowsWritten;
}

class SharePlaylistData {
  SharePlaylistData({required this.playlistName, required this.tracks});

  factory SharePlaylistData.fromJson(Map<String, dynamic> json) {
    final tracks = (json['tracks'] as List<dynamic>? ?? <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(TrackRow.fromImportJson)
        .toList();
    return SharePlaylistData(
      playlistName: readModelString(json, 'playlist_name', fallback: '导入歌单'),
      tracks: tracks,
    );
  }

  final String playlistName;
  final List<TrackRow> tracks;
}
