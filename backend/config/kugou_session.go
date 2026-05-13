package config

import (
	"bytes"
	"encoding/json"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Kugou session is persisted separately from settings so auth cookies stay isolated and replaceable.
type KugouSession struct {
	Cookie              map[string]string `json:"cookie,omitempty"`
	LastUserID          string            `json:"last_user_id,omitempty"`
	LastBenefitSyncDate string            `json:"last_benefit_sync_date,omitempty"`
	LastBenefitSyncAt   string            `json:"last_benefit_sync_at,omitempty"`
	LastBenefitStatus   string            `json:"last_benefit_status,omitempty"`
	LastSignedDate      string            `json:"last_signed_date,omitempty"`
	LastVIPExpireAt     string            `json:"last_vip_expire_at,omitempty"`
	UpdatedAt           string            `json:"updated_at,omitempty"`
}

func kugouSessionPath() string {
	return filepath.Join(ConfigDir(), "kugou_session.json")
}

func LoadKugouSession() KugouSession {
	session := KugouSession{Cookie: map[string]string{}}
	data, err := os.ReadFile(kugouSessionPath())
	if err != nil {
		return session
	}
	if err := json.Unmarshal(data, &session); err != nil {
		trimmed := bytes.TrimSpace(data)
		for len(trimmed) > 0 {
			if json.Unmarshal(trimmed, &session) == nil {
				_ = os.WriteFile(kugouSessionPath(), trimmed, 0o600)
				break
			}
			index := bytes.LastIndexByte(trimmed[:len(trimmed)-1], '}')
			if index < 0 {
				break
			}
			trimmed = bytes.TrimSpace(trimmed[:index+1])
		}
	}
	if session.Cookie == nil {
		session.Cookie = map[string]string{}
	}
	normalizeKugouSessionUserID(&session)
	return session
}

func SaveKugouSession(session KugouSession) error {
	if session.Cookie == nil {
		session.Cookie = map[string]string{}
	}
	normalizeKugouSessionUserID(&session)
	session.UpdatedAt = time.Now().Format(time.RFC3339)
	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return err
	}
	path := kugouSessionPath()
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func ClearKugouSession() error {
	if err := os.Remove(kugouSessionPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// normalizeKugouSessionUserID converts persisted scientific-notation user IDs back to plain integers.
func normalizeKugouSessionUserID(session *KugouSession) {
	if session == nil || session.Cookie == nil {
		return
	}
	userID := normalizeKugouUserIDString(session.Cookie["userid"])
	if userID != "" {
		session.Cookie["userid"] = userID
		session.LastUserID = userID
	}
}

func normalizeKugouUserIDString(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if !strings.ContainsAny(trimmed, ".eE") {
		return trimmed
	}
	value, ok := new(big.Float).SetString(trimmed)
	if !ok {
		return trimmed
	}
	text := value.Text('f', 0)
	if text == "" {
		return trimmed
	}
	return text
}
