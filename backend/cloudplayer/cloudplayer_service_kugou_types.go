package cloudplayer

// Kugou-specific DTOs stay in their own file so auth and import bindings can evolve without bloating the global type list.
type KugouLoginQRCode struct {
	Key      string `json:"key"`
	URL      string `json:"url"`
	Base64   string `json:"base64"`
	ExpireIn int    `json:"expire_in"`
}

type KugouLoginStatus struct {
	Status    string  `json:"status"`
	LoggedIn  bool    `json:"logged_in"`
	UserID    string  `json:"user_id,omitempty"`
	Nickname  *string `json:"nickname,omitempty"`
	AvatarURL *string `json:"avatar_url,omitempty"`
}

type KugouCaptchaResult struct {
	Sent    bool   `json:"sent"`
	Message string `json:"message,omitempty"`
}

type KugouPlaylistRow struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	CoverURL   *string `json:"cover_url,omitempty"`
	TrackCount int     `json:"track_count"`
}

type KugouImportSelection struct {
	ListIDs []int64 `json:"list_ids"`
}
