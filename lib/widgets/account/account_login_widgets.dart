// Account login widgets isolate the QR/SMS guest flows so the account-center visual helpers stay below the repo line limit.

import 'dart:typed_data';

import 'package:cloudplayer_flutter/pages/import/import_kugou_widgets.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class AccountLoginSection extends StatelessWidget {
  const AccountLoginSection({
    super.key,
    required this.palette,
    required this.mode,
    required this.busy,
    required this.mobileController,
    required this.codeController,
    required this.qrBytes,
    required this.canCopyQrUrl,
    required this.onSelectMode,
    required this.onSendCaptcha,
    required this.onLoginBySms,
    required this.onCreateQrCode,
    required this.onCopyQrUrl,
  });

  final AppPalette palette;
  final String mode;
  final bool busy;
  final TextEditingController mobileController;
  final TextEditingController codeController;
  final Uint8List? qrBytes;
  final bool canCopyQrUrl;
  final ValueChanged<String> onSelectMode;
  final VoidCallback onSendCaptcha;
  final VoidCallback onLoginBySms;
  final VoidCallback onCreateQrCode;
  final VoidCallback onCopyQrUrl;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            KugouModeButton(
              label: '手机验证码',
              active: mode == 'sms',
              onPressed: busy ? () {} : () => onSelectMode('sms'),
            ),
            const SizedBox(width: 8),
            KugouModeButton(
              label: '二维码登录',
              active: mode == 'qr',
              onPressed: busy ? () {} : () => onSelectMode('qr'),
            ),
          ],
        ),
        const SizedBox(height: 14),
        if (mode == 'sms')
          _AccountSmsPane(
            busy: busy,
            mobileController: mobileController,
            codeController: codeController,
            onSendCaptcha: onSendCaptcha,
            onLoginBySms: onLoginBySms,
          )
        else
          _AccountQrPane(
            palette: palette,
            busy: busy,
            qrBytes: qrBytes,
            canCopyQrUrl: canCopyQrUrl,
            onCreateQrCode: onCreateQrCode,
            onCopyQrUrl: onCopyQrUrl,
          ),
      ],
    );
  }
}

class _AccountSmsPane extends StatelessWidget {
  const _AccountSmsPane({
    required this.busy,
    required this.mobileController,
    required this.codeController,
    required this.onSendCaptcha,
    required this.onLoginBySms,
  });

  final bool busy;
  final TextEditingController mobileController;
  final TextEditingController codeController;
  final VoidCallback onSendCaptcha;
  final VoidCallback onLoginBySms;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        TextBox(
          controller: mobileController,
          placeholder: '例如：13800138000',
        ),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            Expanded(
              child: TextBox(
                controller: codeController,
                placeholder: '输入收到的短信验证码',
              ),
            ),
            const SizedBox(width: 10),
            Button(
              onPressed: busy ? null : onSendCaptcha,
              child: const Text('发送验证码'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: busy ? null : onLoginBySms,
          child: const Text('登录酷狗概念版'),
        ),
      ],
    );
  }
}

class _AccountQrPane extends StatelessWidget {
  const _AccountQrPane({
    required this.palette,
    required this.busy,
    required this.qrBytes,
    required this.canCopyQrUrl,
    required this.onCreateQrCode,
    required this.onCopyQrUrl,
  });

  final AppPalette palette;
  final bool busy;
  final Uint8List? qrBytes;
  final bool canCopyQrUrl;
  final VoidCallback onCreateQrCode;
  final VoidCallback onCopyQrUrl;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Container(
          width: 156,
          height: 156,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
          ),
          alignment: Alignment.center,
          child: qrBytes == null
              ? Text(
                  '二维码',
                  style: TextStyle(color: palette.mutedForeground),
                )
              : ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.memory(qrBytes!, fit: BoxFit.cover),
                ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                '使用酷狗概念版 App 扫码确认后，会自动同步登录状态。',
                style: TextStyle(
                  fontSize: 12,
                  color: palette.mutedForeground,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: busy ? null : onCreateQrCode,
                child: const Text('生成二维码'),
              ),
              const SizedBox(height: 8),
              Button(
                onPressed: busy || !canCopyQrUrl ? null : onCopyQrUrl,
                child: const Text('复制登录链接'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
