// The shared child-window shell mirrors the compact legacy dialog framing without depending on Fluent's large default modal chrome.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class ChildWindowDialog extends StatelessWidget {
  const ChildWindowDialog({
    super.key,
    required this.palette,
    required this.title,
    required this.body,
    required this.footer,
    this.width = 404,
    this.centerFooter = false,
  });

  final AppPalette palette;
  final String title;
  final Widget body;
  final List<Widget> footer;
  final double width;
  final bool centerFooter;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: width),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(14, 20, 14, 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: LinearGradient(
                colors: <Color>[
                  palette.windowBackground.withValues(
                    alpha: palette.brightness == Brightness.light ? 0.98 : 0.96,
                  ),
                  palette.cardBackground.withValues(
                    alpha: palette.brightness == Brightness.light ? 1.0 : 0.98,
                  ),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              border: Border.all(color: palette.borderColor),
              boxShadow: <BoxShadow>[
                BoxShadow(
                  color: Colors.black.withValues(
                    alpha: palette.brightness == Brightness.light ? 0.1 : 0.24,
                  ),
                  blurRadius: 28,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 56),
                  child: Text(
                    title,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                      color: palette.strongForeground,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                body,
                if (footer.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: centerFooter
                        ? MainAxisAlignment.center
                        : MainAxisAlignment.end,
                    children: footer
                        .expand(
                          (item) => <Widget>[
                            item,
                            if (item != footer.last) const SizedBox(width: 8),
                          ],
                        )
                        .toList(growable: false),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
