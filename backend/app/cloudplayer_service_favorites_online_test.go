package cloudplayer

import "testing"

// Online favorites helpers should extract source ids and file ids from cached Kugou playlist rows.
func TestKugouFavoriteHelpers(t *testing.T) {
	rows := []PlaylistImportItemRow{
		{Pjmp3SourceID: "kugou:a", KugouFileID: 101},
		{Pjmp3SourceID: "kugou:b", KugouFileID: 0},
		{Pjmp3SourceID: "kugou:a", KugouFileID: 202},
	}
	ids := favoriteSourceIDsFromRows(rows)
	if len(ids) != 3 || ids[0] != "kugou:a" || ids[2] != "kugou:a" {
		t.Fatalf("unexpected source ids: %+v", ids)
	}
	fileIDs := kugouFileIDsForSourceID(rows, "kugou:a")
	if len(fileIDs) != 2 || fileIDs[0] != 101 || fileIDs[1] != 202 {
		t.Fatalf("unexpected file ids: %+v", fileIDs)
	}
}
