// Fallback cover artwork mirrors the legacy Wails SVG placeholder so missing
// covers keep the same gradient card and accent glyph across Flutter surfaces.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:path_drawing/path_drawing.dart';

class FallbackCoverArtwork extends StatelessWidget {
  const FallbackCoverArtwork({
    super.key,
    required this.palette,
    required this.size,
    required this.radius,
  });

  final AppPalette palette;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _FallbackCoverArtworkPainter(palette: palette, radius: radius),
    );
  }
}

class _FallbackCoverArtworkPainter extends CustomPainter {
  const _FallbackCoverArtworkPainter({
    required this.palette,
    required this.radius,
  });

  static final Path _glyph = parseSvgPathData(
    'M14.319 2.505A2.75 2.75 0 0 0 11.414 4.3c-.098.27-.132.563-.148.869A17 17 0 0 0 11.25 6v8.536A4.75 4.75 0 1 0 12.75 18V9.21q.156.083.343.175L15.8 10.74c.418.21.759.38 1.038.5c.281.123.558.223.843.257A2.75 2.75 0 0 0 20.586 9.7c.098-.27.132-.563.148-.87c.016-.303.016-.683.016-1.151v-.083c0-.348 0-.62-.049-.878a2.75 2.75 0 0 0-1.03-1.667c-.21-.16-.453-.281-.764-.436L16.2 3.262a22 22 0 0 0-1.038-.501c-.28-.123-.558-.223-.843-.256',
  );

  final AppPalette palette;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final frame = RRect.fromRectAndRadius(rect, Radius.circular(radius));
    final colors = _coverPalette();
    canvas.drawRRect(
      frame,
      Paint()
        ..shader = LinearGradient(
          colors: <Color>[colors.$1, colors.$2],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ).createShader(rect),
    );
    final inset = (size.shortestSide * 0.015).clamp(0.5, 2.0);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        rect.deflate(inset),
        Radius.circular((radius - 1).clamp(4, radius)),
      ),
      Paint()
        ..color = colors.$3
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
    final glyphSize = size.shortestSide * 0.46;
    final glyphOffset = (size.shortestSide - glyphSize) / 2;
    canvas.save();
    canvas.translate(glyphOffset, glyphOffset);
    canvas.scale(glyphSize / 24);
    canvas.drawPath(
      _glyph,
      Paint()
        ..color = palette.accent.normal
        ..style = PaintingStyle.fill,
    );
    canvas.restore();
  }

  (Color, Color, Color) _coverPalette() {
    if (palette.brightness == Brightness.dark) {
      return (
        const Color(0xFF000000),
        const Color(0xFF000000),
        const Color(0x1FFFFFFF),
      );
    }
    return (
      const Color(0xFFFFFFFF),
      const Color(0xFFFFFFFF),
      const Color(0x1F000000),
    );
  }

  @override
  bool shouldRepaint(covariant _FallbackCoverArtworkPainter oldDelegate) {
    return oldDelegate.palette != palette || oldDelegate.radius != radius;
  }
}
