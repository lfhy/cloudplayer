part of '../settings_page.dart';

// The lyrics color dialog keeps the picker overlay and its compact controls
// isolated from the inline settings field so both files stay within limits.

class _LyricsColorPickerDialog extends StatefulWidget {
  const _LyricsColorPickerDialog({
    required this.palette,
    required this.title,
    required this.initialValue,
    required this.fallbackValue,
    required this.previewLabel,
    required this.onConfirmed,
  });

  final AppPalette palette;
  final String title;
  final String initialValue;
  final String fallbackValue;
  final String previewLabel;
  final ValueChanged<String> onConfirmed;

  @override
  State<_LyricsColorPickerDialog> createState() =>
      _LyricsColorPickerDialogState();
}

class _LyricsColorPickerDialogState extends State<_LyricsColorPickerDialog> {
  late final TextEditingController _hexController;
  late int _red;
  late int _green;
  late int _blue;

  String get _hexValue =>
      colorToSettingsHex(Color.fromARGB(255, _red, _green, _blue));

  Color get _previewColor => Color.fromARGB(255, _red, _green, _blue);

  @override
  void initState() {
    super.initState();
    _hexController = TextEditingController();
    _applyHex(
      normalizeSettingsHexColor(widget.initialValue, widget.fallbackValue),
      notify: false,
    );
  }

  @override
  void dispose() {
    _hexController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChildWindowDialog(
      palette: widget.palette,
      title: widget.title,
      width: 456,
      body: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _LyricsColorDialogPreview(
            palette: widget.palette,
            previewLabel: widget.previewLabel,
            color: _previewColor,
            hexValue: _hexValue,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              for (final swatch in _desktopLyricsColorPresets)
                _LyricsColorSwatchButton(
                  palette: widget.palette,
                  color: swatch.$2,
                  label: swatch.$1,
                  active: _hexValue == swatch.$2,
                  onPressed: () => _applyHex(swatch.$2),
                ),
            ],
          ),
          const SizedBox(height: 14),
          InfoLabel(
            label: '十六进制',
            child: TextBox(
              controller: _hexController,
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.allow(RegExp(r'[#0-9a-fA-F]')),
                LengthLimitingTextInputFormatter(7),
              ],
              onSubmitted: _submitHex,
              onEditingComplete: () => _submitHex(_hexController.text),
            ),
          ),
          const SizedBox(height: 12),
          _LyricsColorChannelSlider(
            palette: widget.palette,
            label: 'R',
            value: _red,
            activeColor: const Color(0xFFC63F36),
            onChanged: (value) => _updateChannels(red: value),
          ),
          const SizedBox(height: 10),
          _LyricsColorChannelSlider(
            palette: widget.palette,
            label: 'G',
            value: _green,
            activeColor: const Color(0xFF31C27C),
            onChanged: (value) => _updateChannels(green: value),
          ),
          const SizedBox(height: 10),
          _LyricsColorChannelSlider(
            palette: widget.palette,
            label: 'B',
            value: _blue,
            activeColor: const Color(0xFF1977FF),
            onChanged: (value) => _updateChannels(blue: value),
          ),
        ],
      ),
      footer: <Widget>[
        ChildDialogSecondaryButton(
          palette: widget.palette,
          label: '恢复默认',
          onPressed: () => _applyHex(widget.fallbackValue),
        ),
        ChildDialogSecondaryButton(
          palette: widget.palette,
          label: '取消',
          onPressed: () => Navigator.pop(context),
        ),
        ChildDialogPrimaryButton(
          palette: widget.palette,
          label: '确定',
          onPressed: () => widget.onConfirmed(_hexValue),
        ),
      ],
    );
  }

  void _submitHex(String raw) {
    _applyHex(normalizeSettingsHexColor(raw, _hexValue));
  }

  void _applyHex(String raw, {bool notify = true}) {
    final normalized = normalizeSettingsHexColor(raw, widget.fallbackValue);
    final color = Color(_colorFromHex(normalized));
    _red = _settingsColorChannel(color.r);
    _green = _settingsColorChannel(color.g);
    _blue = _settingsColorChannel(color.b);
    _hexController.value = TextEditingValue(
      text: normalized,
      selection: TextSelection.collapsed(offset: normalized.length),
    );
    if (notify) {
      setState(() {});
    }
  }

  void _updateChannels({int? red, int? green, int? blue}) {
    setState(() {
      _red = red ?? _red;
      _green = green ?? _green;
      _blue = blue ?? _blue;
      final hex = _hexValue;
      _hexController.value = TextEditingValue(
        text: hex,
        selection: TextSelection.collapsed(offset: hex.length),
      );
    });
  }
}

