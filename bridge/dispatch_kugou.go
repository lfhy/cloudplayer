package main

// Kugou dispatch groups auth, playlist sync, and account-specific bridge methods.

import "encoding/json"

type keyArgs struct {
	Key string `json:"key"`
}

type mobileArgs struct {
	Mobile string `json:"mobile"`
}

type kugouCellphoneLoginArgs struct {
	Mobile string `json:"mobile"`
	Code   string `json:"code"`
}

type kugouPlaylistIDArgs struct {
	ListID int64 `json:"list_id"`
}

type kugouPlaylistIDsArgs struct {
	ListIDs []int64 `json:"list_ids"`
}

func invokeKugouMethod(runtime *bridgeRuntime, method string, args json.RawMessage) (any, bool, error) {
	switch method {
	case "get_kugou_login_status":
		status, callErr := runtime.service.GetKugouLoginStatus()
		return status, true, callErr
	case "create_kugou_login_qr_code":
		result, callErr := runtime.service.CreateKugouLoginQRCode()
		return result, true, callErr
	case "poll_kugou_login_qr_code":
		payload, err := decodeArgs[keyArgs](args)
		if err != nil {
			return nil, true, err
		}
		status, callErr := runtime.service.PollKugouLoginQRCode(payload.Key)
		return status, true, callErr
	case "logout_kugou":
		return nil, true, runtime.service.LogoutKugou()
	case "send_kugou_login_captcha":
		payload, err := decodeArgs[mobileArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.SendKugouLoginCaptcha(payload.Mobile)
		return result, true, callErr
	case "login_kugou_by_cellphone":
		payload, err := decodeArgs[kugouCellphoneLoginArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.LoginKugouByCellphone(payload.Mobile, payload.Code)
		return result, true, callErr
	case "list_kugou_playlists":
		rows, callErr := runtime.service.ListKugouPlaylists()
		return rows, true, callErr
	case "sync_kugou_playlist":
		payload, err := decodeArgs[kugouPlaylistIDArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.SyncKugouPlaylist(payload.ListID)
		return result, true, callErr
	case "sync_kugou_playlists":
		payload, err := decodeArgs[kugouPlaylistIDsArgs](args)
		if err != nil {
			return nil, true, err
		}
		result, callErr := runtime.service.SyncKugouPlaylists(payload.ListIDs)
		return result, true, callErr
	default:
		return nil, false, nil
	}
}
