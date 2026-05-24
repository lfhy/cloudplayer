// Bridge smoke test validates that Dart can build, load, and invoke the Go shared library.

import 'dart:convert';
import 'dart:io';

import 'package:cloudplayer_flutter/bridge/cloudplayer_api.dart';

Future<void> main() async {
  final api = await CloudPlayerApi.bootstrap();
  final settings = await api.getSettings();
  final dbStatus = await api.dbStatus();
  final playlists = await api.listPlaylists();
  stdout.writeln(
    jsonEncode(<String, Object?>{
      'libraryPath': api.libraryPath,
      'mediaProxyBase': api.mediaProxyBase,
      'dbStatus': dbStatus,
      'settings': <String, Object?>{
        'appTheme': settings.appTheme,
        'appThemeMode': settings.appThemeMode,
        'musicSourceProvider': settings.musicSourceProvider,
        'musicCollectionMode': settings.musicCollectionMode,
      },
      'playlistCount': playlists.length,
    }),
  );
}
