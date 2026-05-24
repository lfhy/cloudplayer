// Track artwork resolves cached files first and falls back to the backend media proxy for remote covers.

import 'dart:io';

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/fallback_cover_artwork.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class TrackArtwork extends StatelessWidget {
  const TrackArtwork({
    super.key,
    required this.track,
    required this.palette,
    required this.size,
    this.radius = 10,
    this.iconSize = 18,
    this.placeholderIcon = FluentIcons.music_note,
  });

  final TrackRow? track;
  final AppPalette palette;
  final double size;
  final double radius;
  final double iconSize;
  final IconData placeholderIcon;

  @override
  Widget build(BuildContext context) {
    final mediaProxyBase = context.read<AppController>().api.mediaProxyBase;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          fit: StackFit.expand,
          children: <Widget>[
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: <Color>[
                    palette.subtleBackground,
                    palette.borderColor.withValues(alpha: 0.82),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: placeholderIcon == FluentIcons.music_note
                  ? FallbackCoverArtwork(
                      palette: palette,
                      size: size,
                      radius: radius,
                    )
                  : Center(
                      child: Icon(
                        placeholderIcon,
                        size: iconSize,
                        color: palette.mutedForeground,
                      ),
                    ),
            ),
            if (_cachedCoverPath.isNotEmpty)
              Image.file(
                File(_cachedCoverPath),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              )
            else if (_coverURL.isNotEmpty)
              Image.network(
                _displayURL(mediaProxyBase),
                fit: BoxFit.cover,
                headers: _networkHeaders(mediaProxyBase),
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
          ],
        ),
      ),
    );
  }

  String get _cachedCoverPath => track?.coverCachePath.trim() ?? '';

  String get _coverURL => track?.coverUrl.trim() ?? '';

  String _displayURL(String mediaProxyBase) {
    if (_coverURL.isEmpty ||
        mediaProxyBase.trim().isEmpty ||
        _coverURL.startsWith('file://') ||
        _coverURL.startsWith('http://127.0.0.1:') ||
        _coverURL.startsWith('http://localhost:')) {
      return _coverURL;
    }
    return '${mediaProxyBase.trim()}/__remote_media__?url=${Uri.encodeComponent(_coverURL)}';
  }

  Map<String, String>? _networkHeaders(String mediaProxyBase) {
    if (_coverURL.isEmpty || mediaProxyBase.trim().isNotEmpty) {
      return null;
    }
    return const <String, String>{
      'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'image/*,*/*;q=0.8',
    };
  }
}
