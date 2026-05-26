part of '../settings_page.dart';

// Settings widgets keep tab cards, compact choices, and shared helpers separate from panel business logic.

class _SettingsTab extends StatelessWidget {
  const _SettingsTab({
    required this.label,
    required this.desc,
    required this.active,
    required this.palette,
    required this.onPressed,
  });

  final String label;
  final String desc;
  final bool active;
  final AppPalette palette;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Button(
      onPressed: onPressed,
      style: ButtonStyle(
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (_) => active
              ? palette.accent.normal.withValues(alpha: 0.08)
              : palette.cardBackground,
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(13),
            side: BorderSide(
              color: active
                  ? palette.accent.normal.withValues(alpha: 0.28)
                  : palette.borderColor,
            ),
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: active ? palette.accent.normal : null,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            desc,
            style: TextStyle(fontSize: 11, color: palette.mutedForeground),
          ),
        ],
      ),
    );
  }
}

class _SettingsPanel extends StatelessWidget {
  const _SettingsPanel({required this.palette, required this.children});

  final AppPalette palette;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: palette.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.title,
    required this.desc,
    required this.preview,
    required this.previewAccent,
    required this.active,
    required this.palette,
    required this.onPressed,
  });

  final String title;
  final String desc;
  final Color preview;
  final Color previewAccent;
  final bool active;
  final AppPalette palette;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 190,
      child: Button(
        onPressed: onPressed,
        style: _cardButtonStyle(palette, active),
        child: Row(
          children: <Widget>[
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: LinearGradient(
                  colors: <Color>[preview, previewAccent],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                border: Border.all(
                  color: palette.borderColor.withValues(alpha: 0.3),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _CardText(title: title, desc: desc),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThemeCard extends StatelessWidget {
  const _ThemeCard({
    required this.title,
    required this.desc,
    required this.color,
    required this.custom,
    required this.active,
    required this.palette,
    required this.onPressed,
  });

  final String title;
  final String desc;
  final Color color;
  final bool custom;
  final bool active;
  final AppPalette palette;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 190,
      child: Button(
        onPressed: onPressed,
        style: _cardButtonStyle(palette, active),
        child: Row(
          children: <Widget>[
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: custom
                    ? const LinearGradient(
                        colors: <Color>[
                          Color(0xFFFF5F6D),
                          Color(0xFFFFC371),
                          Color(0xFF42D392),
                          Color(0xFF5B8CFF),
                        ],
                      )
                    : null,
                color: custom ? null : color,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _CardText(title: title, desc: desc),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChoiceChip extends StatelessWidget {
  const _ChoiceChip({
    required this.label,
    required this.active,
    required this.palette,
    required this.onPressed,
  });

  final String label;
  final bool active;
  final AppPalette palette;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Button(
      onPressed: onPressed,
      style: ButtonStyle(
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (_) => active
              ? palette.accent.normal.withValues(alpha: 0.08)
              : palette.cardBackground,
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(13),
            side: BorderSide(
              color: active
                  ? palette.accent.normal.withValues(alpha: 0.35)
                  : palette.borderColor,
            ),
          ),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: active ? palette.accent.normal : null,
          fontWeight: active ? FontWeight.w600 : FontWeight.w400,
        ),
      ),
    );
  }
}

class _LabeledTextBox extends StatelessWidget {
  const _LabeledTextBox({
    required this.label,
    required this.controller,
    required this.onSubmitted,
    this.placeholder,
  });

  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onSubmitted;
  final String? placeholder;

  @override
  Widget build(BuildContext context) {
    return InfoLabel(
      label: label,
      child: TextBox(
        controller: controller,
        placeholder: placeholder,
        onSubmitted: onSubmitted,
      ),
    );
  }
}

class _LabeledCombo<T> extends StatelessWidget {
  const _LabeledCombo({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final T value;
  final List<ComboBoxItem<T>> items;
  final ValueChanged<T?>? onChanged;

  @override
  Widget build(BuildContext context) {
    return InfoLabel(
      label: label,
      child: ComboBox<T>(value: value, items: items, onChanged: onChanged),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
    );
  }
}

class _HintText extends StatelessWidget {
  const _HintText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final palette = paletteForSettings(context.read<AppController>().settings);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Text(
        text,
        style: TextStyle(fontSize: 12, color: palette.mutedForeground),
      ),
    );
  }
}

class _CardText extends StatelessWidget {
  const _CardText({required this.title, required this.desc});

  final String title;
  final String desc;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          title,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 2),
        Text(desc, style: const TextStyle(fontSize: 11)),
      ],
    );
  }
}

ButtonStyle _cardButtonStyle(AppPalette palette, bool active) {
  return ButtonStyle(
    padding: WidgetStateProperty.all(const EdgeInsets.all(14)),
    backgroundColor: WidgetStateProperty.resolveWith(
      (_) => palette.cardBackground,
    ),
    shape: WidgetStateProperty.all(
      RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: active
              ? palette.accent.normal.withValues(alpha: 0.5)
              : palette.borderColor,
        ),
      ),
    ),
  );
}

String _toggleProvider(List<String> current, String provider) {
  final next = <String>[...current];
  if (next.contains(provider)) {
    next.remove(provider);
  } else {
    next.add(provider);
  }
  return next.join(',');
}

int _colorFromHex(String value) {
  final normalized = value.replaceFirst('#', '');
  final buffer = StringBuffer();
  if (normalized.length == 6) buffer.write('ff');
  buffer.write(normalized);
  return int.tryParse(buffer.toString(), radix: 16) ?? 0xFFFFFFFF;
}

String normalizeSettingsHexColor(String value, String fallback) {
  final normalized = value.trim();
  if (RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(normalized)) {
    return normalized.toLowerCase();
  }
  return fallback.toLowerCase();
}

String colorToSettingsHex(Color color) {
  final red = _settingsColorChannel(color.r).toRadixString(16).padLeft(2, '0');
  final green = _settingsColorChannel(
    color.g,
  ).toRadixString(16).padLeft(2, '0');
  final blue = _settingsColorChannel(color.b).toRadixString(16).padLeft(2, '0');
  return '#$red$green$blue';
}

int _settingsColorChannel(double value) {
  final scaled = (value * 255).round();
  if (scaled < 0) return 0;
  if (scaled > 255) return 255;
  return scaled;
}

const List<({String key, String title, String desc, Color color})> _themeItems =
    <({String key, String title, String desc, Color color})>[
      (key: 'coral', title: '珊瑚红', desc: '经典暖调', color: Color(0xFFC62F2F)),
      (key: 'ocean', title: '海蓝', desc: '冷静清透', color: Color(0xFF1F6AA5)),
      (key: 'forest', title: '松绿', desc: '低饱和自然感', color: Color(0xFF2F7D4B)),
      (key: 'netease', title: '网易云红', desc: '更偏品牌化', color: Color(0xFFD43C33)),
      (key: 'kugou', title: '酷狗蓝', desc: '更亮更锐', color: Color(0xFF1977FF)),
      (
        key: 'qqmusic',
        title: 'QQ 音乐绿',
        desc: '鲜明品牌绿',
        color: Color(0xFF31C27C),
      ),
      (key: 'custom', title: '自定义颜色', desc: '自己选强调色', color: Color(0xFFC62F2F)),
    ];
