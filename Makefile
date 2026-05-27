# Make targets keep the Go bridge and Flutter macOS launch path consistent.

DEVELOPER_DIR ?= /Applications/Xcode.app/Contents/Developer
FLUTTER_DEVICE ?= macos
ENV_LOCAL ?= .env.local
ANDROID_EMULATOR ?= CloudPlayer_API_36
ANDROID_DEVICE ?= emulator-5554
MACOSX_DEPLOYMENT_TARGET ?= 11.0
BRIDGE_OUT := bin/bridge/libcloudplayer_bridge.dylib
BRIDGE_ARM64_OUT := bin/bridge/libcloudplayer_bridge-arm64.dylib
BRIDGE_AMD64_OUT := bin/bridge/libcloudplayer_bridge-amd64.dylib
ANDROID_BRIDGE_DIR := bin/bridge/android
ANDROID_BRIDGE_OUT := $(ANDROID_BRIDGE_DIR)/libcloudplayer_bridge.so
ANDROID_JNILIBS_DIR := $(ANDROID_BRIDGE_DIR)/jniLibs/arm64-v8a
ANDROID_JNILIBS_OUT := $(ANDROID_JNILIBS_DIR)/libcloudplayer_bridge.so
ANDROID_NDK_VERSION ?= 28.2.13676358
ANDROID_NDK_HOST_TAG ?=
BRIDGE_MIN_VERSION_FLAG := -mmacosx-version-min=$(MACOSX_DEPLOYMENT_TARGET)
BRIDGE_SDKROOT := $(shell DEVELOPER_DIR=$(DEVELOPER_DIR) xcrun --sdk macosx --show-sdk-path)
BRIDGE_CGO_CFLAGS := $(BRIDGE_MIN_VERSION_FLAG)
BRIDGE_CGO_CXXFLAGS := $(BRIDGE_MIN_VERSION_FLAG)
BRIDGE_CGO_LDFLAGS := $(BRIDGE_MIN_VERSION_FLAG) -Wl,-no_warn_duplicate_libraries
LOCAL_ENV_ZSH := source ~/.zshrc; if [[ -f "$(ENV_LOCAL)" ]]; then set -a; source "$(ENV_LOCAL)"; set +a; fi
ANDROID_LOCAL_ENV_ZSH := $(LOCAL_ENV_ZSH); sdk_root="$${ANDROID_HOME:-$${ANDROID_SDK_ROOT}}"; if [[ -z "$$sdk_root" ]]; then echo "ANDROID_HOME or ANDROID_SDK_ROOT is required" >&2; exit 1; fi

.PHONY: bridge bridge-arm64 bridge-amd64 bridge-universal android-bridge android-bridge-sync smoke analyze test run android-emulator android-run

bridge: bridge-universal

bridge-arm64:
	@mkdir -p $(dir $(BRIDGE_ARM64_OUT))
	DEVELOPER_DIR=$(DEVELOPER_DIR) \
	SDKROOT=$(BRIDGE_SDKROOT) \
	MACOSX_DEPLOYMENT_TARGET=$(MACOSX_DEPLOYMENT_TARGET) \
	CGO_ENABLED=1 \
	GOOS=darwin \
	GOARCH=arm64 \
	CC="$$(DEVELOPER_DIR=$(DEVELOPER_DIR) xcrun --find clang)" \
	CXX="$$(DEVELOPER_DIR=$(DEVELOPER_DIR) xcrun --find clang++)" \
	CGO_CFLAGS="-isysroot $(BRIDGE_SDKROOT) -arch arm64 $(BRIDGE_CGO_CFLAGS)" \
	CGO_CXXFLAGS="-isysroot $(BRIDGE_SDKROOT) -arch arm64 $(BRIDGE_CGO_CXXFLAGS)" \
	CGO_LDFLAGS="-isysroot $(BRIDGE_SDKROOT) -arch arm64 $(BRIDGE_CGO_LDFLAGS)" \
	go build -buildmode=c-shared -o $(BRIDGE_ARM64_OUT) ./bridge

