package cloudplayer

import (
	"context"
	"fmt"
	"strings"

	kg "github.com/lfhy/kugou-music-api"
)

// SMS auth stays separate from QR auth so the two login flows remain easy to wire independently in the UI.
func (s *CloudPlayerService) SendKugouLoginCaptcha(mobile string) (KugouCaptchaResult, error) {
	client, _, err := kugouClientFromSession()
	if err != nil {
		return KugouCaptchaResult{}, err
	}
	trimmed := strings.TrimSpace(mobile)
	if trimmed == "" {
		return KugouCaptchaResult{}, fmt.Errorf("请输入手机号")
	}
	resp, err := client.SendCaptcha(context.Background(), kg.SendCaptchaRequest{Mobile: trimmed, Cookie: client.Cookie()})
	if err != nil {
		return KugouCaptchaResult{}, err
	}
	status := strings.TrimSpace(kugouBodyString(resp.Body, "status"))
	message := strings.TrimSpace(kugouBodyString(resp.Body, "error", "message", "msg"))
	if status != "1" {
		if message == "" {
			message = "验证码发送失败"
		}
		return KugouCaptchaResult{}, fmt.Errorf(message)
	}
	_ = saveKugouClientSession(client)
	if message == "" {
		message = "验证码已发送"
	}
	return KugouCaptchaResult{Sent: true, Message: message}, nil
}

func (s *CloudPlayerService) LoginKugouByCellphone(mobile, code string) (KugouLoginStatus, error) {
	client, session, err := kugouClientFromSession()
	if err != nil {
		return KugouLoginStatus{}, err
	}
	trimmedMobile := strings.TrimSpace(mobile)
	trimmedCode := strings.TrimSpace(code)
	if trimmedMobile == "" || trimmedCode == "" {
		return KugouLoginStatus{}, fmt.Errorf("请输入手机号和验证码")
	}
	resp, err := client.LoginByCellphone(context.Background(), kg.CellphoneLoginRequest{
		Mobile: trimmedMobile,
		Code:   trimmedCode,
		UserID: strings.TrimSpace(session.LastUserID),
		Cookie: client.Cookie(),
	})
	if err != nil {
		return KugouLoginStatus{}, err
	}
	if strings.TrimSpace(kugouBodyString(resp.Body, "status")) != "1" {
		message := strings.TrimSpace(kugouBodyString(resp.Body, "error", "message", "msg"))
		if message == "" {
			message = "酷狗登录失败"
		}
		return KugouLoginStatus{}, fmt.Errorf(message)
	}
	if err := saveKugouClientSession(client); err != nil {
		return KugouLoginStatus{}, err
	}
	return s.GetKugouLoginStatus()
}
