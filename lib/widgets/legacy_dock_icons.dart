// Legacy dock icons mirror the old Wails glyph set for mini-mode, volume, and
// lock actions without pulling in another SVG runtime dependency.

import 'dart:math' as math;

import 'package:fluent_ui/fluent_ui.dart';
import 'package:path_drawing/path_drawing.dart';

enum LegacyDockGlyph {
  enterMini,
  exitMini,
  pinCircle,
  lock,
  unlock,
  volumeLoud,
  volumeSmall,
  volumeMute,
  playBold,
  pauseBold,
  skipPreviousBold,
  skipNextBold,
}

class LegacyDockIcon extends StatelessWidget {
  const LegacyDockIcon({
    super.key,
    required this.glyph,
    this.color,
    this.size = 16,
  });

  final LegacyDockGlyph glyph;
  final Color? color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final resolvedColor =
        color ??
        IconTheme.of(context).color ??
        DefaultTextStyle.of(context).style.color ??
        Colors.black;
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(
        painter: _LegacyDockIconPainter(glyph: glyph, color: resolvedColor),
      ),
    );
  }
}

class _LegacyDockIconPainter extends CustomPainter {
  const _LegacyDockIconPainter({required this.glyph, required this.color});

  static final Path _enterMiniOuter = parseSvgPathData(
    'M11 21h-1c-3.771 0-5.657 0-6.828-1.172S2 16.771 2 13v-2c0-3.771 0-5.657 1.172-6.828S6.229 3 10 3h4c3.771 0 5.657 0 6.828 1.172S22 7.229 22 11',
  );
  static final Path _enterMiniPip = parseSvgPathData(
    'M13 17c0-1.886 0-2.828.586-3.414S15.114 13 17 13h1c1.886 0 2.828 0 3.414.586S22 15.114 22 17s0 2.828-.586 3.414S19.886 21 18 21h-1c-1.886 0-2.828 0-3.414-.586S13 18.886 13 17Z',
  );
  static final Path _enterMiniArrow = parseSvgPathData(
    'M11.5 11.5v-3m0 3h-3m3 0l-4-4',
  );
  static final Path _exitMiniArrow = parseSvgPathData(
    'M7.5 7.5v3m0-3h3m-3 0l4 4',
  );
  static final Path _pinCircleBody = parseSvgPathData(
    'm14.495 7.975l.53-.53zm1.54 1.543l-.53.53zm-5.166 5.696l-.53.53zm-2.058-2.06l.53-.53zm6.473-.157l-.264-.702zm-.96.36l.265.702zm-3.658-3.666l-.704-.258zm.347-.948l.704.258zm-1.59 2.094l.199.723zm.728-.27l-.438-.608zm.187-.172l.57.487zm3.288 3.295l.49.567zm-.436.91l-.723-.198zm.269-.727l-.61-.437zm-5.6-1.995l-.75.004zm.106-.402l-.65-.374zm4.188 4.696v-.75zm.394-.105l-.372-.651zm-.198-9.549l.161.732zm-5.38 9.452a.75.75 0 0 0 1.062 1.06zm3.388-1.269a.75.75 0 1 0-1.061-1.06zm3.607-6.196l1.541 1.543l1.061-1.06l-1.54-1.543zm-2.564 6.18l-2.06-2.062l-1.06 1.06l2.058 2.06zm3.62-2.39l-.959.36l.528 1.404l.958-.36zM11.37 9.95l.348-.95l-1.409-.516l-.347.948zm-1.748 1.61c.328-.09.678-.175.967-.383L9.713 9.96c-.02.014-.052.034-.49.155zm.34-2.126c-.156.426-.18.458-.195.476l1.142.973c.23-.271.344-.613.461-.933zm.627 1.743q.177-.128.32-.294L9.767 9.91a.3.3 0 0 1-.054.05zm3.472 1.48c-.318.119-.658.235-.927.467l.982 1.134c.018-.015.05-.038.473-.198zm-.148 2.143c.12-.436.141-.47.155-.489l-1.219-.874c-.207.289-.292.638-.382.966zm-.779-1.676a1.8 1.8 0 0 0-.285.313l1.219.874a.3.3 0 0 1 .049-.053zm-3.793-.499c-.33-.33-.53-.533-.656-.69c-.127-.16-.076-.154-.076-.061l-1.5.01c.003.419.212.746.403.985c.19.24.465.512.768.816zm-.118-2.51c-.413.114-.786.215-1.071.33c-.284.113-.627.294-.837.658l1.3.748c-.047.081-.093.062.096-.014c.187-.075.461-.152.91-.276zm-.614 1.759q0-.012.006-.023l-1.3-.748a1.55 1.55 0 0 0-.206.78zm1.73 3.872c.305.305.579.581.82.774c.24.191.57.402.992.403l.003-1.5c.094 0 .1.05-.06-.077c-.159-.126-.362-.328-.694-.66zm2.128-1.343c-.124.452-.202.729-.277.918c-.077.19-.097.143-.015.096l.743 1.303c.367-.21.55-.555.664-.84c.115-.287.217-.663.331-1.08zm-.316 2.52c.27 0 .534-.07.767-.203l-.743-1.303a.04.04 0 0 1-.021.006zm3.354-6.874c.54.54.884.888 1.09 1.165c.097.131.135.21.149.252l.006.026v.003l1.466.317c.128-.596-.121-1.093-.416-1.491c-.287-.388-.728-.826-1.234-1.332zm.042 3.651c.67-.251 1.252-.468 1.674-.702c.433-.24.866-.59.995-1.186l-1.466-.317l-.001.003l-.017.02a1 1 0 0 1-.24.168c-.3.168-.757.341-1.472.61zm-.522-6.254c-.509-.51-.95-.954-1.34-1.243c-.399-.297-.899-.548-1.498-.416l.323 1.464h.008l.02.006a1 1 0 0 1 .254.15c.278.207.628.554 1.172 1.1zm-3.308 1.556c.266-.723.437-1.185.603-1.49a1 1 0 0 1 .183-.257l.005-.003h.002l-.323-1.465c-.599.132-.947.57-1.185 1.008c-.231.426-.445 1.014-.693 1.691zm-3.686 8.03l2.326-2.33l-1.061-1.06l-2.327 2.329z',
  );
  static final Path _lockFrame = parseSvgPathData(
    'M2 16c0-2.828 0-4.243.879-5.121C3.757 10 5.172 10 8 10h8c2.828 0 4.243 0 5.121.879C22 11.757 22 13.172 22 16s0 4.243-.879 5.121C20.243 22 18.828 22 16 22H8c-2.828 0-4.243 0-5.121-.879C2 20.243 2 18.828 2 16Z',
  );
  static final Path _lockShackle = parseSvgPathData('M6 10V8a6 6 0 1 1 12 0v2');
  static final Path _unlockShackle = parseSvgPathData(
    'M6 10V8a6 6 0 0 1 11.811-1.5',
  );
  static final Path _volumeLoudSpeaker = parseSvgPathData(
    'M2.003 11.716c.037-1.843.056-2.764.668-3.552a3 3 0 0 1 .413-.431c.752-.636 1.746-.636 3.733-.636c.71 0 1.065 0 1.403-.092q.105-.03.209-.067c.33-.121.627-.33 1.22-.746c2.338-1.645 3.508-2.467 4.489-2.11c.188.069.37.168.533.29c.848.635.913 2.115 1.042 5.073c.048 1.096.08 2.034.08 2.555s-.032 1.46-.08 2.555c-.13 2.958-.194 4.438-1.042 5.073a2.1 2.1 0 0 1-.533.29c-.982.357-2.15-.465-4.49-2.11c-.592-.416-.889-.625-1.22-.746a3 3 0 0 0-.208-.067c-.338-.092-.693-.092-1.403-.092c-1.987 0-2.98 0-3.733-.636a3 3 0 0 1-.413-.43c-.612-.79-.63-1.71-.668-3.552a14 14 0 0 1 0-.57',
  );
  static final Path _volumeLoudWave = parseSvgPathData(
    'M19.49 5.552a.66.66 0 0 1 .97.094l-.529.471l.53-.47l.002.002l.003.004l.007.009l.079.112q.072.107.186.305c.149.264.339.652.526 1.171C21.64 8.291 22 9.851 22 12s-.36 3.71-.736 4.75c-.187.52-.377.907-.526 1.172a5 5 0 0 1-.265.417l-.007.009l-.003.003l-.001.002s-.001.001-.531-.47l.53.471a.66.66 0 0 1-.971.094a.77.77 0 0 1-.09-1.035l.03-.041q.04-.06.125-.207a6 6 0 0 0 .422-.943c.314-.871.644-2.253.644-4.222s-.33-3.35-.644-4.222a6 6 0 0 0-.422-.942a3 3 0 0 0-.157-.253m-1.641 1.833c.333-.197.753-.07.938.286l-.603.357l.603-.357l.001.002l.002.003l.003.007l.01.018l.024.053q.028.063.07.17c.053.145.12.35.185.62c.13.54.252 1.337.252 2.425c0 1.089-.122 1.886-.252 2.426c-.065.27-.132.475-.186.619a3 3 0 0 1-.094.223l-.009.018l-.003.007l-.002.003v.002s-.001.001-.604-.356l.603.357c-.185.355-.605.483-.938.286c-.33-.196-.45-.638-.272-.991l.004-.01l.035-.085c.032-.086.08-.23.13-.438c.1-.416.208-1.09.208-2.06c0-.971-.108-1.645-.208-2.06a4 4 0 0 0-.165-.524l-.004-.01a.76.76 0 0 1 .272-.991',
  );
  static final Path _volumeSmallSpeaker = parseSvgPathData(
    'M3.003 11.716c.04-1.843.059-2.764.697-3.552c.117-.144.288-.315.432-.431c.785-.636 1.822-.636 3.897-.636c.741 0 1.112 0 1.465-.092q.11-.03.218-.067c.345-.121.654-.33 1.273-.746c2.442-1.645 3.662-2.467 4.687-2.11c.196.069.387.168.556.29c.886.635.953 2.115 1.088 5.073c.05 1.096.084 2.034.084 2.555s-.034 1.46-.084 2.555c-.134 2.958-.202 4.438-1.088 5.073c-.17.122-.36.221-.556.29c-1.025.357-2.245-.465-4.687-2.11c-.619-.416-.928-.625-1.273-.746a3 3 0 0 0-.218-.067c-.353-.092-.724-.092-1.465-.092c-2.075 0-3.112 0-3.897-.636a3 3 0 0 1-.432-.43c-.638-.79-.658-1.71-.697-3.552a13 13 0 0 1 0-.57',
  );
  static final Path _volumeSmallWave = parseSvgPathData(
    'M19.45 8.416a.71.71 0 0 1 .98.286l-.63.357l.63-.357v.002l.002.003l.004.007l.01.018a2 2 0 0 1 .098.224c.056.144.126.349.193.619c.136.54.263 1.337.263 2.425c0 1.089-.127 1.886-.263 2.426c-.067.27-.137.475-.193.619a3 3 0 0 1-.099.223l-.009.018l-.004.007l-.001.003v.002s-.002.001-.631-.356l.63.357a.71.71 0 0 1-.98.286a.744.744 0 0 1-.284-.991l.005-.01q.01-.021.035-.085a4 4 0 0 0 .137-.438c.104-.416.217-1.09.217-2.06c0-.971-.113-1.645-.217-2.06a4 4 0 0 0-.172-.524l-.005-.01a.744.744 0 0 1 .284-.991',
  );
  static final Path _volumeMuteWave = parseSvgPathData(
    'M20.515 6.316a.75.75 0 0 1 .991.376c.468 1.035.994 2.768.994 5.308c0 2.192-.392 3.783-.8 4.844a7.7 7.7 0 0 1-.572 1.195a5 5 0 0 1-.289.425l-.007.01l-.003.003l-.002.002L20.25 18l.576.48a.75.75 0 0 1-1.156-.956l.003-.004l.031-.041a3 3 0 0 0 .137-.212c.12-.199.288-.516.459-.961c.342-.889.7-2.298.7-4.306c0-2.326-.48-3.849-.86-4.692a.75.75 0 0 1 .375-.992m-2.101 2.95a.75.75 0 0 1 .887.582c.11.53.199 1.24.199 2.152c0 1.11-.132 1.923-.273 2.474a5 5 0 0 1-.203.631a3 3 0 0 1-.102.228l-.01.018l-.003.007l-.002.003v.002s-.001.001-.657-.363l.656.364a.75.75 0 0 1-1.317-.719l.005-.01l.038-.087a4 4 0 0 0 .141-.447c.11-.424.227-1.111.227-2.101a9 9 0 0 0-.168-1.848a.75.75 0 0 1 .582-.886',
  );
  static final Path _volumeMuteSpeaker = parseSvgPathData(
    'M21.78 3.53a.75.75 0 0 0-1.06-1.06l-4.45 4.449a11 11 0 0 0-.193-1.39c-.172-.788-.477-1.473-1.116-1.923a3 3 0 0 0-.769-.39c-.818-.28-1.631-.057-2.457.345c-.814.395-1.8 1.046-3.032 1.857l-.267.176c-.447.295-.602.394-.76.464q-.257.115-.535.16c-.171.03-.354.032-.89.032h-.162c-1.217 0-2.062-.001-2.814.347A3.96 3.96 0 0 0 1.548 8.22c-.392.729-.438 1.491-.504 2.575l-.008.13C1.014 11.294 1 11.658 1 12s.014.706.036 1.074l.008.13c.066 1.084.112 1.846.504 2.575a3.96 3.96 0 0 0 1.727 1.624c.61.283 1.283.336 2.166.345L2.72 20.47a.75.75 0 1 0 1.06 1.06zM16.5 12a.75.75 0 0 0-1.255-.554l-.071.074l-6 6.274A.778.778 0 0 0 9.34 19c1.039.68 1.899 1.225 2.631 1.549c.743.328 1.48.489 2.222.236a3 3 0 0 0 .769-.391c.706-.497 1.005-1.28 1.167-2.18c.159-.884.213-2.056.281-3.516l.003-.058a68 68 0 0 0 .088-2.64',
  );
  static final Path _playBold = parseSvgPathData(
    'M21.409 9.353a2.998 2.998 0 0 1 0 5.294L8.597 21.614C6.534 22.737 4 21.277 4 18.968V5.033c0-2.31 2.534-3.769 4.597-2.648z',
  );
  static final Path _pauseBold = parseSvgPathData(
    'M2 6c0-1.886 0-2.828.586-3.414S4.114 2 6 2s2.828 0 3.414.586S10 4.114 10 6v12c0 1.886 0 2.828-.586 3.414S7.886 22 6 22s-2.828 0-3.414-.586S2 19.886 2 18zm12 0c0-1.886 0-2.828.586-3.414S16.114 2 18 2s2.828 0 3.414.586S22 4.114 22 6v12c0 1.886 0 2.828-.586 3.414S19.886 22 18 22s-2.828 0-3.414-.586S14 19.886 14 18z',
  );
  static final Path _skipPreviousBold = parseSvgPathData(
    'M8.09 14.647c-1.787-1.154-1.787-4.14 0-5.294l10.79-6.968c1.736-1.121 3.87.339 3.87 2.648v13.934c0 2.31-2.134 3.769-3.87 2.648zM2 5a.75.75 0 0 1 1.5 0v14A.75.75 0 0 1 2 19z',
  );
  static final Path _skipNextBold = parseSvgPathData(
    'M16.66 14.647c1.787-1.154 1.787-4.14 0-5.294L5.87 2.385C4.135 1.264 2 2.724 2 5.033v13.934c0 2.31 2.134 3.769 3.87 2.648zM22.75 5a.75.75 0 0 0-1.5 0v14a.75.75 0 0 0 1.5 0z',
  );

