package main

// Settings dispatch owns preference, diagnostics, and misc utility bridge methods.

import (
	"encoding/json"

	cloudplayer "cloudplayer/backend/app"
	"cloudplayer/backend/config"
)

type stringValueArgs struct {
	Value string `json:"value"`
}

type pathArgs struct {
	Path string `json:"path"`
}

type trayLabelArgs struct {
	Text string `json:"text"`
}

type frontendDebugArgs struct {
	Scope  string `json:"scope"`
	Stage  string `json:"stage"`
	Detail string `json:"detail"`
}

type playEventArgs struct {
	Stage     string  `json:"stage"`
	URL       *string `json:"url,omitempty"`
	ErrorCode *int    `json:"error_code,omitempty"`
	Message   *string `json:"message,omitempty"`
	Extra     *string `json:"extra,omitempty"`
}

func invokeSettingsMethod(runtime *bridgeRuntime, method string, args json.RawMessage) (any, bool, error) {
	switch method {
	case "get_settings":
		return runtime.service.GetSettings(), true, nil
	case "save_settings":
		patch, err := decodeArgs[cloudplayer.SettingsPatch](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.SaveSettings(patch)
	case "reset_desktop_lyrics_bounds":
		return nil, true, runtime.service.ResetDesktopLyricsBounds()
	case "validate_accelerator":
		payload, err := decodeArgs[stringValueArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.ValidateAccelerator(payload.Value)
	case "apply_global_hotkeys":
		payload, err := decodeArgs[config.GlobalHotkeys](args)
		if err != nil {
			return nil, true, err
		}
		report, callErr := runtime.service.ApplyGlobalHotkeys(payload)
		return report, true, callErr
	case "db_status":
		status, callErr := runtime.service.DBStatus()
		return status, true, callErr
	case "get_runtime_info":
		return map[string]any{
			"media_proxy_base": runtime.mediaProxyBase,
		}, true, nil
	case "clear_search_cache":
		return runtime.service.ClearSearchCache(), true, nil
	case "get_app_log_path":
		path, callErr := runtime.service.GetAppLogPath()
		return path, true, callErr
	case "open_app_log_location":
		return nil, true, runtime.service.OpenAppLogLocation()
	case "local_path_accessible":
		payload, err := decodeArgs[pathArgs](args)
		if err != nil {
			return nil, true, err
		}
		return runtime.service.LocalPathAccessible(payload.Path), true, nil
	case "log_frontend_debug":
		payload, err := decodeArgs[frontendDebugArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.LogFrontendDebug(payload.Scope, payload.Stage, payload.Detail)
	case "log_play_event":
		payload, err := decodeArgs[playEventArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.LogPlayEvent(payload.Stage, payload.URL, payload.ErrorCode, payload.Message, payload.Extra)
	case "set_tray_label":
		payload, err := decodeArgs[trayLabelArgs](args)
		if err != nil {
			return nil, true, err
		}
		return nil, true, runtime.service.SetTrayLabel(payload.Text)
	default:
		return nil, false, nil
	}
}
