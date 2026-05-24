// Kugou-specific DTOs keep auth state and import playlist results out of the generic app models.

import 'package:cloudplayer_flutter/models/library_models.dart';
import 'package:cloudplayer_flutter/models/model_utils.dart';

class KugouLoginQRCode {
  KugouLoginQRCode({
    required this.key,
    required this.url,
    required this.base64,
    required this.expireIn,
  });

  factory KugouLoginQRCode.fromJson(Map<String, dynamic> json) {
    return KugouLoginQRCode(
      key: readModelString(json, 'key'),
      url: readModelString(json, 'url'),
      base64: readModelString(json, 'base64'),
      expireIn: readModelInt(json, 'expire_in', fallback: 120),
    );
  }

  final String key;
  final String url;
  final String base64;
  final int expireIn;
}

class KugouLoginStatus {
  KugouLoginStatus({
    required this.status,
    required this.loggedIn,
    required this.userId,
    required this.nickname,
    required this.avatarUrl,
  });

  factory KugouLoginStatus.fromJson(Map<String, dynamic> json) {
    return KugouLoginStatus(
      status: readModelString(json, 'status', fallback: 'logged_out'),
      loggedIn: readModelBool(json, 'logged_in'),
      userId: readModelString(json, 'user_id'),
      nickname: readModelString(json, 'nickname'),
      avatarUrl: readModelString(json, 'avatar_url'),
    );
  }

  final String status;
  final bool loggedIn;
  final String userId;
  final String nickname;
  final String avatarUrl;
}

class KugouCaptchaResult {
  KugouCaptchaResult({required this.sent, required this.message});

  factory KugouCaptchaResult.fromJson(Map<String, dynamic> json) {
    return KugouCaptchaResult(
      sent: readModelBool(json, 'sent'),
      message: readModelString(json, 'message'),
    );
  }

  final bool sent;
  final String message;
}

class KugouPlaylistRow {
  KugouPlaylistRow({
    required this.id,
    required this.name,
    required this.coverUrl,
    required this.trackCount,
    required this.isFavorites,
  });

  factory KugouPlaylistRow.fromJson(Map<String, dynamic> json) {
    return KugouPlaylistRow(
      id: readModelInt64(json, 'id'),
      name: readModelString(json, 'name', fallback: '歌单'),
      coverUrl: readModelString(json, 'cover_url'),
      trackCount: readModelInt(json, 'track_count'),
      isFavorites: readModelBool(json, 'is_favorites'),
    );
  }

  final int id;
  final String name;
  final String coverUrl;
  final int trackCount;
  final bool isFavorites;
}

class KugouSyncResult {
  KugouSyncResult({
    required this.playlistName,
    required this.tracks,
    required this.kugouFileIds,
  });

  factory KugouSyncResult.fromJson(Map<String, dynamic> json) {
    final tracks = (json['tracks'] as List<dynamic>? ?? <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(TrackRow.fromImportJson)
        .toList();
    final kugouFileIds = (json['kugou_file_ids'] as List<dynamic>? ?? <dynamic>[])
        .map((value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0)
        .where((value) => value > 0)
        .toList();
    return KugouSyncResult(
      playlistName: readModelString(json, 'playlist_name', fallback: '酷狗导入歌单'),
      tracks: tracks,
      kugouFileIds: kugouFileIds,
    );
  }

  final String playlistName;
  final List<TrackRow> tracks;
  final List<int> kugouFileIds;
}