  final LegacyDockGlyph glyph;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width, size.height) / 24;
    final dx = (size.width - 24 * scale) / 2;
    final dy = (size.height - 24 * scale) / 2;
    canvas.save();
    canvas.translate(dx, dy);
    canvas.scale(scale, scale);
    switch (glyph) {
      case LegacyDockGlyph.enterMini:
        _drawMiniGlyph(canvas, _enterMiniArrow);
      case LegacyDockGlyph.exitMini:
        _drawMiniGlyph(canvas, _exitMiniArrow);
      case LegacyDockGlyph.pinCircle:
        canvas.drawCircle(const Offset(12, 12), 10, _strokePaint(1.5));
        canvas.drawPath(_pinCircleBody, _fillPaint());
      case LegacyDockGlyph.lock:
        canvas.drawPath(_lockFrame, _strokePaint(1.5));
        canvas.drawCircle(const Offset(12, 16), 2, _strokePaint(1.5));
        canvas.drawPath(_lockShackle, _strokePaint(1.5));
      case LegacyDockGlyph.unlock:
        canvas.drawPath(_lockFrame, _strokePaint(1.5));
        canvas.drawPath(_unlockShackle, _strokePaint(1.5));
      case LegacyDockGlyph.volumeLoud:
        canvas.drawPath(_volumeLoudSpeaker, _fillPaint());
        canvas.drawPath(_volumeLoudWave, _fillPaint());
      case LegacyDockGlyph.volumeSmall:
        canvas.drawPath(_volumeSmallSpeaker, _fillPaint());
        canvas.drawPath(_volumeSmallWave, _fillPaint());
      case LegacyDockGlyph.volumeMute:
        canvas.drawPath(_volumeMuteWave, _fillPaint());
        canvas.drawPath(_volumeMuteSpeaker, _fillPaint());
      case LegacyDockGlyph.playBold:
        canvas.drawPath(_playBold, _fillPaint());
      case LegacyDockGlyph.pauseBold:
        canvas.drawPath(_pauseBold, _fillPaint());
      case LegacyDockGlyph.skipPreviousBold:
        canvas.drawPath(_skipPreviousBold, _fillPaint());
      case LegacyDockGlyph.skipNextBold:
        canvas.drawPath(_skipNextBold, _fillPaint());
    }
    canvas.restore();
  }

  void _drawMiniGlyph(Canvas canvas, Path arrow) {
    canvas.drawPath(_enterMiniOuter, _strokePaint(1.5));
    canvas.drawPath(_enterMiniPip, _strokePaint(1.5));
    canvas.drawPath(
      arrow,
      _strokePaint(1.5, cap: StrokeCap.round, join: StrokeJoin.round),
    );
  }

  Paint _fillPaint() {
    return Paint()
      ..style = PaintingStyle.fill
      ..color = color;
  }

  Paint _strokePaint(
    double strokeWidth, {
    StrokeCap cap = StrokeCap.butt,
    StrokeJoin join = StrokeJoin.miter,
  }) {
    return Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = cap
      ..strokeJoin = join
      ..color = color;
  }

  @override
  bool shouldRepaint(covariant _LegacyDockIconPainter oldDelegate) {
    return oldDelegate.glyph != glyph || oldDelegate.color != color;
  }
}
