// Import-page widgets keep the three-step shell readable while the stateful page owns bridge actions.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class ImportProgress extends StatelessWidget {
  const ImportProgress({super.key, required this.activeIndex});

  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: ProgressStep(
            index: 1,
            title: '选择方式',
            sub: '本地 / 链接 / 文本',
            active: activeIndex == 1,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: ProgressStep(
            index: 2,
            title: '配置参数',
            sub: '填写并执行导入',
            active: activeIndex == 2,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: ProgressStep(
            index: 3,
            title: '整理保存',
            sub: '确认列表并保存歌单',
            active: activeIndex == 3,
          ),
        ),
      ],
    );
  }
}

class ProgressStep extends StatelessWidget {
  const ProgressStep({
    super.key,
    required this.index,
    required this.title,
    required this.sub,
    required this.active,
  });

  final int index;
  final String title;
  final String sub;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final theme = FluentTheme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: active
              ? theme.accentColor.normal
              : theme.resources.controlStrokeColorSecondary,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: active ? theme.accentColor.normal : theme.inactiveBackgroundColor,
            ),
            alignment: Alignment.center,
            child: Text(
              '$index',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(sub, style: const TextStyle(fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ImportMethodCard extends StatelessWidget {
  const ImportMethodCard({
    super.key,
    required this.palette,
    required this.title,
    required this.desc,
    required this.onPressed,
  });

  final AppPalette palette;
  final String title;
  final String desc;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 280,
      child: HoverButton(
        onPressed: onPressed,
        builder: (context, states) {
          return Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: states.isHovered ? palette.panelBackground : palette.cardBackground,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: palette.borderColor),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(desc, style: TextStyle(color: palette.mutedForeground)),
              ],
            ),
          );
        },
      ),
    );
  }
}

class ConfigHeader extends StatelessWidget {
  const ConfigHeader({
    super.key,
    required this.title,
    required this.description,
  });

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const Text('步骤 2', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Text(title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(description),
      ],
    );
  }
}

class ResultHeader extends StatelessWidget {
  const ResultHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('步骤 3', style: TextStyle(fontWeight: FontWeight.w600)),
        SizedBox(height: 6),
        Text(
          '整理结果并保存歌单',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
        ),
        SizedBox(height: 6),
        Text('如果列表已经出来，建议先保存为歌单，避免切页或误操作丢失数据。'),
      ],
    );
  }
}

class ImportCard extends StatelessWidget {
  const ImportCard({
    super.key,
    required this.palette,
    required this.child,
  });

  final AppPalette palette;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: palette.borderColor),
      ),
      child: child,
    );
  }
}
