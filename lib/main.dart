// Main bootstraps the Go bridge, media runtime, and desktop window host before showing the Fluent shell.

import 'dart:async';

import 'package:cloudplayer_flutter/app/app.dart';
import 'package:cloudplayer_flutter/bridge/cloudplayer_api.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:media_kit/media_kit.dart';
import 'package:provider/provider.dart';
import 'package:window_manager/window_manager.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  MediaKit.ensureInitialized();
  await windowManager.ensureInitialized();

  final api = await CloudPlayerApi.bootstrap();
  final controller = AppController(api);
  unawaited(controller.initialize());

  await windowManager.waitUntilReadyToShow(
    const WindowOptions(
      size: Size(1100, 700),
      minimumSize: Size(1000, 680),
      center: true,
      title: 'CloudPlayer',
      backgroundColor: Color(0x00000000),
      titleBarStyle: TitleBarStyle.hidden,
      windowButtonVisibility: true,
    ),
    () async {
      await windowManager.show();
      await windowManager.focus();
    },
  );

  runApp(
    ChangeNotifierProvider<AppController>.value(
      value: controller,
      child: const CloudPlayerApp(),
    ),
  );
}
