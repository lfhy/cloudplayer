// The app controller owns bridge-backed data loading, navigation state, and audio playback.
import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:cloudplayer_flutter/bridge/cloudplayer_api.dart';
import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/services/android_system_volume_service.dart';
import 'package:cloudplayer_flutter/services/desktop_lyrics_channel.dart';
import 'package:cloudplayer_flutter/services/desktop_lyrics_projection.dart';
import 'package:cloudplayer_flutter/services/platform_file_service.dart';
import 'package:cloudplayer_flutter/services/macos_tray_channel.dart';
import 'package:cloudplayer_flutter/utils/platform_environment.dart';
import 'package:cloudplayer_flutter/windows/mini_mode_window_controller.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:media_kit/media_kit.dart';

part 'app_controller_desktop_lyrics.dart';
part 'app_controller_android_volume.dart';
part 'app_controller_core.dart';
part 'app_controller_mini_mode.dart';
part 'app_controller_navigation.dart';
part 'app_controller_playback.dart';
part 'app_controller_playlist_ops.dart';
part 'app_controller_search.dart';
part 'app_controller_favorites_sync.dart';
part 'app_controller_theme.dart';
part 'app_controller_tray.dart';
part 'app_controller_lyrics.dart';

class AppController extends ChangeNotifier {
  AppController(this.api) : _player = Player();

  final CloudPlayerApi api;
  final Player _player;

  bool booting = true;
  bool busy = false;
  String statusMessage = '';
  String bootError = '';
  AppPage currentPage = AppPage.home;
  SearchScope searchScope = SearchScope.catalog;
  AppSettings? settings;
  PlaylistRow? selectedPlaylist;
  DailyRecommendation? dailyRecommendation;
  SearchCatalogResponse? searchResponse;
  List<PlaylistSearchResult> playlistSearchResults = <PlaylistSearchResult>[];
  LyricsPayloadData? lyricsPayload;
  List<PlaylistRow> playlists = <PlaylistRow>[];
  List<TrackRow> playlistTracks = <TrackRow>[];
  List<TrackRow> recentTracks = <TrackRow>[];
  List<TrackRow> localSongs = <TrackRow>[];
  List<TrackRow> importTracks = <TrackRow>[];
  List<LyricEntry> lyricsEntries = <LyricEntry>[];
  List<TrackRow> playQueue = <TrackRow>[];
  List<TrackRow> downloadQueue = <TrackRow>[];
  Set<String> favoriteIds = <String>{};
  String searchKeyword = '';
  String importSuggestedName = '';
  String selectedImportMethod = 'text';
  String bridgeLibraryPath = '';
  String lyricsTrackKey = '';
  String lyricsError = '';
  int playIndex = -1;
  bool isPlaying = false;
  bool immersiveOpen = false;
  bool immersiveLyricsVisible = false;
  bool lyricsBusy = false;
  Duration position = Duration.zero;
  Duration duration = Duration.zero;
  double _lastNonZeroVolume = 0.7;
  int _androidSystemVolume = 0;
  int _androidSystemVolumeMax = 15;
  StreamSubscription<AndroidSystemVolumeSnapshot>? _androidSystemVolumeSub;
  bool _desktopLyricsBound = false;
  Timer? _desktopLyricsSyncTimer;
  Timer? _desktopLyricsPersistTimer;
  bool _favoritesPlaylistRefreshInFlight = false;
  int _favoritesPlaylistRefreshPlaylistId = -1;
  bool _restoringPlaybackSnapshot = false;
  String _lastPersistedPlaybackTrackKey = '';
  int _lastPersistedPlaybackSecond = -1;
  int _lastPersistedPlaybackDurationMs = -1;
  int _lastPersistedPlaybackQueueIndex = -1;
  int _lastPersistedPlaybackQueueLength = -1;

  TrackRow? get currentTrack => playIndex >= 0 && playIndex < playQueue.length
      ? playQueue[playIndex]
      : null;

  Future<void> initialize() async {
    _wirePlayer();
    try {
      settings = await api.getSettings();
      bridgeLibraryPath = api.libraryPath;
      await _player.setVolume(
        usesPlatformSystemVolume ? 100 : (settings?.volume ?? 0.7) * 100,
      );
      if (usesPlatformSystemVolume) {
        await _bindAndroidSystemVolume();
      }
      await refreshAll();
      _syncFavoritesPlaylistAutoRefresh();
      await restorePersistedPlayback();
      if (isDesktopHost) {
        await bindDesktopLyrics();
        await bindTray();
        await syncDesktopLyricsWindow(immediate: true);
        await syncTrayState();
      }
      bootError = '';
    } catch (error) {
      bootError = error.toString();
    } finally {
      booting = false;
      notifyListeners();
    }
  }

  Future<void> refreshAll() async {
    await Future.wait(<Future<void>>[
      refreshPlaylists(),
      refreshFavorites(),
      refreshRecent(),
      refreshDaily(),
      refreshLocalSongs(),
    ]);
  }

