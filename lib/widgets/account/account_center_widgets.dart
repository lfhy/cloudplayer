// Account-center widgets keep the dialog body split from the auth state logic so each handwritten file stays under the repo line limit.

import 'dart:typed_data';

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

import 'account_login_widgets.dart';

class AccountProviderTabs extends StatelessWidget {
  const AccountProviderTabs({super.key, required this.palette});

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        _ProviderTab(
          palette: palette,
          icon: FluentIcons.music_note,
          label: '酷狗概念版',
          active: true,
        ),
        const SizedBox(width: 8),
        _ProviderTab(
          palette: palette,
          icon: FluentIcons.library,
          label: '网易云音乐',
          active: false,
          disabled: true,
        ),
      ],
    );
  }
}

class AccountCenterPanel extends StatelessWidget {
  const AccountCenterPanel({
    super.key,
    required this.palette,
    required this.statusText,
    required this.loggedIn,
    required this.status,
    required this.mode,
    required this.busy,
    required this.mobileController,
    required this.codeController,
    required this.qrBytes,
    required this.canCopyQrUrl,
    required this.currentMode,
    required this.onSelectMode,
    required this.onSendCaptcha,
    required this.onLoginBySms,
    required this.onCreateQrCode,
    required this.onCopyQrUrl,
    required this.onChangeCollectionMode,
    required this.onOpenImport,
    required this.onLogout,
  });

  final AppPalette palette;
  final String statusText;
  final bool loggedIn;
  final KugouLoginStatus? status;
  final String mode;
  final bool busy;
  final TextEditingController mobileController;
  final TextEditingController codeController;
  final Uint8List? qrBytes;
  final bool canCopyQrUrl;
  final String currentMode;
  final ValueChanged<String> onSelectMode;
  final VoidCallback onSendCaptcha;
  final VoidCallback onLoginBySms;
  final VoidCallback onCreateQrCode;
  final VoidCallback onCopyQrUrl;
  final ValueChanged<String> onChangeCollectionMode;
  final VoidCallback onOpenImport;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: palette.panelBackground,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: palette.borderColor),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            '酷狗概念版',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: palette.strongForeground,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            statusText,
            style: TextStyle(
              fontSize: 12,
              color: palette.mutedForeground,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 14),
          if (loggedIn)
            _LoggedInSection(
              palette: palette,
              status: status,
              busy: busy,
              currentMode: currentMode,
              onChangeCollectionMode: onChangeCollectionMode,
              onOpenImport: onOpenImport,
              onLogout: onLogout,
            )
          else
            AccountLoginSection(
              palette: palette,
              mode: mode,
              busy: busy,
              mobileController: mobileController,
              codeController: codeController,
              qrBytes: qrBytes,
              canCopyQrUrl: canCopyQrUrl,
              onSelectMode: onSelectMode,
              onSendCaptcha: onSendCaptcha,
              onLoginBySms: onLoginBySms,
              onCreateQrCode: onCreateQrCode,
              onCopyQrUrl: onCopyQrUrl,
            ),
        ],
      ),
    );
  }
}

class _LoggedInSection extends StatelessWidget {
  const _LoggedInSection({
    required this.palette,
    required this.status,
    required this.busy,
    required this.currentMode,
    required this.onChangeCollectionMode,
    required this.onOpenImport,
    required this.onLogout,
  });

  final AppPalette palette;
  final KugouLoginStatus? status;
  final bool busy;
  final String currentMode;
  final ValueChanged<String> onChangeCollectionMode;
  final VoidCallback onOpenImport;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final nickname = status?.nickname.trim().isEmpty ?? true
        ? '酷狗概念版'
        : status!.nickname.trim();
    final detail = status?.userId.trim().isEmpty ?? true
        ? '当前账号'
        : 'UID ${status!.userId.trim()}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            _AccountAvatar(
              palette: palette,
              nickname: nickname,
              avatarUrl: status?.avatarUrl ?? '',
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    nickname,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: palette.strongForeground,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    detail,
                    style: TextStyle(
                      fontSize: 12,
                      color: palette.mutedForeground,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        _CollectionModeSection(
          palette: palette,
          busy: busy,
          currentMode: currentMode,
          onChangeCollectionMode: onChangeCollectionMode,
        ),
        const SizedBox(height: 14),
        Row(
          children: <Widget>[
            FilledButton(
              onPressed: busy ? null : onOpenImport,
              child: const Text('前往导入歌单'),
            ),
            const SizedBox(width: 8),
            Button(
              onPressed: busy ? null : onLogout,
              child: const Text('退出登录'),
            ),
          ],
        ),
      ],
    );
  }
}

class _CollectionModeSection extends StatelessWidget {
  const _CollectionModeSection({
    required this.palette,
    required this.busy,
    required this.currentMode,
    required this.onChangeCollectionMode,
  });

  final AppPalette palette;
  final bool busy;
  final String currentMode;
  final ValueChanged<String> onChangeCollectionMode;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          '歌单模式',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: palette.strongForeground,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            for (final item in const <(String, String)>[
              ('offline', '离线模式'),
              ('online', '在线模式'),
              ('hybrid', '混合模式'),
            ])
              Button(
                onPressed: busy ? null : () => onChangeCollectionMode(item.$1),
                style: ButtonStyle(
                  padding: WidgetStateProperty.all(
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                  backgroundColor: WidgetStateProperty.resolveWith(
                    (_) => currentMode == item.$1
                        ? palette.accent.normal.withValues(alpha: 0.1)
                        : palette.cardBackground,
                  ),
                  shape: WidgetStateProperty.all(
                    RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(13),
                      side: BorderSide(
                        color: currentMode == item.$1
                            ? palette.accent.normal.withValues(alpha: 0.34)
                            : palette.borderColor,
                      ),
                    ),
                  ),
                ),
                child: Text(
                  item.$2,
                  style: TextStyle(
                    fontSize: 12,
                    color: currentMode == item.$1
                        ? palette.accent.normal
                        : palette.strongForeground,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _ProviderTab extends StatelessWidget {
  const _ProviderTab({
    required this.palette,
    required this.icon,
    required this.label,
    required this.active,
    this.disabled = false,
  });

  final AppPalette palette;
  final IconData icon;
  final String label;
  final bool active;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Button(
      onPressed: disabled ? null : () {},
      style: ButtonStyle(
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (_) => active
              ? palette.accent.normal.withValues(alpha: 0.1)
              : palette.cardBackground,
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(
              color: active
                  ? palette.accent.normal.withValues(alpha: 0.28)
                  : palette.borderColor,
            ),
          ),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 16),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}

class _AccountAvatar extends StatelessWidget {
  const _AccountAvatar({
    required this.palette,
    required this.nickname,
    required this.avatarUrl,
  });

  final AppPalette palette;
  final String nickname;
  final String avatarUrl;

  @override
  Widget build(BuildContext context) {
    final label = nickname.isEmpty ? 'K' : nickname.substring(0, 1);
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        color: palette.accent.normal.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: avatarUrl.isEmpty
          ? Text(
              label,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: palette.accent.normal,
              ),
            )
          : Image.network(
              avatarUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Text(
                label,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: palette.accent.normal,
                ),
              ),
            ),
    );
  }
}
