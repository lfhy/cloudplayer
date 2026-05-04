package pjmp3

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"cloudplayer/backend/config"
	"github.com/PuerkitoBio/goquery"
)

// Search parsing is isolated so PJMP3 DOM changes stay local to this file.
func SearchPjmp3(client *http.Client, keyword string, page uint32) ([]SearchResult, bool, error) {
	values := url.Values{}
	values.Set("keyword", strings.TrimSpace(keyword))
	values.Set("page", fmt.Sprintf("%d", maxUint32(page, 1)))

	requestURL := strings.TrimRight(config.BaseURL, "/") + "/search.php?" + values.Encode()
	request, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, false, err
	}
	applyPJMP3PageHeaders(request, strings.TrimRight(config.BaseURL, "/")+"/")
	body, err := fetchPJMP3PageBytes(client, request)
	if err != nil {
		return nil, false, err
	}
	return ParseSearchHTMLPage(string(body), maxUint32(page, 1))
}

func ParseSearchHTMLPage(html string, page uint32) ([]SearchResult, bool, error) {
	document, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, false, err
	}
	modern := parseModernCards(document)
	if len(modern) > 0 {
		return modern, detectNextPage(document, page, len(modern)), nil
	}
	legacy := parseLegacyTable(document)
	return legacy, detectNextPage(document, page, len(legacy)), nil
}

func parseModernCards(document *goquery.Document) []SearchResult {
	var result []SearchResult
	seen := make(map[string]struct{})
	document.Find(`a.search-result-list-item[href*="song.php"]`).Each(func(_ int, card *goquery.Selection) {
		href, _ := card.Attr("href")
		match := reSongID.FindStringSubmatch(strings.ReplaceAll(href, `\`, `/`))
		if len(match) < 2 {
			return
		}
		songID := match[1]
		if _, ok := seen[songID]; ok {
			return
		}
		title := strings.TrimSpace(card.Find(".search-result-list-item-left-song").First().Text())
		if title == "" {
			return
		}
		artist := strings.TrimSpace(card.Find(".search-result-list-item-left-singer").First().Text())
		coverURL := pickNormalizedImage(card.Find(".search-result-list-item-img img").First(), "src", "data-src", "data-original")
		seen[songID] = struct{}{}
		result = append(result, SearchResult{SourceID: songID, Title: title, Artist: artist, Album: "", CoverURL: coverURL})
	})
	return result
}

func parseLegacyTable(document *goquery.Document) []SearchResult {
	var result []SearchResult
	seen := make(map[string]struct{})
	document.Find("tr").Each(func(_ int, tr *goquery.Selection) {
		tr.Find(`a[href*="song.php"]`).Each(func(_ int, anchor *goquery.Selection) {
			href, _ := anchor.Attr("href")
			match := reSongID.FindStringSubmatch(href)
			if len(match) < 2 {
				return
			}
			songID := match[1]
			if _, ok := seen[songID]; ok {
				return
			}
			title := strings.TrimSpace(anchor.Text())
			if title == "" {
				return
			}
			switch strings.ToLower(title) {
			case "下载", "播放", "试听":
				return
			}

			artist, album := parseLegacyRowText(tr, songID, title)
			bestCover := parseLegacyRowCover(tr)
			title, artist = normalizeLegacyTitleArtist(title, artist)
			seen[songID] = struct{}{}
			result = append(result, SearchResult{SourceID: songID, Title: title, Artist: artist, Album: album, CoverURL: bestCover})
		})
	})
	return result
}

func detectNextPage(document *goquery.Document, currentPage uint32, resultCount int) bool {
	hasNext := false
	document.Find("a[href]").EachWithBreak(func(_ int, anchor *goquery.Selection) bool {
		href, _ := anchor.Attr("href")
		href = strings.ReplaceAll(href, `\`, `/`)
		match := reSearchPage.FindStringSubmatch(href)
		if len(match) < 2 {
			return true
		}
		page := parseUint32(match[1])
		lower := strings.ToLower(href)
		if page > currentPage && (strings.Contains(lower, "search") || strings.HasPrefix(href, "?") || strings.Contains(lower, "keyword=")) {
			hasNext = true
			return false
		}
		return true
	})
	return hasNext || resultCount >= 12
}
