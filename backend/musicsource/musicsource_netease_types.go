package musicsource

// Netease response models are intentionally minimal and only include fields used by the provider.

type neteaseCloudSearchResponse struct {
	Code   int `json:"code"`
	Result struct {
		SongCount int                 `json:"songCount"`
		Songs     []neteaseSearchSong `json:"songs"`
	} `json:"result"`
}

type neteasePortalSearchResponse struct {
	Code   int `json:"code"`
	Result struct {
		SongCount int                 `json:"songCount"`
		Songs     []neteaseSearchSong `json:"songs"`
	} `json:"result"`
}

type neteaseSearchSong struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	DT   int64  `json:"dt"`
	AL   struct {
		Name   string `json:"name"`
		PicURL string `json:"picUrl"`
	} `json:"al"`
	Ar []struct {
		Name string `json:"name"`
	} `json:"ar"`
	Artists []struct {
		Name string `json:"name"`
	} `json:"artists"`
	Album struct {
		Name   string `json:"name"`
		PicURL string `json:"picUrl"`
	} `json:"album"`
}

type neteasePlayerResponse struct {
	Code int `json:"code"`
	Data []struct {
		ID   int64  `json:"id"`
		URL  string `json:"url"`
		Time int64  `json:"time"`
		Code int    `json:"code"`
	} `json:"data"`
}

type neteaseLyricResponse struct {
	Code int `json:"code"`
	Lrc  struct {
		Lyric string `json:"lyric"`
	} `json:"lrc"`
}

type neteaseDailySongResponse struct {
	Code int `json:"code"`
	Data struct {
		DailySongs []neteaseSearchSong `json:"dailySongs"`
	} `json:"data"`
}

type neteasePersonalizedSongResponse struct {
	Code   int `json:"code"`
	Result struct {
		Songs []neteaseSearchSong `json:"songs"`
	} `json:"result"`
}
