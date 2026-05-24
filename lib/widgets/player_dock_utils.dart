// Dock-specific label and icon helpers stay separate so the main footer widget
// can focus on layout and interaction wiring.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:fluent_ui/fluent_ui.dart';

String dockSubtitleForTrack(TrackRow? track) {
  if (track == null) return '选择曲目或搜索后双击列表';
  final values = <String>[
    track.artist.trim(),
    track.album.trim(),
  ].where((value) => value.isNotEmpty).toList(growable: false);
  if (values.isNotEmpty) {
    return values.join(' · ');
  }
  return track.localPath.trim().isEmpty ? '在线曲目' : '本地音乐';
}

String formatDockDuration(Duration value) {
  final totalSeconds = value.inSeconds;
  final minutes = totalSeconds ~/ 60;
  final seconds = totalSeconds % 60;
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}

IconData dockPlayModeIcon(String mode) {
  return switch (mode) {
    'one' => FluentIcons.repeat_one,
    'shuffle' => WindowsIcons.shuffle,
    _ => FluentIcons.repeat_all,
  };
}

String dockPlayModeTip(String mode) {
  return switch (mode) {
    'one' => '单曲循环',
    'shuffle' => '随机播放',
    _ => '列表循环',
  };
}

String nextDockPlayMode(String mode) {
  return switch (mode) {
    'loop_list' => 'one',
    'one' => 'shuffle',
    _ => 'loop_list',
  };
}

IconData dockVolumeIcon(AppSettings? settings) {
  final volume = settings?.volume ?? 0.7;
  if (volume <= 0.001) return WindowsIcons.mute;
  if (volume < 0.45) return FluentIcons.volume1;
  return FluentIcons.volume3;
}
