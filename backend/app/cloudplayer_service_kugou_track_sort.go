package cloudplayer

import "sort"

// Kugou track sorting keeps cloud playlist items in newest-first order when payload timestamps are available.
func sortKugouPlaylistTracksByTime(items []map[string]any) {
	sort.SliceStable(items, func(i, j int) bool {
		leftAt := kugouTrackSortTimestamp(items[i])
		rightAt := kugouTrackSortTimestamp(items[j])
		if leftAt == rightAt {
			return false
		}
		return leftAt > rightAt
	})
}
