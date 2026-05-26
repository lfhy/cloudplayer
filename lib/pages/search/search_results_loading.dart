// Search results loading mirrors the legacy Wails table-state animation without affecting shared list widgets.

import 'dart:math' as math;

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class SearchResultsLoadingPanel extends StatefulWidget {
  const SearchResultsLoadingPanel({
    super.key,
    required this.palette,
    this.showTableHeader = true,
  });

  final AppPalette palette;
  final bool showTableHeader;

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
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 760;
    final statusForeground = widget.palette.brightness == Brightness.light
        ? widget.palette.strongForeground.withValues(alpha: 0.78)
        : Colors.white.withValues(alpha: 0.92);
    final descriptionForeground = widget.palette.mutedForeground;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: const Duration(milliseconds: 220),
      curve: const Cubic(0.22, 1, 0.36, 1),
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, (1 - value) * 10),
            child: child,
          ),
        );
      },
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: widget.palette.brightness == Brightness.light
              ? Colors.white.withValues(alpha: 0.78)
              : widget.palette.cardBackground.withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: widget.palette.borderColor),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: Colors.black.withValues(
                alpha: widget.palette.brightness == Brightness.light
                    ? 0.04
                    : 0.16,
              ),
              blurRadius: 26,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return Column(
                children: <Widget>[
                  Padding(
                    padding: EdgeInsets.fromLTRB(
                      compact ? 18 : 22,
                      compact ? 18 : 20,
                      compact ? 18 : 22,
                      12,
                    ),
                    child: Row(
                      children: <Widget>[
                        _LoadingBars(
                          palette: widget.palette,
                          progress: _controller.value,
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              '正在搜索…',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: statusForeground,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '结果页已经切换，列表内容正在填充',
                              style: TextStyle(
                                fontSize: 12,
                                color: descriptionForeground,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (widget.showTableHeader)
                    _LoadingHeader(
                      palette: widget.palette,
                      compact: compact,
                    ),
                  Expanded(
                    child: ListView.separated(
                      physics: const NeverScrollableScrollPhysics(),
                      padding: EdgeInsets.fromLTRB(
                        compact ? 14 : 18,
                        widget.showTableHeader ? 8 : 0,
                        compact ? 14 : 18,
                        18,
                      ),
                      itemCount: compact ? 6 : 7,
                      separatorBuilder: (_, index) =>
                          const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        return _LoadingRow(
                          palette: widget.palette,
                          compact: compact,
                          progress: (_controller.value + index * 0.11) % 1,
                        );
                      },
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
}

class _LoadingHeader extends StatelessWidget {
  const _LoadingHeader({
    required this.palette,
    required this.compact,
  });

  final AppPalette palette;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(compact ? 14 : 18, 10, compact ? 14 : 18, 8),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: palette.borderColor),
        ),
      ),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: compact ? 40 : 36,
            child: _HeaderText(label: '#', palette: palette),
          ),
          SizedBox(width: compact ? 44 : 52),
          Expanded(
            flex: compact ? 5 : 4,
            child: _HeaderText(label: '标题', palette: palette),
          ),
          if (!compact)
            Expanded(
              flex: 3,
              child: _HeaderText(label: '专辑', palette: palette),
            ),
          SizedBox(
            width: compact ? 48 : 56,
            child: _HeaderText(label: '时长', palette: palette, right: true),
          ),
        ],
      ),
    );
  }
}

class _HeaderText extends StatelessWidget {
  const _HeaderText({
    required this.label,
    required this.palette,
    this.right = false,
  });

  final String label;
  final AppPalette palette;
  final bool right;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      textAlign: right ? TextAlign.right : TextAlign.left,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: palette.mutedForeground,
      ),
    );
  }
}

class _LoadingRow extends StatelessWidget {
  const _LoadingRow({
    required this.palette,
    required this.compact,
    required this.progress,
  });

  final AppPalette palette;
  final bool compact;
  final double progress;

  @override
  Widget build(BuildContext context) {
    final rowFill = palette.brightness == Brightness.light
        ? Colors.white.withValues(alpha: 0.72)
        : Colors.white.withValues(alpha: 0.025);
    return Container(
      height: 62,
      padding: EdgeInsets.symmetric(horizontal: compact ? 10 : 12, vertical: 10),
      decoration: BoxDecoration(
        color: rowFill,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.borderColor.withValues(alpha: 0.72)),
      ),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: compact ? 40 : 36,
            child: _LoadingBlock(
              palette: palette,
              progress: progress,
              width: compact ? 16 : 12,
              height: 10,
              radius: 999,
            ),
          ),
          const SizedBox(width: 8),
          _LoadingBlock(
            palette: palette,
            progress: progress,
            width: 40,
            height: 40,
            radius: 12,
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: compact ? 5 : 4,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _LoadingBlock(
                  palette: palette,
                  progress: progress,
                  width: double.infinity,
                  height: 12,
                  radius: 999,
                ),
                const SizedBox(height: 8),
                _LoadingBlock(
                  palette: palette,
                  progress: progress,
                  width: compact ? 120 : 150,
                  height: 10,
                  radius: 999,
                ),
              ],
            ),
          ),
          if (!compact) ...<Widget>[
            const SizedBox(width: 16),
            Expanded(
              flex: 3,
              child: _LoadingBlock(
                palette: palette,
                progress: progress,
                width: double.infinity,
                height: 10,
                radius: 999,
              ),
            ),
          ],
          const SizedBox(width: 16),
          _LoadingBlock(
            palette: palette,
            progress: progress,
            width: compact ? 42 : 48,
            height: 10,
            radius: 999,
          ),
        ],
      ),
    );
  }
}

class _LoadingBlock extends StatelessWidget {
  const _LoadingBlock({
    required this.palette,
    required this.progress,
    required this.width,
    required this.height,
    required this.radius,
  });

  final AppPalette palette;
  final double progress;
  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final base = palette.brightness == Brightness.light
        ? const Color(0xFFF0F2F5)
        : Colors.white.withValues(alpha: 0.05);
    final highlight = palette.brightness == Brightness.light
        ? Colors.white.withValues(alpha: 0.92)
        : Colors.white.withValues(alpha: 0.14);
    return Container(
      width: width == double.infinity ? null : width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: LinearGradient(
          colors: <Color>[base, highlight, base],
          stops: const <double>[0.1, 0.45, 0.9],
          transform: _SlidingGradientTransform(progress),
        ),
      ),
    );
  }
}

class _LoadingBars extends StatelessWidget {
  const _LoadingBars({
    required this.palette,
    required this.progress,
  });

  final AppPalette palette;
  final double progress;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 34,
      height: 28,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List<Widget>.generate(4, (index) {
          final phase = (progress + index * 0.12) % 1;
          final scale = 0.38 + 0.62 * math.sin(phase * math.pi);
          final color = Color.lerp(
            widgetColorBase(palette),
            palette.accent.normal,
            0.6,
          );
          return Transform.scale(
            alignment: Alignment.bottomCenter,
            scaleY: scale,
            child: Container(
              width: 5,
              height: 28,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: <Color>[
                    (color ?? palette.accent.normal).withValues(alpha: 0.96),
                    palette.accent.normal.withValues(alpha: 0.34),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Color widgetColorBase(AppPalette palette) {
    return palette.brightness == Brightness.light
        ? const Color(0xFFB74B4B)
        : const Color(0xFFE67D7D);
  }
}

class _SlidingGradientTransform extends GradientTransform {
  const _SlidingGradientTransform(this.progress);

  final double progress;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(bounds.width * (progress * 2 - 1), 0, 0);
  }
}
