// Platform environment helpers keep desktop-only bootstrapping away from
// mobile targets so unsupported host integrations do not run on Android.

import 'dart:io';

bool get isDesktopHost =>
    Platform.isMacOS || Platform.isWindows || Platform.isLinux;

bool get isMobileHost => Platform.isAndroid || Platform.isIOS;

bool get isAndroidHost => Platform.isAndroid;
