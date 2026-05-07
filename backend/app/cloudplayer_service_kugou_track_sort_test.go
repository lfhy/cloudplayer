package cloudplayer

import "testing"

// Track ordering should prefer the most recent Kugou timestamp first.
func TestSortKugouPlaylistTracksByTimeDesc(t *testing.T) {
	items := []map[string]any{
		{"songname": "first", "hash": "a", "addtime": 100},
		{"songname": "second", "hash": "b", "addtime": 300},
		{"songname": "third", "hash": "c", "addtime": 200},
	}

	sortKugouPlaylistTracksByTime(items)

	got := []string{
		kugouMapString(items[0], "songname"),
		kugouMapString(items[1], "songname"),
		kugouMapString(items[2], "songname"),
	}
	want := []string{"second", "third", "first"}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("unexpected track order at %d: got %q want %q", index, got[index], want[index])
		}
	}
}