  Future<void> refreshPlaylists() async {
    playlists = await api.listPlaylists();
    if (playlists.isNotEmpty) {
      selectedPlaylist ??= playlists.first;
      final stillExists = playlists.any(
        (playlist) => playlist.id == selectedPlaylist?.id,
      );
      if (!stillExists) {
        selectedPlaylist = playlists.first;
      }
      if (currentPage == AppPage.playlist) {
        await loadSelectedPlaylist();
      }
    } else {
      selectedPlaylist = null;
      playlistTracks = <TrackRow>[];
    }
    _syncFavoritesPlaylistAutoRefresh();
    notifyListeners();
  }

  Future<void> refreshFavorites() async {
    favoriteIds = (await api.listFavoriteSourceIds()).toSet();
    notifyListeners();
  }

  Future<void> refreshRecent() async {
    recentTracks = await api.listRecentPlays();
    notifyListeners();
  }

  Future<void> refreshDaily({bool force = false}) async {
    dailyRecommendation = await api.getDailyRecommendation(force: force);
    notifyListeners();
  }

  Future<void> refreshLocalSongs() async {
    localSongs = await api.listLocalSongs();
    notifyListeners();
  }

  Future<void> loadSelectedPlaylist() async {
    final playlist = selectedPlaylist;
    if (playlist == null) {
      playlistTracks = <TrackRow>[];
      notifyListeners();
      return;
    }
    playlistTracks = await api.listPlaylistImportItems(playlist.id);
    _syncFavoritesPlaylistAutoRefresh();
    notifyListeners();
  }

  Future<void> setPage(AppPage page) async {
    currentPage = page;
    if (page == AppPage.playlist) {
      await loadSelectedPlaylist();
    }
    _syncFavoritesPlaylistAutoRefresh();
    notifyListeners();
  }

  Future<void> selectPlaylist(PlaylistRow playlist) async {
    selectedPlaylist = playlist;
    await setPage(AppPage.playlist);
  }

