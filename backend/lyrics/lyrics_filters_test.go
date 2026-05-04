package lyrics

import "testing"

// Test placeholder filters against the real bad Kugou results seen during replacement regression.
func TestLooksLikeUnavailableLyric(t *testing.T) {
	cases := []struct {
		name  string
		text  string
		match bool
	}{
		{name: "empty", text: "", match: true},
		{name: "kugou slogan", text: "[00:00.00]酷狗音乐  就是歌多", match: true},
		{name: "pure music", text: "[00:00.00]纯音乐，请欣赏", match: true},
		{name: "instrumental", text: "Instrumental", match: true},
		{name: "normal lyric", text: "[00:01.00]风吹过旧城", match: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := looksLikeUnavailableLyric(tc.text); got != tc.match {
				t.Fatalf("looksLikeUnavailableLyric(%q) = %v, want %v", tc.text, got, tc.match)
			}
		})
	}
}

func TestKugouCandidateLooksUnavailable(t *testing.T) {
	cases := []struct {
		name  string
		hit   kugouSearchHit
		match bool
	}{
		{name: "empty title", hit: kugouSearchHit{}, match: true},
		{name: "kugou placeholder", hit: kugouSearchHit{Title: "酷狗音乐", Artist: "酷狗音乐"}, match: true},
		{name: "pure music title", hit: kugouSearchHit{Title: "纯音乐", Album: "纯音乐合集"}, match: true},
		{name: "instrumental album", hit: kugouSearchHit{Title: "Theme", Album: "Instrumental"}, match: true},
		{name: "normal song", hit: kugouSearchHit{Title: "三万天", Artist: "王子健 / 兰音Reine", Album: "三万天"}, match: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := kugouCandidateLooksUnavailable(tc.hit); got != tc.match {
				t.Fatalf("kugouCandidateLooksUnavailable(%+v) = %v, want %v", tc.hit, got, tc.match)
			}
		})
	}
}
