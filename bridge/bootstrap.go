package main

// Bootstrap methods configure the runtime host before the bridge touches disk.

import (
	"encoding/json"

	"cloudplayer/backend/config"
)

type runtimeInitArgs struct {
	ConfigDir string `json:"config_dir"`
}

func invokeBootstrapMethod(method string, args json.RawMessage) (any, bool, error) {
	switch method {
	case "initialize_runtime":
		payload, err := decodeArgs[runtimeInitArgs](args)
		if err != nil {
			return nil, true, err
		}
		config.SetConfigDir(payload.ConfigDir)
		return nil, true, nil
	default:
		return nil, false, nil
	}
}
