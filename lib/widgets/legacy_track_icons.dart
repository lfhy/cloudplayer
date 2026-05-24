// Shared legacy list icons keep the heart glyph closer to the old Wails table presentation.

import 'package:fluent_ui/fluent_ui.dart';
import 'package:path_drawing/path_drawing.dart';

class LegacyFavoriteIcon extends StatelessWidget {
  const LegacyFavoriteIcon({
    super.key,
    required this.color,
    this.size = 16,
    this.filled = false,
  });

  final Color color;
  final double size;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(
        painter: _LegacyFavoriteIconPainter(color: color, filled: filled),
      ),
    );
  }
}

class LegacyPlayIcon extends StatelessWidget {
  const LegacyPlayIcon({super.key, required this.color, this.size = 10});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(painter: _LegacyPlayIconPainter(color: color)),
    );
  }
}

class _LegacyPlayIconPainter extends CustomPainter {
  const _LegacyPlayIconPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.18, size.height * 0.1)
      ..lineTo(size.width * 0.18, size.height * 0.9)
      ..lineTo(size.width * 0.88, size.height * 0.5)
      ..close();
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.fill
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(covariant _LegacyPlayIconPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}

class _LegacyFavoriteIconPainter extends CustomPainter {
  _LegacyFavoriteIconPainter({required this.color, required this.filled});

  static final Path _heartPath = parseSvgPathData(
    'M12 21.35a1.6 1.6 0 0 1-.84-.24C7.1 18.58 4 15.77 4 11.9C4 8.92 6.18 7 8.83 7c1.48 0 2.51.65 3.17 1.5c.66-.85 1.69-1.5 3.17-1.5C17.82 7 20 8.92 20 11.9c0 3.87-3.1 6.68-7.16 9.21a1.6 1.6 0 0 1-.84.24',
  );

  final Color color;
  final bool filled;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 24;
    canvas.save();
    canvas.scale(scale, scale);
    if (filled) {
      canvas.drawPath(
        _heartPath,
        Paint()
          ..style = PaintingStyle.fill
          ..color = color,
      );
    }
    canvas.drawPath(
      _heartPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..color = color
        ..strokeWidth = 1.8
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _LegacyFavoriteIconPainter oldDelegate) {
    return oldDelegate.color != color || oldDelegate.filled != filled;
  }
}
