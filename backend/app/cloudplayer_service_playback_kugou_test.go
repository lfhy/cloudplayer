package cloudplayer

import (
	"testing"

	kg "github.com/lfhy/kugou-music-api"
)

// Kugou playback helpers should reject preview and image URLs before the player proxies them.
func TestPickKugouAudioURL(t *testing.T) {
	result := &kg.SongPlayURLResult{
		Primary: "https://example.com/cover.jpg",
		URLs: []string{
			"https://fs.example.com/p_0_960131/test.mp3",
			"https://fs.example.com/full-track.flac",
		},
	}
	if got := pickKugouAudioURL(result); got != "https://fs.example.com/full-track.flac" {
		t.Fatalf("pickKugouAudioURL() = %q", got)
	}
}

func TestScoreFallbackCandidate(t *testing.T) {
	exact := scoreFallbackCandidate("Song Name", "Artist A", "Song Name", "Artist A")
	partial := scoreFallbackCandidate("Song Name Live", "Artist A", "Song Name", "Artist A")
	miss := scoreFallbackCandidate("Another Song", "Artist B", "Song Name", "Artist A")
	if !(exact > partial && partial > miss) {
		t.Fatalf("unexpected scores exact=%d partial=%d miss=%d", exact, partial, miss)
	}
}
