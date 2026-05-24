// App settings stay isolated so preference forms can evolve without touching library or playback DTOs.

import 'package:cloudplayer_flutter/models/library_models.dart';
import 'package:cloudplayer_flutter/models/model_utils.dart';

class AppSettings {
  AppSettings({
    required this.volume,
    required this.playMode,
    required this.playQueue,
    required this.playQueueIndex,
    required this.playbackPositionMs,
    required this.playbackDurationMs,
    required this.playbackTrackKey,
    required this.downloadFolder,
    required this.lastLibraryFolder,
    required this.networkProxyMode,
    required this.networkProxyUrl,
    required this.lyricsNeteaseApiBase,
    required this.lyricsProviderOrder,
    required this.mainWindowCloseAction,
    required this.appTheme,
    required this.appThemeMode,
    required this.appThemeCustomAccent,
    required this.desktopLyricsColorBase,
    required this.desktopLyricsColorHighlight,
    required this.desktopLyricsIdleLine1,
    required this.desktopLyricsIdleLine2,
    required this.desktopLyricsVisible,
    required this.desktopLyricsLocked,
    required this.desktopLyricsScale,
    required this.desktopLyricsX,
    required this.desktopLyricsY,
    required this.desktopLyricsWidth,
    required this.desktopLyricsHeight,
    required this.musicCollectionMode,
    required this.musicSourceProvider,
    required this.playbackFallbackChain,
    required this.searchCacheTtlHours,
    required this.miniPlayerAlwaysOnTopState,
    required this.autoCacheOnPlay,
    required this.shareNeteaseCookieEnabled,
    required this.shareNeteaseCookie,
  });

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    return AppSettings(
      volume: readModelDouble(json, 'volume', fallback: 0.7),
      playMode: readModelString(json, 'play_mode', fallback: 'loop_list'),
      playQueue: (json['play_queue'] as List<dynamic>? ?? <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(TrackRow.fromPlaybackQueueJson)
          .toList(growable: false),
      playQueueIndex: readModelInt(json, 'play_queue_index'),
      playbackPositionMs: readModelInt64(json, 'playback_position_ms'),
      playbackDurationMs: readModelInt64(json, 'playback_duration_ms'),
      playbackTrackKey: readModelString(json, 'playback_track_key'),
      downloadFolder: readModelString(json, 'download_folder'),
      lastLibraryFolder: readModelString(json, 'last_library_folder'),
      networkProxyMode: readModelString(
        json,
        'network_proxy_mode',
        fallback: 'direct',
      ),
      networkProxyUrl: readModelString(json, 'network_proxy_url'),
      lyricsNeteaseApiBase: readModelString(json, 'lyrics_netease_api_base'),
      lyricsProviderOrder: readModelString(
        json,
        'lyrics_provider_order',
        fallback: 'qq,kugou,netease,lrclib',
      ),
      mainWindowCloseAction: readModelString(
        json,
        'main_window_close_action',
        fallback: 'ask',
      ),
      appTheme: readModelString(json, 'app_theme', fallback: 'coral'),
      appThemeMode: readModelString(json, 'app_theme_mode', fallback: 'dark'),
      appThemeCustomAccent: readModelString(
        json,
        'app_theme_custom_accent',
        fallback: '#c62f2f',
      ),
      desktopLyricsColorBase: readModelString(
        json,
        'desktop_lyrics_color_base',
        fallback: '#ffffff',
      ),
      desktopLyricsColorHighlight: readModelString(
        json,
        'desktop_lyrics_color_highlight',
        fallback: '#ffb7d4',
      ),
      desktopLyricsIdleLine1: readModelString(
        json,
        'desktop_lyrics_idle_line1',
        fallback: 'CloudPlayer',
      ),
      desktopLyricsIdleLine2: readModelString(
        json,
        'desktop_lyrics_idle_line2',
        fallback: '让音乐陪你此刻',
      ),
      desktopLyricsVisible: readModelBool(json, 'desktop_lyrics_visible'),
      desktopLyricsLocked: readModelBool(
        json,
        'desktop_lyrics_locked',
        fallback: true,
      ),
      desktopLyricsScale: readModelDouble(
        json,
        'desktop_lyrics_scale',
        fallback: 1,
      ),
      desktopLyricsX: readNullableModelInt64(json, 'desktop_lyrics_x'),
      desktopLyricsY: readNullableModelInt64(json, 'desktop_lyrics_y'),
      desktopLyricsWidth: readNullableModelInt64(json, 'desktop_lyrics_width'),
      desktopLyricsHeight: readNullableModelInt64(
        json,
        'desktop_lyrics_height',
      ),
      musicCollectionMode: readModelString(
        json,
        'music_collection_mode',
        fallback: 'offline',
      ),
      musicSourceProvider: readModelString(
        json,
        'music_source_provider',
        fallback: 'kugou',
      ),
      playbackFallbackChain: readModelString(
        json,
        'playback_fallback_chain',
        fallback: 'kugou,pjmp3,netease',
      ),
      searchCacheTtlHours: readModelInt(
        json,
        'search_cache_ttl_hours',
        fallback: 24,
      ),
      miniPlayerAlwaysOnTopState: readModelBool(
        json,
        'mini_player_always_on_top',
        fallback: false,
      ),
      autoCacheOnPlay: readModelBool(json, 'auto_cache_on_play'),
      shareNeteaseCookieEnabled: readModelBool(
        json,
        'share_netease_cookie_enabled',
      ),
      shareNeteaseCookie: readModelString(json, 'share_netease_cookie'),
    );
  }

