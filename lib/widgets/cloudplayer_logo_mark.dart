// CloudPlayer logo mark mirrors the legacy Wails sidebar/tray waveform so the
// Flutter shell can reuse the same brand shape without raster assets.

import 'package:fluent_ui/fluent_ui.dart';

class CloudPlayerLogoMark extends StatelessWidget {
  const CloudPlayerLogoMark({
    super.key,
    this.color,
    this.width = 28,
    this.height = 16.8,
  });

  final Color? color;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: CustomPaint(
        painter: _CloudPlayerLogoMarkPainter(
          color ?? IconTheme.of(context).color!,
        ),
      ),
    );
  }
}

class _CloudPlayerLogoMarkPainter extends CustomPainter {
  const _CloudPlayerLogoMarkPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final fill = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    const columns = <(double x, double y, double width, double height)>[
      (4, 34, 6, 8),
      (14, 30, 6, 16),
      (24, 24, 6, 28),
      (34, 18, 6, 40),
      (44, 12, 6, 52),
      (54, 8, 6, 60),
      (64, 12, 6, 52),
      (74, 18, 6, 40),
      (84, 24, 6, 28),
      (94, 30, 6, 16),
      (104, 34, 6, 8),
    ];
    final scaleX = size.width / 120;
    final scaleY = size.height / 72;
    for (final column in columns) {
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(
          column.$1 * scaleX,
          column.$2 * scaleY,
          column.$3 * scaleX,
          column.$4 * scaleY,
        ),
        Radius.circular(3 * scaleX),
      );
      canvas.drawRRect(rect, fill);
    }
    final baseline = Paint()
      ..color = color.withValues(alpha: 0.92)
      ..style = PaintingStyle.fill;
    final line = RRect.fromRectAndRadius(
      Rect.fromLTWH(2 * scaleX, 35 * scaleY, 116 * scaleX, 2.5 * scaleY),
      Radius.circular(1.25 * scaleX),
    );
    canvas.drawRRect(line, baseline);
  }

  @override
  bool shouldRepaint(covariant _CloudPlayerLogoMarkPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}
