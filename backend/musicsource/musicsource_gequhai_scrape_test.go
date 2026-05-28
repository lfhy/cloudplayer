package musicsource

import "testing"

// Gequhai parser tests pin the scraped HTML structure so future site changes fail loudly.
func TestGequhaiParseSearchResults(t *testing.T) {
	pageHTML := `
	<table>
	  <tbody>
	    <tr>
	      <td>1</td>
	      <td><a href="/play/170938" class="text-info font-weight-bold">Summertrain</a></td>
	      <td>Greyson Chance</td>
	    </tr>
	    <tr>
	      <td>2</td>
	      <td><a href="/play/1376042" class="text-info font-weight-bold">Summertrain (鼓点强烈版)</a></td>
	      <td>幸福飘忽不定</td>
	    </tr>
	  </tbody>
	</table>`

	results, err := gequhaiParseSearchResults(pageHTML)
	if err != nil {
		t.Fatalf("gequhaiParseSearchResults() error = %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("gequhaiParseSearchResults() len = %d want 2", len(results))
	}
	if results[0].SourceID != "gequhai:170938" {
		t.Fatalf("first SourceID = %q", results[0].SourceID)
	}
	if results[0].Title != "Summertrain" || results[0].Artist != "Greyson Chance" {
		t.Fatalf("first result = %#v", results[0])
	}
}

func TestGequhaiExtractTrackPageData(t *testing.T) {
	pageHTML := `
	<div id="content-lrc2">[00:00.00]Summertrain - Greyson Chance<br />[00:03.00]Come with me</div>
	<script>
	window.play_id = 'TjWex1%2FGnA%3D%3D';
	window.mp3_type = 0;
	window.mp3_title = 'Summertrain';
	window.mp3_author = 'Greyson Chance';
	window.mp3_cover = 'https://img2.kuwo.cn/star/albumcover/test.jpg';
	</script>`

	data, err := gequhaiExtractTrackPageData(pageHTML)
	if err != nil {
		t.Fatalf("gequhaiExtractTrackPageData() error = %v", err)
	}
	if data.PlayID != "TjWex1%2FGnA%3D%3D" {
		t.Fatalf("PlayID = %q", data.PlayID)
	}
	if data.MP3Type != "0" {
		t.Fatalf("MP3Type = %q", data.MP3Type)
	}
	if data.Title != "Summertrain" || data.Artist != "Greyson Chance" {
		t.Fatalf("title/artist = %#v", data)
	}
	if data.CoverURL != "https://img2.kuwo.cn/star/albumcover/test.jpg" {
		t.Fatalf("CoverURL = %q", data.CoverURL)
	}
	if data.Lyric != "[00:00.00]Summertrain - Greyson Chance\n[00:03.00]Come with me" {
		t.Fatalf("Lyric = %q", data.Lyric)
	}
}
