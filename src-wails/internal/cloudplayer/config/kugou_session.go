package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// Kugou session is persisted separately from settings so auth cookies stay isolated and replaceable.
type KugouSession struct {
	Cookie     map[string]string `json:"cookie,omitempty"`
	LastUserID string            `json:"last_user_id,omitempty"`
	UpdatedAt  string            `json:"updated_at,omitempty"`
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
	_ = json.Unmarshal(data, &session)
	if session.Cookie == nil {
		session.Cookie = map[string]string{}
	}
	return session
}

func SaveKugouSession(session KugouSession) error {
	if session.Cookie == nil {
		session.Cookie = map[string]string{}
	}
	session.UpdatedAt = time.Now().Format(time.RFC3339)
	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(kugouSessionPath(), data, 0o600)
}

func ClearKugouSession() error {
	if err := os.Remove(kugouSessionPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
