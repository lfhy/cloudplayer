// Search loading uses the shared CloudPlayer waveform silhouette so the result
// transition keeps the product's own motion language instead of a generic spinner.

import 'dart:math' as math;

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class SearchResultsLoadingPanel extends StatefulWidget {
  const SearchResultsLoadingPanel({
    super.key,
    required this.palette,
  });

  final AppPalette palette;

  @override
  State<SearchResultsLoadingPanel> createState() =>
      _SearchResultsLoadingPanelState();
}

class _SearchResultsLoadingPanelState extends State<SearchResultsLoadingPanel>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = widget.palette;
    final foreground = palette.brightness == Brightness.light
        ? palette.strongForeground
        : Colors.white.withValues(alpha: 0.94);
    return Center(
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: 0, end: 1),
        duration: const Duration(milliseconds: 180),
        curve: const Cubic(0.22, 1, 0.36, 1),
        builder: (context, value, child) {
          return Opacity(
            opacity: value,
            child: Transform.translate(
              offset: Offset(0, (1 - value) * 8),
              child: child,
            ),
          );
        },
        child: Container(
          width: 240,
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 24),
          decoration: BoxDecoration(
            color: palette.brightness == Brightness.light
                ? Colors.white.withValues(alpha: 0.86)
                : palette.cardBackground.withValues(alpha: 0.82),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: palette.borderColor),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: Colors.black.withValues(
                  alpha: palette.brightness == Brightness.light ? 0.05 : 0.18,
                ),
                blurRadius: 30,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  SizedBox(
                    width: 116,
                    height: 72,
                    child: CustomPaint(
                      painter: _LogoWavePainter(
                        accent: palette.accent.normal,
                        glow: _glowColor(palette),
                        progress: _controller.value,
                        lightMode: palette.brightness == Brightness.light,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '正在搜索',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: foreground,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'CloudPlayer 正在整理结果',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: palette.mutedForeground,
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Color _glowColor(AppPalette palette) {
    return palette.brightness == Brightness.light
        ? palette.accent.normal.withValues(alpha: 0.22)
        : palette.accent.normal.withValues(alpha: 0.28);
  }
}

class _LogoWavePainter extends CustomPainter {
  const _LogoWavePainter({
    required this.accent,
    required this.glow,
    required this.progress,
    required this.lightMode,
  });

  final Color accent;
  final Color glow;
  final double progress;
  final bool lightMode;

  static const List<(double centerX, double baseHeight)> _bars =
      <(double centerX, double baseHeight)>[
        (7, 8),
        (17, 16),
        (27, 28),
        (37, 40),
        (47, 52),
        (57, 60),
        (67, 52),
        (77, 40),
        (87, 28),
        (97, 16),
        (107, 8),
      ];

  @override
  void paint(Canvas canvas, Size size) {
    final scaleX = size.width / 116;
    final scaleY = size.height / 72;
    final centerY = size.height / 2;

    final glowPaint = Paint()
      ..shader = RadialGradient(
        colors: <Color>[glow, Colors.transparent],
      ).createShader(
        Rect.fromCircle(
          center: Offset(size.width / 2, centerY - 4 * scaleY),
          radius: size.width * 0.46,
        ),
      );
    canvas.drawCircle(
      Offset(size.width / 2, centerY - 4 * scaleY),
      size.width * 0.46,
      glowPaint,
    );

    final linePaint = Paint()
      ..color = accent.withValues(alpha: lightMode ? 0.30 : 0.44)
      ..style = PaintingStyle.fill;
    final baseline = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, centerY - 1.25 * scaleY, size.width, 2.5 * scaleY),
      Radius.circular(999),
    );
    canvas.drawRRect(baseline, linePaint);

    for (var index = 0; index < _bars.length; index++) {
      final bar = _bars[index];
      final phase = progress * math.pi * 2 + index * 0.42;
      final wave = 0.72 + ((math.sin(phase) + 1) * 0.5) * 0.78;
      final height = (bar.$2 * wave).clamp(6, 62) * scaleY;
      final width = 6 * scaleX;
      final x = (bar.$1 - 3) * scaleX;
      final y = centerY - height / 2;
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, y, width, height),
        Radius.circular(3 * scaleX),
      );
      final fillPaint = Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[
            Color.lerp(accent, Colors.white, lightMode ? 0.18 : 0.08)!,
            accent.withValues(alpha: 0.94),
          ],
        ).createShader(rect.outerRect);
      canvas.drawRRect(rect, fillPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _LogoWavePainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.accent != accent ||
        oldDelegate.glow != glow ||
        oldDelegate.lightMode != lightMode;
  }
}