  final double volume;
  final String playMode;
  final List<TrackRow> playQueue;
  final int playQueueIndex;
  final int playbackPositionMs;
  final int playbackDurationMs;
  final String playbackTrackKey;
  final String downloadFolder;
  final String lastLibraryFolder;
  final String networkProxyMode;
  final String networkProxyUrl;
  final String lyricsNeteaseApiBase;
  final String lyricsProviderOrder;
  final String mainWindowCloseAction;
  final String appTheme;
  final String appThemeMode;
  final String appThemeCustomAccent;
  final String desktopLyricsColorBase;
  final String desktopLyricsColorHighlight;
  final String desktopLyricsIdleLine1;
  final String desktopLyricsIdleLine2;
  final bool desktopLyricsVisible;
  final bool desktopLyricsLocked;
  final double desktopLyricsScale;
  final int? desktopLyricsX;
  final int? desktopLyricsY;
  final int? desktopLyricsWidth;
  final int? desktopLyricsHeight;
  final String musicCollectionMode;
  final String musicSourceProvider;
  final String playbackFallbackChain;
  final int searchCacheTtlHours;
  // Hot-reloaded older AppSettings instances may not have this field yet.
  final bool? miniPlayerAlwaysOnTopState;
  final bool autoCacheOnPlay;
  final bool shareNeteaseCookieEnabled;
  final String shareNeteaseCookie;

  bool get miniPlayerAlwaysOnTop => miniPlayerAlwaysOnTopState ?? false;

  Map<String, dynamic> toPatchJson({bool includePlaybackState = false}) {
    final patch = <String, dynamic>{
      'volume': volume,
      'play_mode': playMode,
      'download_folder': downloadFolder,
      'last_library_folder': lastLibraryFolder,
      'network_proxy_mode': networkProxyMode,
      'network_proxy_url': networkProxyUrl,
      'lyrics_netease_api_base': lyricsNeteaseApiBase,
      'lyrics_provider_order': lyricsProviderOrder,
      'main_window_close_action': mainWindowCloseAction,
      'app_theme': appTheme,
      'app_theme_mode': appThemeMode,
      'app_theme_custom_accent': appThemeCustomAccent,
      'desktop_lyrics_color_base': desktopLyricsColorBase,
      'desktop_lyrics_color_highlight': desktopLyricsColorHighlight,
      'desktop_lyrics_idle_line1': desktopLyricsIdleLine1,
      'desktop_lyrics_idle_line2': desktopLyricsIdleLine2,
      'desktop_lyrics_visible': desktopLyricsVisible,
      'desktop_lyrics_locked': desktopLyricsLocked,
      'desktop_lyrics_scale': desktopLyricsScale,
      'desktop_lyrics_x': desktopLyricsX,
      'desktop_lyrics_y': desktopLyricsY,
      'desktop_lyrics_width': desktopLyricsWidth,
      'desktop_lyrics_height': desktopLyricsHeight,
      'music_collection_mode': musicCollectionMode,
      'music_source_provider': musicSourceProvider,
      'playback_fallback_chain': playbackFallbackChain,
      'search_cache_ttl_hours': searchCacheTtlHours,
      'mini_player_always_on_top': miniPlayerAlwaysOnTop,
      'auto_cache_on_play': autoCacheOnPlay,
      'share_netease_cookie_enabled': shareNeteaseCookieEnabled,
      'share_netease_cookie': shareNeteaseCookie,
    };
    if (includePlaybackState) {
      patch.addAll(<String, dynamic>{
        'play_queue': playQueue
            .map((track) => track.toPlaybackQueueJson())
            .toList(growable: false),
        'play_queue_index': playQueueIndex,
        'playback_position_ms': playbackPositionMs,
        'playback_duration_ms': playbackDurationMs,
        'playback_track_key': playbackTrackKey,
      });
    }
    return patch;
  }

