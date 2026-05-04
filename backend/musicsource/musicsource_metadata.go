package musicsource

import (
	"net/http"
	"strings"
)

// SearchMetadata fills search rows with song-page metadata that the source list page does not expose.
type SearchMetadata struct {
	SourceID   string `json:"source_id"`
	Album      string `json:"album"`
	DurationMS int64  `json:"duration_ms"`
}

func FetchSearchMetadata(client *http.Client, sourceID string) (SearchMetadata, error) {
	ref, err := ParseSourceID(sourceID)
	if err != nil {
		return SearchMetadata{}, err
	}
	html, err := ref.Provider.FetchSongPageHTML(client, ref.RawID)
	if err != nil {
		return SearchMetadata{}, err
	}
	return SearchMetadata{
		SourceID:   ref.EncodedID,
		Album:      strings.TrimSpace(ref.Provider.ExtractAlbumFromSongHTML(html)),
		DurationMS: ref.Provider.ExtractDurationMSFromSongHTML(html),
	}, nil
}
