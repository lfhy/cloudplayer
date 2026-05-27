// Shared child-window dialog flows mirror the compact Wails child windows used for close-confirm, message, and repair prompts.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:cloudplayer_flutter/models/app_models.dart';

import 'child_window_buttons.dart';
import 'child_window_models.dart';
import 'child_window_shell.dart';

Future<void> showChildMessageDialog({
  required BuildContext context,
  required AppPalette palette,
  required String title,
  required String message,
  String buttonText = '关闭',
}) {
  return _showChildDialog<void>(
    context: context,
    builder: (dialogContext) {
      return ChildWindowDialog(
        palette: palette,
        title: title,
        width: 456,
        centerFooter: true,
        body: Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            height: 1.45,
            color: palette.mutedForeground,
          ),
        ),
        footer: <Widget>[
          ChildDialogPrimaryButton(
            palette: palette,
            minWidth: 124,
            label: buttonText,
            onPressed: () => Navigator.pop(dialogContext),
          ),
        ],
      );
    },
  );
}

Future<String?> showChildTextPromptDialog({
  required BuildContext context,
  required AppPalette palette,
  required String title,
  required String confirmText,
  required String placeholder,
  String initialValue = '',
  String? emptyErrorText,
}) async {
  final textController = TextEditingController(text: initialValue);
  String? result;
  await _showChildDialog<void>(
    context: context,
    builder: (dialogContext) {
      var status = '';
      return StatefulBuilder(
        builder: (context, setState) {
          return ChildWindowDialog(
            palette: palette,
            title: title,
            width: 420,
            body: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                TextBox(
                  controller: textController,
                  autofocus: true,
                  placeholder: placeholder,
                ),
                if (status.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 8),
                  Text(
                    status,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFFC62F2F),
                    ),
                  ),
                ],
              ],
            ),
            footer: <Widget>[
              ChildDialogSecondaryButton(
                palette: palette,
                label: '取消',
                onPressed: () => Navigator.pop(dialogContext),
              ),
              ChildDialogPrimaryButton(
                palette: palette,
                label: confirmText,
                onPressed: () {
                  final value = textController.text.trim();
                  if (value.isEmpty && emptyErrorText != null) {
                    setState(() => status = emptyErrorText);
                    return;
                  }
                  result = value;
                  Navigator.pop(dialogContext);
                },
              ),
            ],
          );
        },
      );
    },
  );
  textController.dispose();
  return result;
}

