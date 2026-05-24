# Make targets keep the Go bridge and Flutter macOS launch path consistent.

DEVELOPER_DIR ?= /Applications/Xcode.app/Contents/Developer
FLUTTER_DEVICE ?= macos
MACOSX_DEPLOYMENT_TARGET ?= 11.0
BRIDGE_OUT := bin/bridge/libcloudplayer_bridge.dylib
BRIDGE_MIN_VERSION_FLAG := -mmacosx-version-min=$(MACOSX_DEPLOYMENT_TARGET)
BRIDGE_CGO_CFLAGS := $(BRIDGE_MIN_VERSION_FLAG)
BRIDGE_CGO_CXXFLAGS := $(BRIDGE_MIN_VERSION_FLAG)
BRIDGE_CGO_LDFLAGS := $(BRIDGE_MIN_VERSION_FLAG) -Wl,-no_warn_duplicate_libraries

.PHONY: bridge smoke analyze test run

bridge:
	@mkdir -p $(dir $(BRIDGE_OUT))
	DEVELOPER_DIR=$(DEVELOPER_DIR) \
	MACOSX_DEPLOYMENT_TARGET=$(MACOSX_DEPLOYMENT_TARGET) \
	CGO_CFLAGS="$(BRIDGE_CGO_CFLAGS)" \
	CGO_CXXFLAGS="$(BRIDGE_CGO_CXXFLAGS)" \
	CGO_LDFLAGS="$(BRIDGE_CGO_LDFLAGS)" \
	go build -buildmode=c-shared -o $(BRIDGE_OUT) ./bridge

smoke: bridge
	dart run tool/bridge_smoke.dart

analyze:
	flutter analyze

test:
	go test ./...

run: bridge
	DEVELOPER_DIR=$(DEVELOPER_DIR) flutter run -d $(FLUTTER_DEVICE)
