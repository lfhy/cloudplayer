package config

import "testing"

// Playback fallback normalization keeps legacy settings compatible when new providers land.
func TestNormalizePlaybackFallbackChainAppendsMissingProviders(t *testing.T) {
	if got := NormalizePlaybackFallbackChain("kugou,pjmp3,netease"); got != "kugou,pjmp3,netease,gequhai" {
		t.Fatalf("NormalizePlaybackFallbackChain() = %q", got)
	}
	if got := NormalizePlaybackFallbackChain("netease,kugou"); got != "netease,kugou,pjmp3,gequhai" {
		t.Fatalf("NormalizePlaybackFallbackChain() reorder = %q", got)
	}
	if got := NormalizePlaybackFallbackChain(""); got != "kugou,pjmp3,netease,gequhai" {
		t.Fatalf("NormalizePlaybackFallbackChain() empty = %q", got)
	}
}
