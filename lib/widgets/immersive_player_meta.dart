// Immersive meta panel owns the artwork, title, transport, and progress layout for both mobile and desktop playback states.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/immersive_player_chrome.dart';
import 'package:cloudplayer_flutter/widgets/immersive_player_mobile_controls.dart';
import 'package:cloudplayer_flutter/widgets/playback_presence.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:fluent_ui/fluent_ui.dart';

class ImmersiveMetaPanel extends StatelessWidget {
  const ImmersiveMetaPanel({
    super.key,
    required this.palette,
    required this.track,
    required this.onBackToPage,
    required this.isPlaying,
    required this.currentMs,
    required this.totalMs,
    required this.compact,
    required this.showLyricsHint,
    required this.onArtworkPressed,
    required this.onPlayPause,
    required this.onPrevious,
    required this.onNext,
    required this.onSeekStart,
    required this.onSeekChanged,
    required this.onSeekEnd,
    required this.showVolumeControl,
    required this.volume,
    required this.onVolumeChanged,
    required this.onToggleMute,
    required this.playMode,
    required this.onPlayModePressed,
  });

  final AppPalette palette;
  final TrackRow? track;
  final VoidCallback? onBackToPage;
  final bool isPlaying;
  final double currentMs;
  final double totalMs;
  final bool compact;
  final bool showLyricsHint;
  final VoidCallback? onArtworkPressed;
  final Future<void> Function()? onPlayPause;
  final Future<void> Function()? onPrevious;
  final Future<void> Function()? onNext;
  final VoidCallback onSeekStart;
  final ValueChanged<double> onSeekChanged;
  final ValueChanged<double> onSeekEnd;
  final bool showVolumeControl;
  final double volume;
  final ValueChanged<double>? onVolumeChanged;
  final Future<void> Function()? onToggleMute;
  final String playMode;
  final Future<void> Function()? onPlayModePressed;

