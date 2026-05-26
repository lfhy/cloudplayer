package main

// Method dispatch routes JSON bridge calls to feature-specific handlers.

import (
	"encoding/json"
	"fmt"
	"strings"
)

func invokeBridgeMethod(method string, args json.RawMessage) (any, error) {
	normalized := strings.ToLower(strings.TrimSpace(method))
	if normalized == "" {
		return nil, fmt.Errorf("bridge method is required")
	}
	if result, handled, err := invokeBootstrapMethod(normalized, args); handled {
		return result, err
	}

	runtime, err := ensureRuntime()
	if err != nil {
		return nil, err
	}

	if result, handled, err := invokeSettingsMethod(runtime, normalized, args); handled {
		return result, err
	}
	if result, handled, err := invokeLibraryMethod(runtime, normalized, args); handled {
		return result, err
	}
	if result, handled, err := invokePlaybackMethod(runtime, normalized, args); handled {
		return result, err
	}
	if result, handled, err := invokeKugouMethod(runtime, normalized, args); handled {
		return result, err
	}

	return nil, fmt.Errorf("unsupported bridge method: %s", normalized)
}
