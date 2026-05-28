package dev.cloudplayer.cloudplayer_flutter

import android.content.Context
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

// MainActivity keeps Android embedding minimal while the mobile bridge is
// still being migrated from the desktop-first Flutter shell.
class MainActivity : AudioServiceActivity() {
    private lateinit var audioManager: AudioManager
    private var appHostChannel: MethodChannel? = null
    private var volumeSink: EventChannel.EventSink? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        volumeControlStream = AudioManager.STREAM_MUSIC
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    appHostChannel?.invokeMethod("systemBack", null)
                }
            },
        )
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "cloudplayer/android_system_volume",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "getVolume" -> result.success(volumePayload())
                "setVolume" -> {
                    val fraction = (call.argument<Double>("fraction") ?: 0.0).coerceIn(0.0, 1.0)
                    val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
                    val target = (fraction * max).toInt().coerceIn(0, max)
                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
                    publishVolume()
                    result.success(volumePayload())
                }
                else -> result.notImplemented()
            }
        }

        appHostChannel = MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "cloudplayer/android_app_host",
        )
        appHostChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "moveTaskToBack" -> {
                    result.success(moveTaskToBack(true))
                }
                "isProbablyEmulator" -> {
                    result.success(isProbablyEmulator())
                }
                else -> result.notImplemented()
            }
        }

        EventChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "cloudplayer/android_system_volume_events",
        ).setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    volumeSink = events
                    publishVolume()
                }

                override fun onCancel(arguments: Any?) {
                    volumeSink = null
                }
            },
        )
    }

    override fun onResume() {
        super.onResume()
        publishVolume()
    }

    override fun onKeyUp(keyCode: Int, event: android.view.KeyEvent?): Boolean {
        val handled = super.onKeyUp(keyCode, event)
        if (keyCode == android.view.KeyEvent.KEYCODE_VOLUME_UP ||
            keyCode == android.view.KeyEvent.KEYCODE_VOLUME_DOWN ||
            keyCode == android.view.KeyEvent.KEYCODE_VOLUME_MUTE
        ) {
            publishVolume()
        }
        return handled
    }

    private fun publishVolume() {
        volumeSink?.success(volumePayload())
    }

    private fun volumePayload(): Map<String, Int> {
        return mapOf(
            "current" to audioManager.getStreamVolume(AudioManager.STREAM_MUSIC),
            "max" to audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC),
        )
    }

    private fun isProbablyEmulator(): Boolean {
        return Build.FINGERPRINT.startsWith("generic") ||
            Build.FINGERPRINT.contains("emulator", ignoreCase = true) ||
            Build.MODEL.contains("Emulator", ignoreCase = true) ||
            Build.MODEL.contains("Android SDK built for", ignoreCase = true) ||
            Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic") ||
            Build.PRODUCT.contains("sdk", ignoreCase = true)
    }
}