bridge-amd64:
	@mkdir -p $(dir $(BRIDGE_AMD64_OUT))
	DEVELOPER_DIR=$(DEVELOPER_DIR) \
	SDKROOT=$(BRIDGE_SDKROOT) \
	MACOSX_DEPLOYMENT_TARGET=$(MACOSX_DEPLOYMENT_TARGET) \
	CGO_ENABLED=1 \
	GOOS=darwin \
	GOARCH=amd64 \
	CC="$$(DEVELOPER_DIR=$(DEVELOPER_DIR) xcrun --find clang)" \
	CXX="$$(DEVELOPER_DIR=$(DEVELOPER_DIR) xcrun --find clang++)" \
	CGO_CFLAGS="-isysroot $(BRIDGE_SDKROOT) -arch x86_64 $(BRIDGE_CGO_CFLAGS)" \
	CGO_CXXFLAGS="-isysroot $(BRIDGE_SDKROOT) -arch x86_64 $(BRIDGE_CGO_CXXFLAGS)" \
	CGO_LDFLAGS="-isysroot $(BRIDGE_SDKROOT) -arch x86_64 $(BRIDGE_CGO_LDFLAGS)" \
	go build -buildmode=c-shared -o $(BRIDGE_AMD64_OUT) ./bridge

bridge-universal: bridge-arm64 bridge-amd64
	lipo -create -output $(BRIDGE_OUT) $(BRIDGE_ARM64_OUT) $(BRIDGE_AMD64_OUT)

android-bridge:
	@mkdir -p $(ANDROID_BRIDGE_DIR)
	zsh -lc '$(ANDROID_LOCAL_ENV_ZSH); \
		ndk_root="$$sdk_root/ndk/$(ANDROID_NDK_VERSION)"; \
		candidate_tags=("$(ANDROID_NDK_HOST_TAG)" darwin-arm64 darwin-x86_64 linux-x86_64 windows-x86_64); \
		host_tag=""; \
		for candidate in $${candidate_tags[@]}; do \
			[[ -n "$$candidate" ]] || continue; \
			if [[ -d "$$ndk_root/toolchains/llvm/prebuilt/$$candidate/bin" ]]; then \
				host_tag="$$candidate"; \
				break; \
			fi; \
		done; \
		if [[ -z "$$host_tag" ]]; then \
			echo "Missing Android NDK prebuilt toolchain under $$ndk_root/toolchains/llvm/prebuilt" >&2; \
			find "$$ndk_root/toolchains/llvm/prebuilt" -maxdepth 1 -mindepth 1 -type d -print >&2; \
			exit 1; \
		fi; \
		ndk_bin="$$ndk_root/toolchains/llvm/prebuilt/$$host_tag/bin"; \
		test -d "$$ndk_bin" || { echo "Missing Android NDK toolchain: $$ndk_bin" >&2; exit 1; }; \
		env CGO_ENABLED=1 GOOS=android GOARCH=arm64 \
		CC="$$ndk_bin/aarch64-linux-android24-clang" \
		CXX="$$ndk_bin/aarch64-linux-android24-clang++" \
		AR="$$ndk_bin/llvm-ar" \
		go build -buildmode=c-shared -o "$(ANDROID_BRIDGE_OUT)" ./bridge'

android-bridge-sync: android-bridge
	@mkdir -p $(ANDROID_JNILIBS_DIR)
	cp $(ANDROID_BRIDGE_OUT) $(ANDROID_JNILIBS_OUT)

smoke: bridge
	dart run tool/bridge_smoke.dart

analyze:
	flutter analyze

test:
	go test ./...

run: bridge
	DEVELOPER_DIR=$(DEVELOPER_DIR) flutter run -d $(FLUTTER_DEVICE)

android-emulator:
	zsh -lc '$(ANDROID_LOCAL_ENV_ZSH); \
		device_serial="$$(adb devices | awk "/^emulator-/{print \$$1; exit}")"; \
		if [[ -z "$$device_serial" ]]; then \
			flutter emulators --launch "$(ANDROID_EMULATOR)"; \
			adb wait-for-device; \
			until [[ "$$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d "\r")" == "1" ]]; do sleep 2; done; \
			device_serial="$$(adb devices | awk "/^emulator-/{print \$$1; exit}")"; \
		fi; \
		if [[ -z "$$device_serial" ]]; then \
			echo "Android emulator $(ANDROID_EMULATOR) did not become available" >&2; \
			exit 1; \
		fi; \
		echo "Using Android emulator $$device_serial"; \
		flutter devices'

android-run: android-bridge-sync
	zsh -lc '$(ANDROID_LOCAL_ENV_ZSH); \
		device_serial="$$(adb devices | awk "/^emulator-/{print \$$1; exit}")"; \
		if [[ -z "$$device_serial" ]]; then \
			$(MAKE) android-emulator; \
			device_serial="$$(adb devices | awk "/^emulator-/{print \$$1; exit}")"; \
		fi; \
		if [[ -z "$$device_serial" ]]; then \
			echo "No Android emulator is available for flutter run" >&2; \
			exit 1; \
		fi; \
		echo "Starting Flutter on $$device_serial"; \
		flutter run -d "$$device_serial" --debug'
