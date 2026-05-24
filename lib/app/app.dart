// The root app binds theme, controller, and shell together without leaking setup details into main.dart.

import 'dart:async';
import 'dart:io';

import 'package:cloudplayer_flutter/services/macos_tray_channel.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/child_window_dialog.dart';
import 'package:cloudplayer_flutter/widgets/app_shell.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';
import 'package:window_manager/window_manager.dart';

class CloudPlayerApp extends StatefulWidget {
  const CloudPlayerApp({super.key});

  @override
  State<CloudPlayerApp> createState() => _CloudPlayerAppState();
}

class _CloudPlayerAppState extends State<CloudPlayerApp> with WindowListener {
  bool _handlingClose = false;
  final GlobalKey<NavigatorState> _rootNavigatorKey =
      GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    windowManager.addListener(this);
    unawaited(windowManager.setPreventClose(true));
  }

  @override
  void dispose() {
    windowManager.removeListener(this);
    super.dispose();
  }

  @override
  void onWindowClose() {
    unawaited(_handleWindowClose());
  }

  Future<void> _handleWindowClose() async {
    if (_handlingClose || !mounted) return;
    _handlingClose = true;
    final controller = context.read<AppController>();
    final dialogContext = _rootNavigatorKey.currentContext;
    final action = controller.settings?.mainWindowCloseAction ?? 'ask';
    try {
      if (action == 'quit') {
        await _quitApplication();
        return;
      }
      if (action == 'tray') {
        await _hideMainWindowForTray();
        return;
      }
      if (dialogContext == null) {
        await _quitApplication();
        return;
      }
      final choice = await showMainWindowCloseDialog(
        context: dialogContext,
        palette: paletteForSettings(controller.settings),
      );
      if (!mounted) return;
      if (choice == MainWindowCloseChoice.quit) {
        await _quitApplication();
      } else if (choice == MainWindowCloseChoice.tray) {
        await _hideMainWindowForTray();
      }
    } finally {
      _handlingClose = false;
    }
  }

  Future<void> _hideMainWindowForTray() async {
    if (Platform.isMacOS) {
      await MacosTrayChannel.instance.hideMainWindow();
      return;
    }
    await windowManager.minimize();
  }

  Future<void> _quitApplication() async {
    final wasPreventingClose = await windowManager.isPreventClose();
    try {
      if (wasPreventingClose) {
        await windowManager.setPreventClose(false);
      }
      if (Platform.isMacOS) {
        await MacosTrayChannel.instance.terminateApp();
        return;
      }
      await windowManager.destroy();
    } catch (error) {
      if (wasPreventingClose) {
        await windowManager.setPreventClose(true);
      }
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppController>(
      builder: (context, controller, _) {
        final palette = paletteForSettings(controller.settings);
        return FluentApp(
          title: 'CloudPlayer',
          debugShowCheckedModeBanner: false,
          navigatorKey: _rootNavigatorKey,
          theme: buildThemeData(controller.settings),
          home: AppShell(palette: palette),
        );
      },
    );
  }
}
