// Shared status toast keeps transient feedback out of the page layout so page
// content stays aligned with the legacy desktop chrome.

import 'dart:async';

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class AppStatusToast extends StatefulWidget {
  const AppStatusToast({
    super.key,
    required this.palette,
    required this.message,
    required this.onDismiss,
  });

  final AppPalette palette;
  final String message;
  final VoidCallback onDismiss;

  @override
  State<AppStatusToast> createState() => _AppStatusToastState();
}

class _AppStatusToastState extends State<AppStatusToast> {
  Timer? _dismissTimer;

  @override
  void initState() {
    super.initState();
    _armDismissTimer();
  }

  @override
  void didUpdateWidget(covariant AppStatusToast oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.message == widget.message) {
      return;
    }
    _dismissTimer?.cancel();
    _armDismissTimer();
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final visible = widget.message.trim().isNotEmpty;
    return IgnorePointer(
      ignoring: !visible,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 18, 24, 0),
          child: Align(
            alignment: Alignment.topCenter,
            child: AnimatedSlide(
              duration: const Duration(milliseconds: 180),
              offset: visible ? Offset.zero : const Offset(0, -0.18),
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 180),
                opacity: visible ? 1 : 0,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: widget.palette.brightness == Brightness.light
                          ? Colors.white.withValues(alpha: 0.97)
                          : const Color(0xF01E2026),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: widget.palette.borderColor.withValues(alpha: 0.9),
                      ),
                      boxShadow: <BoxShadow>[
                        BoxShadow(
                          color: Colors.black.withValues(
                            alpha: widget.palette.brightness == Brightness.light
                                ? 0.10
                                : 0.26,
                          ),
                          blurRadius: 24,
                          offset: const Offset(0, 12),
                        ),
                      ],
                    ),
                    child: Row(
                      children: <Widget>[
                        Container(
                          width: 20,
                          height: 20,
                          decoration: BoxDecoration(
                            color: widget.palette.accent.normal.withValues(
                              alpha: 0.12,
                            ),
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Icon(
                            FluentIcons.info,
                            size: 11,
                            color: widget.palette.accent.normal,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            widget.message,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: widget.palette.strongForeground,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 24,
                          height: 24,
                          child: Button(
                            onPressed: widget.onDismiss,
                            style: ButtonStyle(
                              padding: WidgetStateProperty.all(EdgeInsets.zero),
                              backgroundColor: WidgetStateProperty.resolveWith(
                                (states) => states.isHovered
                                    ? widget.palette.subtleBackground
                                    : Colors.transparent,
                              ),
                              shape: WidgetStateProperty.all(
                                RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(999),
                                ),
                              ),
                            ),
                            child: Icon(
                              FluentIcons.chrome_close,
                              size: 10,
                              color: widget.palette.mutedForeground,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _armDismissTimer() {
    if (widget.message.trim().isEmpty) {
      return;
    }
    _dismissTimer = Timer(const Duration(seconds: 3), widget.onDismiss);
  }
}