class _LyricsColorDialogPreview extends StatelessWidget {
  const _LyricsColorDialogPreview({
    required this.palette,
    required this.previewLabel,
    required this.color,
    required this.hexValue,
  });

  final AppPalette palette;
  final String previewLabel;
  final Color color;
  final String hexValue;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: palette.subtleBackground,
        border: Border.all(color: palette.borderColor),
      ),
      child: Row(
        children: <Widget>[
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: <Color>[
                  color.withValues(alpha: 0.96),
                  color.withValues(alpha: 0.72),
                ],
              ),
              border: Border.all(
                color: color.computeLuminance() > 0.9
                    ? palette.borderColor
                    : color.withValues(alpha: 0.6),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  previewLabel,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: palette.strongForeground,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  hexValue,
                  style: TextStyle(
                    fontSize: 11,
                    color: palette.mutedForeground,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LyricsColorSwatchButton extends StatelessWidget {
  const _LyricsColorSwatchButton({
    required this.palette,
    required this.color,
    required this.label,
    required this.active,
    required this.onPressed,
  });

  final AppPalette palette;
  final String color;
  final String label;
  final bool active;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final swatchColor = Color(_colorFromHex(color));
    return Button(
      onPressed: onPressed,
      style: ButtonStyle(
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (states) => active
              ? palette.accent.normal.withValues(alpha: 0.1)
              : states.isHovered
              ? palette.subtleBackground
              : palette.cardBackground,
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(
              color: active
                  ? palette.accent.normal.withValues(alpha: 0.4)
                  : palette.borderColor,
            ),
          ),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              color: swatchColor,
              borderRadius: BorderRadius.circular(7),
              border: Border.all(
                color: swatchColor.computeLuminance() > 0.9
                    ? palette.borderColor
                    : swatchColor.withValues(alpha: 0.5),
              ),
            ),
          ),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 11)),
        ],
      ),
    );
  }
}

class _LyricsColorChannelSlider extends StatelessWidget {
  const _LyricsColorChannelSlider({
    required this.palette,
    required this.label,
    required this.value,
    required this.activeColor,
    required this.onChanged,
  });

  final AppPalette palette;
  final String label;
  final int value;
  final Color activeColor;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        SizedBox(
          width: 18,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: palette.strongForeground,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: FluentTheme(
            data: FluentTheme.of(context).copyWith(
              accentColor: AccentColor.swatch(<String, Color>{
                'darkest': activeColor.withValues(alpha: 0.58),
                'darker': activeColor.withValues(alpha: 0.7),
                'dark': activeColor.withValues(alpha: 0.82),
                'normal': activeColor,
                'light': activeColor.withValues(alpha: 0.88),
                'lighter': activeColor.withValues(alpha: 0.76),
                'lightest': activeColor.withValues(alpha: 0.64),
              }),
            ),
            child: Slider(
              value: value.toDouble(),
              min: 0,
              max: 255,
              onChanged: (double nextValue) => onChanged(nextValue.round()),
            ),
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          width: 28,
          child: Text(
            value.toString(),
            textAlign: TextAlign.right,
            style: TextStyle(fontSize: 11, color: palette.mutedForeground),
          ),
        ),
      ],
    );
  }
}

const List<(String, String)> _desktopLyricsColorPresets = <(String, String)>[
  ('默认未唱', '#ffffff'),
  ('默认已唱', '#ffb7d4'),
  ('暖白', '#f8f1e7'),
  ('浅金', '#f9d976'),
  ('薄荷', '#c7f9cc'),
  ('湖蓝', '#9ad1ff'),
  ('珊瑚', '#ff8a80'),
  ('薰衣草', '#d7c8ff'),
];
