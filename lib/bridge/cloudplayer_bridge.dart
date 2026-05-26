// FFI bridge loading and invocation stay isolated so the rest of the app can remain Dart-first.

import 'dart:convert';
import 'dart:ffi';
import 'dart:io';

import 'package:ffi/ffi.dart';
import 'package:path/path.dart' as path;

typedef _NativeInvoke = Pointer<Utf8> Function(Pointer<Utf8>, Pointer<Utf8>);
typedef _DartInvoke = Pointer<Utf8> Function(Pointer<Utf8>, Pointer<Utf8>);
typedef _NativeFree = Void Function(Pointer<Utf8>);
typedef _DartFree = void Function(Pointer<Utf8>);

class CloudPlayerBridgeException implements Exception {
  CloudPlayerBridgeException(this.message);

  final String message;

  @override
  String toString() => 'CloudPlayerBridgeException: $message';
}

class CloudPlayerBridge {
  CloudPlayerBridge._(DynamicLibrary library, this._libraryPath)
    : _invoke = library.lookupFunction<_NativeInvoke, _DartInvoke>(
        'CloudPlayerInvoke',
      ),
      _free = library.lookupFunction<_NativeFree, _DartFree>(
        'CloudPlayerFreeString',
      );

  static Future<CloudPlayerBridge> connect() async {
    final bundledPath = _bundledLibraryPath();
    if (bundledPath != null) {
      return _openBridge(bundledPath);
    }
    final repoRoot = _locateRepoRoot();
    if (repoRoot == null) {
      throw CloudPlayerBridgeException(
        'Could not locate a bundled bridge library or the repository root.',
      );
    }
    final libraryPath = path.join(
      repoRoot.path,
      'bin',
      'bridge',
      _bridgeLibraryFileName(),
    );
    final libraryFile = File(libraryPath);
    if (!await libraryFile.exists() ||
        await _needsBridgeRebuild(repoRoot, libraryFile)) {
      await _buildBridge(repoRoot, libraryPath);
    }
    return _openBridge(libraryPath);
  }

  static CloudPlayerBridge _openBridge(String libraryPath) {
    DynamicLibrary library;
    try {
      library = DynamicLibrary.open(libraryPath);
    } on ArgumentError catch (error) {
      throw CloudPlayerBridgeException(
        'Failed to load bridge library at $libraryPath.\n$error',
      );
    } on UnsupportedError catch (error) {
      throw CloudPlayerBridgeException(
        'Bridge library is not supported on this Windows setup.\n$error',
      );
    }
    final bridge = CloudPlayerBridge._(library, libraryPath);
    bridge._initializeRuntime();
    final runtimeInfo =
        bridge.call('get_runtime_info') as Map<String, dynamic>?;
    bridge._mediaProxyBase =
        runtimeInfo?['media_proxy_base']?.toString().trim() ?? '';
    return bridge;
  }

  final String _libraryPath;
  final _DartInvoke _invoke;
  final _DartFree _free;
  String _mediaProxyBase = '';

  static String? mobileConfigDirPath;

  String get libraryPath => _libraryPath;
  String get mediaProxyBase => _mediaProxyBase;

  void _initializeRuntime() {
    if (!Platform.isAndroid && !Platform.isIOS) {
      return;
    }
    final configDir = mobileConfigDirPath?.trim() ?? '';
    if (configDir.isEmpty) {
      throw CloudPlayerBridgeException(
        'Could not resolve an application support directory for the mobile bridge.',
      );
    }
    call('initialize_runtime', <String, dynamic>{'config_dir': configDir});
  }

  dynamic call(String method, [Object? args]) {
    final methodPtr = method.toNativeUtf8();
    final argsPtr = jsonEncode(
      args ?? const <String, dynamic>{},
    ).toNativeUtf8();
    try {
      final responsePtr = _invoke(methodPtr, argsPtr);
      try {
        final responseText = responsePtr.toDartString();
        final payload = jsonDecode(responseText) as Map<String, dynamic>;
        if (payload['ok'] != true) {
          final error =
              payload['error'] as Map<String, dynamic>? ??
              const <String, dynamic>{};
          throw CloudPlayerBridgeException(
            error['message']?.toString() ?? 'Bridge call failed.',
          );
        }
        return payload['result'];
      } finally {
        _free(responsePtr);
      }
    } finally {
      malloc.free(methodPtr);
      malloc.free(argsPtr);
    }
  }