Future<MainWindowCloseChoice> showMainWindowCloseDialog({
  required BuildContext context,
  required AppPalette palette,
  String title = '关闭主窗口？',
  String minimizeLabel = '最小化到托盘',
}) async {
  var result = MainWindowCloseChoice.cancel;
  await _showChildDialog<void>(
    context: context,
    builder: (dialogContext) {
      return ChildWindowDialog(
        palette: palette,
        title: title,
        body: Row(
          children: <Widget>[
            Expanded(
              child: ChildDialogChoiceButton(
                palette: palette,
                label: minimizeLabel,
                onPressed: () {
                  result = MainWindowCloseChoice.tray;
                  Navigator.pop(dialogContext);
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ChildDialogChoiceButton(
                palette: palette,
                label: '退出应用',
                danger: true,
                onPressed: () {
                  result = MainWindowCloseChoice.quit;
                  Navigator.pop(dialogContext);
                },
              ),
            ),
          ],
        ),
        footer: <Widget>[
          ChildDialogSecondaryButton(
            palette: palette,
            compact: true,
            label: '取消',
            onPressed: () => Navigator.pop(dialogContext),
          ),
        ],
      );
    },
  );
  return result;
}

Future<MainWindowCloseChoice> showMobileExitDialog({
  required BuildContext context,
  required AppPalette palette,
}) {
  return showMainWindowCloseDialog(
    context: context,
    palette: palette,
    title: '退出 CloudPlayer？',
    minimizeLabel: '最小化到后台',
  );
}

Future<bool> showOnlineModeConfirmDialog({
  required BuildContext context,
  required AppPalette palette,
}) async {
  var accepted = false;
  await _showChildDialog<void>(
    context: context,
    builder: (dialogContext) {
      return ChildWindowDialog(
        palette: palette,
        title: '开启在线模式？',
        width: 432,
        body: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              '会切换到酷狗云歌单，并立即重新拉取云端歌单。',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                height: 1.45,
                color: palette.mutedForeground,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: <Widget>[
                Expanded(
                  child: ChildDialogChoiceButton(
                    palette: palette,
                    label: '暂不切换',
                    onPressed: () => Navigator.pop(dialogContext),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChildDialogChoiceButton(
                    palette: palette,
                    label: '继续开启',
                    onPressed: () {
                      accepted = true;
                      Navigator.pop(dialogContext);
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
        footer: const <Widget>[],
      );
    },
  );
  return accepted;
}

Future<Map<String, dynamic>?> showDatabaseRepairDialog({
  required BuildContext context,
  required AppPalette palette,
  required Future<Map<String, dynamic>> Function() onRepair,
}) async {
  Map<String, dynamic>? result;
  await _showChildDialog<void>(
    context: context,
    builder: (dialogContext) {
      var busy = false;
      var errorText = '';
      return StatefulBuilder(
        builder: (context, setState) {
          return ChildWindowDialog(
            palette: palette,
            title: busy ? '正在修复数据库…' : '修复数据库？',
            width: 448,
            body: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  busy
                      ? '请稍等，正在清理本地缓存的云歌单副本，并把当前歌单模式切回离线。'
                      : '会清理本地缓存的云歌单副本，只保留本地歌单，并把当前歌单模式切回离线。之后再次切换到在线或混合模式时，会重新拉取云歌单。',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    height: 1.45,
                    color: palette.mutedForeground,
                  ),
                ),
                const SizedBox(height: 12),
                if (busy)
                  _DatabaseRepairLoading(palette: palette)
                else
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: ChildDialogChoiceButton(
                          palette: palette,
                          label: '先不修复',
                          onPressed: () => Navigator.pop(dialogContext),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ChildDialogChoiceButton(
                          palette: palette,
                          label: '开始修复',
                          danger: true,
                          onPressed: () async {
                            setState(() {
                              busy = true;
                              errorText = '';
                            });
                            try {
                              result = await onRepair();
                              if (dialogContext.mounted) {
                                Navigator.pop(dialogContext);
                              }
                            } catch (error) {
                              if (!dialogContext.mounted) return;
                              setState(() {
                                busy = false;
                                errorText = error.toString();
                              });
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                if (errorText.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 10),
                  Text(
                    errorText,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFFC62F2F),
                    ),
                  ),
                ],
              ],
            ),
            footer: const <Widget>[],
          );
        },
      );
    },
  );
  return result;
}

Future<int?> showPlaylistTargetDialog({
  required BuildContext context,
  required AppPalette palette,
  required List<PlaylistRow> playlists,
  int? initialPlaylistId,
}) async {
  if (playlists.isEmpty) return null;
  var selectedPlaylistId = initialPlaylistId ?? playlists.first.id;
  int? result;
  await _showChildDialog<void>(
    context: context,
    builder: (dialogContext) {
      return StatefulBuilder(
        builder: (context, setState) {
          return ChildWindowDialog(
            palette: palette,
            title: '添加到歌单',
            width: 432,
            body: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  '选择一个已有歌单',
                  style: TextStyle(
                    fontSize: 12,
                    color: palette.mutedForeground,
                  ),
                ),
                const SizedBox(height: 10),
                ComboBox<int>(
                  value: selectedPlaylistId,
                  isExpanded: true,
                  items: playlists
                      .map(
                        (playlist) => ComboBoxItem<int>(
                          value: playlist.id,
                          child: Text(playlist.name),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() => selectedPlaylistId = value);
                  },
                ),
              ],
            ),
            footer: <Widget>[
              ChildDialogSecondaryButton(
                palette: palette,
                label: '取消',
                onPressed: () => Navigator.pop(dialogContext),
              ),
              ChildDialogPrimaryButton(
                palette: palette,
                label: '添加',
                onPressed: () {
                  result = selectedPlaylistId;
                  Navigator.pop(dialogContext);
                },
              ),
            ],
          );
        },
      );
    },
  );
  return result;
}

Future<T?> _showChildDialog<T>({
  required BuildContext context,
  required WidgetBuilder builder,
}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: false,
    builder: builder,
  );
}

class _DatabaseRepairLoading extends StatelessWidget {
  const _DatabaseRepairLoading({required this.palette});

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        SizedBox(
          width: 18,
          height: 18,
          child: ProgressRing(
            strokeWidth: 2.2,
            activeColor: palette.accent.normal,
          ),
        ),
        const SizedBox(width: 10),
        Text(
          '正在整理数据库并清理本地云歌单…',
          style: TextStyle(fontSize: 11, color: palette.strongForeground),
        ),
      ],
    );
  }
}
