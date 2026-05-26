pluginManagement {
    val flutterSdkPath =
        run {
            val envFlutterRoot = System.getenv("FLUTTER_ROOT")
            if (!envFlutterRoot.isNullOrBlank()) {
                envFlutterRoot
            } else {
                val properties = java.util.Properties()
                val localProperties = file("local.properties")
                require(localProperties.exists()) {
                    "Flutter SDK not configured. Set FLUTTER_ROOT or flutter.sdk in local.properties."
                }
                localProperties.inputStream().use { properties.load(it) }
                val flutterSdkPath = properties.getProperty("flutter.sdk")
                require(!flutterSdkPath.isNullOrBlank()) {
                    "Flutter SDK not configured. Set FLUTTER_ROOT or flutter.sdk in local.properties."
                }
                flutterSdkPath
            }
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        maven(url = uri("https://maven.aliyun.com/repository/gradle-plugin"))
        maven(url = uri("https://maven.aliyun.com/repository/google"))
        maven(url = uri("https://maven.aliyun.com/repository/public"))
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "9.0.1" apply false
    id("org.jetbrains.kotlin.android") version "2.3.20" apply false
}

include(":app")
