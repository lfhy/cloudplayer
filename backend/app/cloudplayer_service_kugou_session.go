package cloudplayer

import (
	"context"
	"fmt"
	"strings"

	"cloudplayer/backend/config"
	kg "github.com/lfhy/kugou-music-api"
)

// Kugou session helpers keep login state persistence separate from playlist import logic.
func kugouClientFromSession() (*kg.Client, config.KugouSession, error) {
	session := config.LoadKugouSession()
	client, err := kg.New(kg.WithLite(true), kg.WithCookie(session.Cookie))
	if err != nil {
		return nil, session, err
	}
	return client, session, nil
}

func (s *CloudPlayerService) GetKugouLoginStatus() (KugouLoginStatus, error) {
	client, session, err := kugouClientFromSession()
	if err != nil {
		return KugouLoginStatus{}, err
	}
	if strings.TrimSpace(session.Cookie["token"]) == "" || strings.TrimSpace(session.Cookie["userid"]) == "" {
		return KugouLoginStatus{Status: "logged_out", LoggedIn: false}, nil
	}
	resp, err := client.UserDetail(context.Background(), kg.UserDetailRequest{})
	if err != nil {
		return KugouLoginStatus{Status: "expired", LoggedIn: false, UserID: strings.TrimSpace(session.Cookie["userid"])}, nil
	}
	_ = saveKugouClientSession(client)
	s.maybeSyncKugouBenefits(context.Background())
	nickname := strings.TrimSpace(kugouBodyString(resp.Body, "nickname", "k_nickname", "name", "username", "user_name"))
	avatarURL := kugouNormalizeAssetURL(kugouBodyString(resp.Body, "pic", "k_pic", "fx_pic", "avatar", "headimg", "user_pic", "bg_pic"))
	status := KugouLoginStatus{
		Status:   "logged_in",
		LoggedIn: true,
		UserID:   strings.TrimSpace(client.Cookie()["userid"]),
	}
	if nickname != "" {
		status.Nickname = &nickname
	}
	if avatarURL != "" {
		status.AvatarURL = &avatarURL
	}
	return status, nil
}

func (s *CloudPlayerService) CreateKugouLoginQRCode() (KugouLoginQRCode, error) {
	client, _, err := kugouClientFromSession()
	if err != nil {
		return KugouLoginQRCode{}, err
	}
	keyResp, err := client.LoginQrKey(context.Background(), kg.LoginQrKeyRequest{})
	if err != nil {
		return KugouLoginQRCode{}, err
	}
	key := strings.TrimSpace(keyResp.QRCodeKey())
	if key == "" {
		return KugouLoginQRCode{}, fmt.Errorf("未获取到酷狗登录二维码 key")
	}
	createResp, err := client.LoginQrCreate(context.Background(), kg.LoginQrCreateRequest{Key: key, Qrimg: true})
	if err != nil {
		return KugouLoginQRCode{}, err
	}
	return KugouLoginQRCode{
		Key:      key,
		URL:      strings.TrimSpace(createResp.URL()),
		Base64:   strings.TrimSpace(createResp.Base64()),
		ExpireIn: 120,
	}, nil
}

func (s *CloudPlayerService) PollKugouLoginQRCode(key string) (KugouLoginStatus, error) {
	client, _, err := kugouClientFromSession()
	if err != nil {
		return KugouLoginStatus{}, err
	}
	resp, err := client.LoginQrCheck(context.Background(), kg.LoginQrCheckRequest{Key: strings.TrimSpace(key)})
	if err != nil {
		return KugouLoginStatus{}, err
	}
	switch resp.StatusCode() {
	case 1:
		return KugouLoginStatus{Status: "waiting", LoggedIn: false}, nil
	case 2:
		return KugouLoginStatus{Status: "scanned", LoggedIn: false}, nil
	case 4:
		previousUserID := kugouSessionUserID(config.LoadKugouSession())
		if err := saveKugouClientSession(client); err != nil {
			return KugouLoginStatus{}, err
		}
		nextUserID := strings.TrimSpace(client.Cookie()["userid"])
		if err := s.afterKugouSessionMutation(previousUserID, nextUserID); err != nil {
			return KugouLoginStatus{}, err
		}
		s.maybeSyncKugouBenefits(context.Background())
		return s.GetKugouLoginStatus()
	default:
		return KugouLoginStatus{Status: "expired", LoggedIn: false}, nil
	}
}

func (s *CloudPlayerService) LogoutKugou() error {
	previousUserID := kugouSessionUserID(config.LoadKugouSession())
	if err := config.ClearKugouSession(); err != nil {
		return err
	}
	settings := config.LoadSettings()
	if settings.MusicOnlineMode || config.NormalizeMusicCollectionMode(settings.MusicCollectionMode) != config.MusicCollectionModeOffline {
		settings.MusicOnlineMode = false
		settings.MusicCollectionMode = config.MusicCollectionModeOffline
		if err := config.SaveSettings(settings); err != nil {
			return err
		}
	}
	return s.afterKugouSessionMutation(previousUserID, "")
}
