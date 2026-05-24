part of '../settings_page.dart';

// Lyrics color controls stay in a dedicated part so the settings page can add
// picker behavior without pushing existing panel files past repo limits.

class _LyricsColorField extends StatefulWidget {
  const _LyricsColorField({
    required this.label,
    required this.value,
    required this.fallbackValue,
    required this.previewLabel,
    required this.palette,
    required this.onChanged,
  });

  final String label;
  final String value;
  final String fallbackValue;
  final String previewLabel;
  final AppPalette palette;
  final ValueChanged<String> onChanged;

  @override
  State<_LyricsColorField> createState() => _LyricsColorFieldState();
}

class _LyricsColorFieldState extends State<_LyricsColorField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: _displayValue);
  }

  @override
  void didUpdateWidget(covariant _LyricsColorField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value == widget.value) return;
    final nextValue = _displayValue;
    if (_controller.text != nextValue) {
      _controller.value = TextEditingValue(
        text: nextValue,
        selection: TextSelection.collapsed(offset: nextValue.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _displayValue =>
      normalizeSettingsHexColor(widget.value, widget.fallbackValue);

  @override
  Widget build(BuildContext context) {
    return InfoLabel(
      label: widget.label,
      child: Row(
        children: <Widget>[
          Expanded(
            child: TextBox(
              controller: _controller,
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.allow(RegExp(r'[#0-9a-fA-F]')),
                LengthLimitingTextInputFormatter(7),
              ],
              onSubmitted: _submitText,
              onEditingComplete: () => _submitText(_controller.text),
            ),
          ),
          const SizedBox(width: 8),
          _LyricsColorPreviewButton(
            palette: widget.palette,
            color: _displayValue,
            previewLabel: widget.previewLabel,
            onPressed: () => _openPicker(context),
          ),
        ],
      ),
    );
  }

  Future<void> _openPicker(BuildContext context) async {
    final selected = await showLyricsColorPickerDialog(
      context: context,
      palette: widget.palette,
      title: widget.label,
      initialValue: _displayValue,
      fallbackValue: widget.fallbackValue,
      previewLabel: widget.previewLabel,
    );
    if (!mounted || selected == null) return;
    _commitValue(selected);
  }

  void _submitText(String raw) {
    _commitValue(normalizeSettingsHexColor(raw, widget.fallbackValue));
  }

  void _commitValue(String nextValue) {
    final normalized = normalizeSettingsHexColor(
      nextValue,
      widget.fallbackValue,
    );
    if (_controller.text != normalized) {
      _controller.value = TextEditingValue(
        text: normalized,
        selection: TextSelection.collapsed(offset: normalized.length),
      );
    }
    if (normalized == _displayValue) return;
    widget.onChanged(normalized);
  }
}

class _LyricsColorPreviewButton extends StatelessWidget {
  const _LyricsColorPreviewButton({
    required this.palette,
    required this.color,
    required this.previewLabel,
    required this.onPressed,
  });

  final AppPalette palette;
  final String color;
  final String previewLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final swatch = Color(_colorFromHex(color));
    return Button(
      onPressed: onPressed,
      style: ButtonStyle(
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.isHovered
              ? palette.subtleBackground
              : palette.cardBackground,
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: palette.borderColor),
          ),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              color: swatch,
              borderRadius: BorderRadius.circular(9),
              border: Border.all(
                color: swatch.computeLuminance() > 0.9
                    ? palette.borderColor
                    : swatch.withValues(alpha: 0.55),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            previewLabel,
            style: TextStyle(fontSize: 12, color: palette.strongForeground),
          ),
        ],
      ),
    );
  }
}

Future<String?> showLyricsColorPickerDialog({
  required BuildContext context,
  required AppPalette palette,
  required String title,
  required String initialValue,
  required String fallbackValue,
  required String previewLabel,
}) async {
  String? result;
  await showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return _LyricsColorPickerDialog(
        palette: palette,
        title: title,
        initialValue: initialValue,
        fallbackValue: fallbackValue,
        previewLabel: previewLabel,
        onConfirmed: (value) {
          result = value;
          Navigator.pop(dialogContext);
        },
      );
    },
  );
  return result;
}