  @override
  Widget build(BuildContext context) {
    final dense = compact && MediaQuery.sizeOf(context).height < 760;
    if (onBackToPage != null) {
      return _buildMobileLayout(dense);
    }
    return PlaybackPresence(
      playing: isPlaying,
      pausedOpacity: 0.8,
      pausedScale: 0.99,
      pausedOffset: const Offset(-0.012, 0.01),
      duration: const Duration(milliseconds: 320),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          GestureDetector(
            onTap: onArtworkPressed,
            child: TrackArtwork(
              track: track,
              palette: palette,
              size: dense
                  ? 124
                  : compact
                  ? 148
                  : 240,
              radius: dense
                  ? 18
                  : compact
                  ? 20
                  : 24,
              iconSize: dense
                  ? 40
                  : compact
                  ? 44
                  : 76,
            ),
          ),
          SizedBox(
            height: dense
                ? 14
                : compact
                ? 18
                : 24,
          ),
          Text(
            track?.title ?? '未播放',
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: dense
                  ? 16
                  : compact
                  ? 18
                  : 22,
              height: 1.25,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            track == null
                ? '选择曲目开始播放'
                : track!.artist.trim().isEmpty
                ? '未知艺术家'
                : track!.artist,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: dense
                  ? 12
                  : compact
                  ? 13
                  : 14,
              color: Colors.white.withValues(alpha: 0.78),
            ),
          ),
          SizedBox(height: dense ? 2 : 4),
          Text(
            showLyricsHint
                ? '点击封面查看歌词'
                : track == null
                ? '在这里查看歌词沉浸模式'
                : track!.album.trim().isEmpty
                ? (track!.localPath.trim().isEmpty ? '正在聆听' : '本地音乐')
                : track!.album,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: dense
                  ? 10
                  : compact
                  ? 11
                  : 12,
              color: Colors.white.withValues(alpha: 0.52),
            ),
          ),
          SizedBox(
            height: dense
                ? 16
                : compact
                ? 20
                : 28,
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              ImmersiveTransportButtonChrome(
                icon: FluentIcons.previous,
                onPressed: onPrevious == null ? null : () => onPrevious!.call(),
              ),
              SizedBox(width: dense ? 14 : 20),
              ImmersiveTransportButtonChrome(
                icon: isPlaying ? FluentIcons.pause : FluentIcons.play,
                onPressed: onPlayPause == null
                    ? null
                    : () => onPlayPause!.call(),
                main: true,
              ),
              SizedBox(width: dense ? 14 : 20),
              ImmersiveTransportButtonChrome(
                icon: FluentIcons.next,
                onPressed: onNext == null ? null : () => onNext!.call(),
              ),
            ],
          ),
          SizedBox(
            height: dense
                ? 14
                : compact
                ? 18
                : 26,
          ),
          _ProgressRow(
            currentMs: currentMs,
            totalMs: totalMs,
            onSeekStart: onSeekStart,
            onSeekChanged: track == null ? null : onSeekChanged,
            onSeekEnd: track == null ? null : onSeekEnd,
          ),
          if (showVolumeControl) ...<Widget>[
            SizedBox(height: dense ? 12 : 16),
            _VolumeRow(
              volume: volume,
              dense: dense,
              onChanged: onVolumeChanged,
              onToggleMute: onToggleMute,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMobileLayout(bool dense) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Align(
          alignment: Alignment.centerLeft,
          child: ImmersiveBackButtonChrome(onPressed: onBackToPage!),
        ),
        SizedBox(height: dense ? 18 : 24),
        Expanded(
          child: Column(
            children: <Widget>[
              const Spacer(flex: 2),
              GestureDetector(
                onTap: onArtworkPressed,
                child: TrackArtwork(
                  track: track,
                  palette: palette,
                  size: dense ? 164 : 196,
                  radius: dense ? 22 : 26,
                  iconSize: dense ? 48 : 56,
                ),
              ),
              SizedBox(height: dense ? 22 : 28),
              Text(
                track?.title ?? '未播放',
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: dense ? 24 : 28,
                  height: 1.22,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                track == null
                    ? '选择曲目开始播放'
                    : track!.artist.trim().isEmpty
                    ? '未知艺术家'
                    : track!.artist,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: dense ? 14 : 15,
                  color: Colors.white.withValues(alpha: 0.76),
                ),
              ),
              SizedBox(height: dense ? 4 : 6),
              Text(
                showLyricsHint
                    ? '点击封面查看歌词'
                    : track == null
                    ? '在这里查看歌词沉浸模式'
                    : track!.album.trim().isEmpty
                    ? (track!.localPath.trim().isEmpty ? '正在聆听' : '本地音乐')
                    : track!.album,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withValues(alpha: 0.5),
                ),
              ),
              const Spacer(flex: 3),
            ],
          ),
        ),
        ImmersiveMobileControls(
          palette: palette,
          dense: dense,
          playMode: playMode,
          volume: volume,
          onPlayModePressed: onPlayModePressed,
          onPrevious: onPrevious,
          onPlayPause: onPlayPause,
          onNext: onNext,
          onVolumeChanged: showVolumeControl ? onVolumeChanged : null,
          onToggleMute: showVolumeControl ? onToggleMute : null,
          isPlaying: isPlaying,
        ),
        SizedBox(height: dense ? 20 : 26),
        _ProgressRow(
          currentMs: currentMs,
          totalMs: totalMs,
          onSeekStart: onSeekStart,
          onSeekChanged: track == null ? null : onSeekChanged,
          onSeekEnd: track == null ? null : onSeekEnd,
        ),
        SizedBox(height: dense ? 6 : 10),
      ],
    );
  }
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({
    required this.currentMs,
    required this.totalMs,
    required this.onSeekStart,
    required this.onSeekChanged,
    required this.onSeekEnd,
  });

  final double currentMs;
  final double totalMs;
  final VoidCallback onSeekStart;
  final ValueChanged<double>? onSeekChanged;
  final ValueChanged<double>? onSeekEnd;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        SizedBox(
          width: 40,
          child: Text(
            _formatDuration(currentMs.round()),
            style: TextStyle(
              fontSize: 11,
              color: Colors.white.withValues(alpha: 0.62),
            ),
          ),
        ),
        Expanded(
          child: Slider(
            value: currentMs.clamp(0, totalMs),
            max: totalMs <= 0 ? 1 : totalMs,
            onChangeStart: (_) => onSeekStart(),
            onChanged: onSeekChanged,
            onChangeEnd: onSeekEnd,
          ),
        ),
        SizedBox(
          width: 40,
          child: Text(
            _formatDuration(totalMs.round()),
            textAlign: TextAlign.end,
            style: TextStyle(
              fontSize: 11,
              color: Colors.white.withValues(alpha: 0.62),
            ),
          ),
        ),
      ],
    );
  }

  String _formatDuration(int totalMs) {
    if (totalMs <= 0) return '0:00';
    final totalSeconds = totalMs ~/ 1000;
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }
}

class _VolumeRow extends StatelessWidget {
  const _VolumeRow({
    required this.volume,
    required this.dense,
    required this.onChanged,
    required this.onToggleMute,
  });

  final double volume;
  final bool dense;
  final ValueChanged<double>? onChanged;
  final Future<void> Function()? onToggleMute;

  @override
  Widget build(BuildContext context) {
    final muted = volume <= 0.001;
    return Row(
      children: <Widget>[
        Button(
          onPressed: onToggleMute == null ? null : () => onToggleMute!.call(),
          style: ButtonStyle(
            padding: WidgetStateProperty.all(EdgeInsets.zero),
            backgroundColor: WidgetStatePropertyAll<Color>(
              Colors.white.withValues(alpha: muted ? 0.14 : 0.08),
            ),
            shape: WidgetStateProperty.all(
              RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(999),
                side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
              ),
            ),
          ),
          child: SizedBox(
            width: dense ? 34 : 38,
            height: dense ? 34 : 38,
            child: Icon(
              muted
                  ? FluentIcons.volume0
                  : volume < 0.45
                  ? FluentIcons.volume1
                  : FluentIcons.volume3,
              size: dense ? 14 : 16,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Slider(
            value: (volume * 100).clamp(0, 100),
            max: 100,
            onChanged: onChanged == null
                ? null
                : (value) => onChanged!.call(value / 100),
          ),
        ),
      ],
    );
  }
}
