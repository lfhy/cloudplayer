package main

// JSON helpers keep the bridge payload format consistent across all feature handlers.

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type bridgeEnvelope struct {
	OK     bool         `json:"ok"`
	Result any          `json:"result,omitempty"`
	Error  *bridgeError `json:"error,omitempty"`
}

type bridgeError struct {
	Message string `json:"message"`
}

func buildSuccessPayload(result any) string {
	payload, err := json.Marshal(bridgeEnvelope{
		OK:     true,
		Result: result,
	})
	if err != nil {
		return buildErrorPayload(fmt.Errorf("marshal bridge success payload: %w", err))
	}
	return string(payload)
}

func buildErrorPayload(err error) string {
	payload, marshalErr := json.Marshal(bridgeEnvelope{
		OK: false,
		Error: &bridgeError{
			Message: err.Error(),
		},
	})
	if marshalErr != nil {
		return `{"ok":false,"error":{"message":"bridge marshal failure"}}`
	}
	return string(payload)
}

func decodeArgs[T any](raw json.RawMessage) (T, error) {
	var zero T
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		trimmed = []byte("{}")
	}
	if err := json.Unmarshal(trimmed, &zero); err != nil {
		return zero, err
	}
	return zero, nil
}
