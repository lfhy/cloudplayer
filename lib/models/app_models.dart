// Shared model exports keep page imports stable while the concrete model types stay split by responsibility.

export 'app_settings.dart';
export 'kugou_models.dart';
export 'library_models.dart';
export 'lyrics_models.dart';
export 'playback_models.dart';
export 'model_utils.dart';

enum AppPage {
  home,
  search,
  daily,
  recent,
  playlist,
  download,
  import,
  settings,
}

enum SearchScope { catalog, playlists }