  AppSettings copyWith({
    double? volume,
    String? playMode,
    List<TrackRow>? playQueue,
    int? playQueueIndex,
    int? playbackPositionMs,
    int? playbackDurationMs,
    String? playbackTrackKey,
    String? downloadFolder,
    String? lastLibraryFolder,
    String? networkProxyMode,
    String? networkProxyUrl,
    String? lyricsNeteaseApiBase,
    String? lyricsProviderOrder,
    String? mainWindowCloseAction,
    String? appTheme,
    String? appThemeMode,
    String? appThemeCustomAccent,
    String? desktopLyricsColorBase,
    String? desktopLyricsColorHighlight,
    String? desktopLyricsIdleLine1,
    String? desktopLyricsIdleLine2,
    bool? desktopLyricsVisible,
    bool? desktopLyricsLocked,
    double? desktopLyricsScale,
    int? desktopLyricsX,
    int? desktopLyricsY,
    int? desktopLyricsWidth,
    int? desktopLyricsHeight,
    String? musicCollectionMode,
    String? musicSourceProvider,
    String? playbackFallbackChain,
    int? searchCacheTtlHours,
    bool? miniPlayerAlwaysOnTop,
    bool? autoCacheOnPlay,
    bool? shareNeteaseCookieEnabled,
    String? shareNeteaseCookie,
  }) {
    return AppSettings(
      volume: volume ?? this.volume,
      playMode: playMode ?? this.playMode,
      playQueue: playQueue ?? this.playQueue,
      playQueueIndex: playQueueIndex ?? this.playQueueIndex,
      playbackPositionMs: playbackPositionMs ?? this.playbackPositionMs,
      playbackDurationMs: playbackDurationMs ?? this.playbackDurationMs,
      playbackTrackKey: playbackTrackKey ?? this.playbackTrackKey,
      downloadFolder: downloadFolder ?? this.downloadFolder,
      lastLibraryFolder: lastLibraryFolder ?? this.lastLibraryFolder,
      networkProxyMode: networkProxyMode ?? this.networkProxyMode,
      networkProxyUrl: networkProxyUrl ?? this.networkProxyUrl,
      lyricsNeteaseApiBase: lyricsNeteaseApiBase ?? this.lyricsNeteaseApiBase,
      lyricsProviderOrder: lyricsProviderOrder ?? this.lyricsProviderOrder,
      mainWindowCloseAction:
          mainWindowCloseAction ?? this.mainWindowCloseAction,
      appTheme: appTheme ?? this.appTheme,
      appThemeMode: appThemeMode ?? this.appThemeMode,
      appThemeCustomAccent: appThemeCustomAccent ?? this.appThemeCustomAccent,
      desktopLyricsColorBase:
          desktopLyricsColorBase ?? this.desktopLyricsColorBase,
      desktopLyricsColorHighlight:
          desktopLyricsColorHighlight ?? this.desktopLyricsColorHighlight,
      desktopLyricsIdleLine1:
          desktopLyricsIdleLine1 ?? this.desktopLyricsIdleLine1,
      desktopLyricsIdleLine2:
          desktopLyricsIdleLine2 ?? this.desktopLyricsIdleLine2,
      desktopLyricsVisible: desktopLyricsVisible ?? this.desktopLyricsVisible,
      desktopLyricsLocked: desktopLyricsLocked ?? this.desktopLyricsLocked,
      desktopLyricsScale: desktopLyricsScale ?? this.desktopLyricsScale,
      desktopLyricsX: desktopLyricsX ?? this.desktopLyricsX,
      desktopLyricsY: desktopLyricsY ?? this.desktopLyricsY,
      desktopLyricsWidth: desktopLyricsWidth ?? this.desktopLyricsWidth,
      desktopLyricsHeight: desktopLyricsHeight ?? this.desktopLyricsHeight,
      musicCollectionMode: musicCollectionMode ?? this.musicCollectionMode,
      musicSourceProvider: musicSourceProvider ?? this.musicSourceProvider,
      playbackFallbackChain:
          playbackFallbackChain ?? this.playbackFallbackChain,
      searchCacheTtlHours: searchCacheTtlHours ?? this.searchCacheTtlHours,
      miniPlayerAlwaysOnTopState:
          miniPlayerAlwaysOnTop ?? this.miniPlayerAlwaysOnTop,
      autoCacheOnPlay: autoCacheOnPlay ?? this.autoCacheOnPlay,
      shareNeteaseCookieEnabled:
          shareNeteaseCookieEnabled ?? this.shareNeteaseCookieEnabled,
      shareNeteaseCookie: shareNeteaseCookie ?? this.shareNeteaseCookie,
    );
  }
}
