// Import export helpers keep TXT and CSV serialization separate from the stateful import page widget.

import 'package:cloudplayer_flutter/models/app_models.dart';

String buildImportTextExport(List<TrackRow> tracks) {
  return tracks
      .map((track) => '${track.title} - ${track.artist}'.trim())
      .join('\n');
}

String buildImportCsvExport(List<TrackRow> tracks) {
  final rows = <String>['歌名,歌手,专辑'];
  for (final track in tracks) {
    rows.add(
      <String>[track.title, track.artist, track.album]
          .map((value) => '"${value.replaceAll('"', '""')}"')
          .join(','),
    );
  }
  return rows.join('\n');
}
