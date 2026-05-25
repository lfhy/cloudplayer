// Android preview app smoke test keeps the mobile fallback shell covered while
// the desktop bridge is still being migrated to Android packaging.

import 'package:cloudplayer_flutter/app/android_preview_app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders Android adaptation preview shell', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const AndroidPreviewApp());

    expect(find.text('CloudPlayer Android 适配中'), findsOneWidget);
    expect(find.textContaining('Android 平台工程已加入仓库'), findsOneWidget);
  });
}
