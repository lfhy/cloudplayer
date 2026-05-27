// Main bootstraps the Go bridge, media runtime, and desktop window host before showing the Fluent shell.

import 'dart:async';
import 'dart:io';

import 'package:cloudplayer_flutter/app/app.dart';
import 'package:cloudplayer_flutter/bridge/cloudplayer_api.dart';
import 'package:cloudplayer_flutter/bridge/cloudplayer_bridge.dart';
import 'package:cloudplayer_flutter/services/cloudplayer_audio_session.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/utils/platform_environment.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:media_kit/media_kit.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:window_manager/window_manager.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  MediaKit.ensureInitialized();
  if (isDesktopHost) {
    await windowManager.ensureInitialized();
  }
  if (Platform.isAndroid || Platform.isIOS) {
    final supportDir = await getApplicationSupportDirectory();
    CloudPlayerBridge.mobileConfigDirPath = supportDir.path;
  }
  await CloudPlayerAudioSession.instance.initialize();
  final api = await CloudPlayerApi.bootstrap();
  final controller = AppController(api, CloudPlayerAudioSession.instance);
  unawaited(controller.initialize());

  if (isDesktopHost) {
    await windowManager.waitUntilReadyToShow(
      WindowOptions(
        size: Size(1100, 700),
        minimumSize: Size(1000, 680),
        center: true,
        title: 'CloudPlayer',
        backgroundColor: Color(0x00000000),
        // Windows should keep the native title bar so the system close button
        // remains available during Flutter desktop development and release runs.
        titleBarStyle: Platform.isWindows
            ? TitleBarStyle.normal
            : TitleBarStyle.hidden,
        windowButtonVisibility: !Platform.isWindows,
      ),
      () async {
        await windowManager.show();
        await windowManager.focus();
      },
    );
  }

  runApp(
    ChangeNotifierProvider<AppController>.value(
      value: controller,
      child: const CloudPlayerApp(),
    ),
  );
}
