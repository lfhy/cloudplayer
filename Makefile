# Make targets keep the Go bridge and Flutter macOS launch path consistent.

DEVELOPER_DIR ?= /Applications/Xcode.app/Contents/Developer
FLUTTER_DEVICE ?= macos
MACOSX_DEPLOYMENT_TARGET ?= 11.0
BRIDGE_OUT := bin/bridge/libcloudplayer_bridge.dylib
BRIDGE_ARM64_OUT := bin/bridge/libcloudplayer_bridge-arm64.dylib
BRIDGE_AMD64_OUT := bin/bridge/libcloudplayer_bridge-amd64.dylib
BRIDGE_MIN_VERSION_FLAG := -mmacosx-version-min=$(MACOSX_DEPLOYMENT_TARGET)
BRIDGE_SDKROOT := $(shell DEVELOPER_DIR=$(DEVELOPER_DIR) xcrun --sdk macosx --show-sdk-path)
BRIDGE_CGO_CFLAGS := $(BRIDGE_MIN_VERSION_FLAG)
BRIDGE_CGO_CXXFLAGS := $(BRIDGE_MIN_VERSION_FLAG)
BRIDGE_CGO_LDFLAGS := $(BRIDGE_MIN_VERSION_FLAG) -Wl,-no_warn_duplicate_libraries

.PHONY: bridge bridge-arm64 bridge-amd64 bridge-universal smoke analyze test run

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

smoke: bridge
	dart run tool/bridge_smoke.dart

analyze:
	flutter analyze

test:
	go test ./...

run: bridge
	DEVELOPER_DIR=$(DEVELOPER_DIR) flutter run -d $(FLUTTER_DEVICE)