  Future<void> performSearch(String keyword) async {
    searchKeyword = keyword.trim();
    if (searchKeyword.isEmpty) {
      searchResponse = null;
      playlistSearchResults = <PlaylistSearchResult>[];
      busy = false;
      notifyListeners();
      return;
    }
    busy = true;
    notifyListeners();
    try {
      if (searchScope == SearchScope.playlists) {
        searchResponse = null;
        playlistSearchResults = await _searchLocalPlaylists(searchKeyword);
      } else {
        playlistSearchResults = <PlaylistSearchResult>[];
        searchResponse = await api.searchSongs(searchKeyword);
      }
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void setSearchScope(SearchScope scope) {
    searchScope = scope;
    notifyListeners();
  }

  void setImportMethod(String method) {
    selectedImportMethod = method;
    notifyListeners();
  }

  Future<void> toggleFavorite(TrackRow track) async {
    if (track.sourceId.isEmpty) return;
    if (favoriteIds.contains(track.sourceId)) {
      await api.removeFavoriteTrack(track.sourceId);
      favoriteIds.remove(track.sourceId);
    } else {
      await api.addFavoriteTrack(track);
      favoriteIds.add(track.sourceId);
    }
    _refreshFavoritesPlaylistAfterFavoriteMutation();
    notifyListeners();
  }

  Future<void> enqueueDownload(TrackRow track, {String quality = '128'}) async {
    if (track.sourceId.isEmpty) {
      statusMessage = '本地文件不需要加入下载队列。';
      notifyListeners();
      return;
    }
    await api.enqueueDownload(track, quality: quality);
    final alreadyQueued = downloadQueue.any(
      (item) => item.sourceId == track.sourceId && item.title == track.title,
    );
    if (!alreadyQueued) {
      downloadQueue = <TrackRow>[track, ...downloadQueue];
    }
    statusMessage = '已把 ${track.title} 加入下载队列。';
    notifyListeners();
  }

  Future<void> updateSettings(AppSettings next) async {
    final shouldRefreshTrayTheme =
        settings?.appThemeMode != next.appThemeMode && Platform.isMacOS;
    settings = next;
    notifyListeners();
    if (!usesPlatformSystemVolume) {
      await _player.setVolume(next.volume * 100);
    }
    await syncDesktopLyricsWindow(immediate: true);
    await api.saveSettings(next);
    if (shouldRefreshTrayTheme) {
      await syncTrayState();
    }
    statusMessage = '偏好设置已保存。';
    notifyListeners();
  }

  Future<void> clearRecentPlays() async {
    await api.clearRecentPlays();
    await refreshRecent();
    statusMessage = '最近播放已清空。';
    notifyListeners();
  }

  Future<void> parseImportText(String text, String format) async {
    final tracks = await api.parseImportText(text, format);
    _applyImportDraft(tracks, suggestedName: '导入歌单', method: 'text');
  }

  Future<void> importFromShareUrl(String rawUrl) async {
    final shared = await api.fetchSharePlaylist(rawUrl);
    _applyImportDraft(
      shared.tracks,
      suggestedName: shared.playlistName,
      method: 'share',
    );
  }

  Future<void> importFromFolder() async {
    final selectedPath = await pickDirectoryPath(confirmButtonText: '选择目录');
    if (selectedPath == null || selectedPath.isEmpty) return;
    final result = await api.scanMusicFolder(selectedPath);
    await refreshLocalSongs();
    _applyImportDraft(localSongs, suggestedName: '本地音乐导入', method: 'local');
    statusMessage =
        '已扫描 ${result.audioFilesSeen} 个音频文件，写入 ${result.rowsWritten} 条本地记录。';
    notifyListeners();
  }

  Future<void> importKugouPlaylists(List<int> listIds) async {
    final result = await api.syncKugouPlaylists(listIds);
    _applyImportDraft(
      result.tracks,
      suggestedName: result.playlistName,
      method: 'kugou',
    );
    statusMessage = '已从酷狗导入 ${result.tracks.length} 首歌曲，请确认名称后保存。';
    notifyListeners();
  }

  Future<void> saveImportAsNewPlaylist(String playlistName) async {
    final trimmed = playlistName.trim().isEmpty
        ? importSuggestedName
        : playlistName.trim();
    final playlistId = await api.createPlaylist(
      trimmed.isEmpty ? '导入歌单' : trimmed,
    );
    await api.replacePlaylistItems(playlistId, importTracks);
    await refreshPlaylists();
    final playlist = playlists
        .where((item) => item.id == playlistId)
        .firstOrNull;
    if (playlist != null) {
      selectedPlaylist = playlist;
      await setPage(AppPage.playlist);
    }
    statusMessage = '已保存为新歌单。';
    notifyListeners();
  }

  Future<void> saveDailyAsPlaylist() async {
    final rows = dailyRecommendation?.rows ?? <TrackRow>[];
    if (rows.isEmpty) return;
    _applyImportDraft(
      rows.reversed.toList(growable: false),
      suggestedName: '每日推荐 ${dailyRecommendation?.date ?? ''}'.trim(),
      method: 'daily',
    );
    await saveImportAsNewPlaylist(importSuggestedName);
  }

  Future<void> mergeImportIntoPlaylist(int playlistId) async {
    if (importTracks.isEmpty) return;
    await api.appendPlaylistItems(playlistId, importTracks);
    await refreshPlaylists();
    final playlist = playlists
        .where((item) => item.id == playlistId)
        .firstOrNull;
    if (playlist != null) {
      selectedPlaylist = playlist;
      await setPage(AppPage.playlist);
    }
    statusMessage = '已合并到已有歌单。';
    notifyListeners();
  }

  Future<void> renameCurrentPlaylist(String nextName) async {
    final playlist = selectedPlaylist;
    if (playlist == null) return;
    await api.renamePlaylist(playlist.id, nextName);
    await refreshPlaylists();
    statusMessage = '歌单已重命名。';
    notifyListeners();
  }

  Future<void> clearSearchCache() async {
    final count = await api.clearSearchCache();
    statusMessage = '已清理 $count 条搜索缓存。';
    notifyListeners();
  }

  Future<void> changeMusicCollectionMode(String nextMode) async {
    final current = settings;
    if (current == null) return;
    final normalized = nextMode.trim().isEmpty ? 'offline' : nextMode.trim();
    if (normalized == current.musicCollectionMode) return;
    final updated = current.copyWith(musicCollectionMode: normalized);
    settings = updated;
    notifyListeners();
    await api.saveSettings(updated);
    await refreshPlaylists();
    statusMessage = switch (normalized) {
      'online' => '在线模式已开启：歌单会直接同步酷狗云端。',
      'hybrid' => '混合模式已开启：会优先回写云端，失败时保留本地。',
      _ => '离线模式已开启：当前只使用本地歌单。',
    };
    notifyListeners();
  }

  Future<Map<String, dynamic>> repairDatabase() async {
    final result = await api.repairMusicCollectionDatabase();
    settings = await api.getSettings();
    statusMessage = prettyJson(result);
    notifyListeners();
    await refreshPlaylists();
    return result;
  }

  Future<void> enrichCurrentPlaylist() async {
    final playlist = selectedPlaylist;
    if (playlist == null) return;
    await api.startImportEnrich(playlist.id);
    statusMessage = '已开始后台补全播放信息。';
    notifyListeners();
  }

  Future<void> pickDownloadFolder() async {
    final selectedPath = await pickDirectoryPath(confirmButtonText: '选择目录');
    if (selectedPath == null || selectedPath.isEmpty) return;
    final current = settings;
    if (current == null) return;
    await updateSettings(current.copyWith(downloadFolder: selectedPath));
  }

  void clearStatus() {
    if (statusMessage.isEmpty) return;
    statusMessage = '';
    _notifyStateChanged();
  }

  // Playback helpers use this wrapper so extension members do not call the
  // protected notifier API directly.
  void _notifyStateChanged() {
    notifyListeners();
  }

  @override
  void dispose() {
    _androidSystemVolumeSub?.cancel();
    _desktopLyricsSyncTimer?.cancel();
    _desktopLyricsPersistTimer?.cancel();
    MacosTrayChannel.instance.clearCache();
    _player.dispose();
    super.dispose();
  }
}

extension on Iterable<PlaylistRow> {
  PlaylistRow? get firstOrNull => isEmpty ? null : first;
}