  static Directory? _locateRepoRoot() {
    final candidates = <Directory>[
      Directory.current.absolute,
      File(Platform.resolvedExecutable).absolute.parent,
    ];
    final scriptPath = Uri.tryParse(Platform.script.toString());
    if (scriptPath != null && scriptPath.scheme == 'file') {
      candidates.add(File(scriptPath.toFilePath()).absolute.parent);
    }
    for (final candidate in candidates) {
      final found = _searchRepoRoot(candidate);
      if (found != null) {
        return found;
      }
    }
    return null;
  }

  static String? _bundledLibraryPath() {
    if (Platform.isAndroid) {
      return _bridgeLibraryFileName();
    }
    final executableDir = File(
      Platform.resolvedExecutable,
    ).absolute.parent.path;
    final fileName = _bridgeLibraryFileName();
    final candidates = <String>[
      path.join(executableDir, fileName),
      path.join(executableDir, 'data', fileName),
    ];
    if (Platform.isMacOS) {
      candidates.add(path.join(executableDir, '..', 'Frameworks', fileName));
    }
    for (final candidate in candidates) {
      if (File(candidate).existsSync()) {
        return candidate;
      }
    }
    return null;
  }

  static String _bridgeLibraryFileName() {
    if (Platform.isWindows) {
      return 'cloudplayer_bridge.dll';
    }
    if (Platform.isMacOS) {
      return 'libcloudplayer_bridge.dylib';
    }
    if (Platform.isAndroid) {
      return 'libcloudplayer_bridge.so';
    }
    if (Platform.isLinux) {
      return 'libcloudplayer_bridge.so';
    }
    throw CloudPlayerBridgeException(
      'Unsupported platform for CloudPlayer bridge: ${Platform.operatingSystem}',
    );
  }

  static Directory? _searchRepoRoot(Directory start) {
    var current = start.absolute;
    while (true) {
      final hasGoModule = File(path.join(current.path, 'go.mod')).existsSync();
      final hasBridgeDir = Directory(
        path.join(current.path, 'bridge'),
      ).existsSync();
      if (hasGoModule && hasBridgeDir) {
        return current;
      }
      final parent = current.parent;
      if (parent.path == current.path) {
        return null;
      }
      current = parent;
    }
  }

  static Future<void> _buildBridge(
    Directory repoRoot,
    String outputPath,
  ) async {
    await Directory(path.dirname(outputPath)).create(recursive: true);
    final result = await Process.run('go', <String>[
      'build',
      '-buildmode=c-shared',
      '-o',
      outputPath,
      './bridge',
    ], workingDirectory: repoRoot.path);
    if (result.exitCode != 0) {
      final stderr = result.stderr.toString().trim();
      final stdout = result.stdout.toString().trim();
      throw CloudPlayerBridgeException(
        'Go bridge build failed.\n${stderr.isNotEmpty ? stderr : stdout}',
      );
    }
  }

  static Future<bool> _needsBridgeRebuild(
    Directory repoRoot,
    File libraryFile,
  ) async {
    final libraryStat = await libraryFile.stat();
    for (final sourcePath in <String>[
      path.join(repoRoot.path, 'go.mod'),
      path.join(repoRoot.path, 'go.sum'),
    ]) {
      final sourceFile = File(sourcePath);
      if (await sourceFile.exists()) {
        final sourceStat = await sourceFile.stat();
        if (sourceStat.modified.isAfter(libraryStat.modified)) {
          return true;
        }
      }
    }
    for (final dirName in <String>['bridge', 'backend']) {
      final sourceDir = Directory(path.join(repoRoot.path, dirName));
      if (!await sourceDir.exists()) continue;
      await for (final entity in sourceDir.list(
        recursive: true,
        followLinks: false,
      )) {
        if (entity is! File || !entity.path.endsWith('.go')) continue;
        final sourceStat = await entity.stat();
        if (sourceStat.modified.isAfter(libraryStat.modified)) {
          return true;
        }
      }
    }
    return false;
  }
}
