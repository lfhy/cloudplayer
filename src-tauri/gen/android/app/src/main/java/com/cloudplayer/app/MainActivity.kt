package com.cloudplayer.app

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  /**
   * 避免系统「显示大小 / 字体大小」改变 WebView 内文字缩放，导致与 UI 设计比例不一致；
   * 关闭捏合缩放，行为接近常见原生 App（布局由 CSS 控制）。
   */
  override fun onWebViewCreate(webView: WebView) {
    webView.settings.apply {
      textZoom = 100
      setSupportZoom(false)
      builtInZoomControls = false
      displayZoomControls = false
      useWideViewPort = true
      loadWithOverviewMode = false
    }
  }
}
