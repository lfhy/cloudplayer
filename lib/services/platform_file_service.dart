// Shared file dialog helpers keep desktop pickers native while providing
// Android-safe export fallbacks that do not depend on unstable plugins.
import 'dart:io';

import 'package:file_selector/file_selector.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';

class ExportPathSelection {
  const ExportPathSelection({
    required this.path,
    required this.usedFallbackPath,
  });

  final String path;
  final bool usedFallbackPath;
}

Future<String?> pickDirectoryPath({String? confirmButtonText}) {
  return getDirectoryPath(confirmButtonText: confirmButtonText);
}

Future<ExportPathSelection?> selectExportPath({
  required String suggestedName,
}) async {
  if (_supportsNativeSaveDialog) {
    final location = await getSaveLocation(
      suggestedName: _sanitizeFileName(suggestedName),
      confirmButtonText: '导出',
    );
    final selectedPath = location?.path ?? '';
    if (selectedPath.isEmpty) {
      return null;
    }
    return ExportPathSelection(path: selectedPath, usedFallbackPath: false);
  }
  final exportDirectory = await _resolveFallbackExportDirectory();
  await exportDirectory.create(recursive: true);
  final filePath = await _buildUniquePath(
    exportDirectory.path,
    _sanitizeFileName(suggestedName),
  );
  return ExportPathSelection(path: filePath, usedFallbackPath: true);
}

bool get _supportsNativeSaveDialog =>
    Platform.isMacOS || Platform.isWindows || Platform.isLinux;

Future<Directory> _resolveFallbackExportDirectory() async {
  if (Platform.isAndroid) {
    final externalDirectory = await getExternalStorageDirectory();
    if (externalDirectory != null) {
      return Directory(path.join(externalDirectory.path, 'exports'));
    }
  }
  final documentsDirectory = await getApplicationDocumentsDirectory();
  return Directory(path.join(documentsDirectory.path, 'exports'));
}

Future<String> _buildUniquePath(String directoryPath, String fileName) async {
  final extension = path.extension(fileName);
  final baseName = path.basenameWithoutExtension(fileName);
  var candidatePath = path.join(directoryPath, fileName);
  var suffix = 1;
  while (await File(candidatePath).exists()) {
    candidatePath = path.join(directoryPath, '$baseName-$suffix$extension');
    suffix += 1;
  }
  return candidatePath;
}

String _sanitizeFileName(String name) {
  final sanitized = name.trim().replaceAll(RegExp(r'[\\/:*?"<>|]+'), '_');
  return sanitized.isEmpty ? 'cloudplayer-export.txt' : sanitized;
}
