plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val releaseKeystorePath = System.getenv("CP_ANDROID_KEYSTORE_PATH")
val releaseKeystorePassword = System.getenv("CP_ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = System.getenv("CP_ANDROID_KEY_ALIAS")
val releaseKeyPassword = System.getenv("CP_ANDROID_KEY_PASSWORD")
val hasReleaseSigning =
    !releaseKeystorePath.isNullOrBlank() &&
    !releaseKeystorePassword.isNullOrBlank() &&
    !releaseKeyAlias.isNullOrBlank() &&
    !releaseKeyPassword.isNullOrBlank()

android {
    namespace = "dev.cloudplayer.cloudplayer_flutter"
    compileSdk = flutter.compileSdkVersion

    sourceSets {
        getByName("main") {
            jniLibs.srcDirs("../../bin/bridge/android/jniLibs")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "dev.cloudplayer.cloudplayer_flutter"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseKeystorePath!!)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            // CI release builds should inject a stable signing key via env vars so
            // Android upgrades can install over previous workflow releases.
            signingConfig = if (hasReleaseSigning) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
