package musicsource

import (
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

const (
	gequhaiBaseURL        = "https://www.gequhai.com"
	gequhaiSearchPageSize = 30
	gequhaiUserAgent      = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)

var (
	gequhaiPlayIDPattern   = regexp.MustCompile(`window\.play_id\s*=\s*'([^']+)'`)
	gequhaiMP3TypePattern  = regexp.MustCompile(`window\.mp3_type\s*=\s*(\d+)`)
	gequhaiTitlePattern    = regexp.MustCompile(`window\.mp3_title\s*=\s*'((?:\\.|[^'])*)'`)
	gequhaiArtistPattern   = regexp.MustCompile(`window\.mp3_author\s*=\s*'((?:\\.|[^'])*)'`)
	gequhaiCoverURLPattern = regexp.MustCompile(`window\.mp3_cover\s*=\s*'((?:\\.|[^'])*)'`)
)

type gequhaiTrackPageData struct {
	PlayID   string
	MP3Type  string
	Title    string
	Artist   string
	CoverURL string
	Lyric    string
}

type gequhaiMusicResponse struct {
	Code int `json:"code"`
	Data struct {
		URL string `json:"url"`
	} `json:"data"`
	Msg string `json:"msg"`
}

// gequhai search results are rendered as an HTML table, so one page fetch can be sliced locally.
func gequhaiSearch(client *http.Client, keyword string, page uint32) ([]SearchResult, bool, error) {
	pageHTML, err := gequhaiFetchSearchPageHTML(client, keyword)
	if err != nil {
		return nil, false, err
	}
	rows, err := gequhaiParseSearchResults(pageHTML)
	if err != nil {
		return nil, false, err
	}

	pageIndex := 1
	if page > 1 {
		pageIndex = int(page)
	}
	start := (pageIndex - 1) * gequhaiSearchPageSize
	if start >= len(rows) {
		return []SearchResult{}, false, nil
	}
	end := start + gequhaiSearchPageSize
	if end > len(rows) {
		end = len(rows)
	}
	return rows[start:end], end < len(rows), nil
}

func gequhaiFetchPreviewURL(client *http.Client, rawID string) (string, error) {
	pageHTML, err := gequhaiFetchSongPageHTML(client, rawID)
	if err != nil {
		return "", err
	}
	pageData, err := gequhaiExtractTrackPageData(pageHTML)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(pageData.PlayID) == "" {
		return "", fmt.Errorf("歌曲海源播放参数缺失")
	}

	formPlayID := pageData.PlayID
	if decodedPlayID, decodeErr := url.QueryUnescape(pageData.PlayID); decodeErr == nil && strings.TrimSpace(decodedPlayID) != "" {
		formPlayID = decodedPlayID
	}
	form := url.Values{}
	form.Set("id", formPlayID)
	form.Set("type", pageData.MP3Type)

	request, err := http.NewRequest(http.MethodPost, gequhaiBaseURL+"/api/music", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	applyGequhaiPageHeaders(request, gequhaiSongPageURL(rawID))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	request.Header.Set("X-Requested-With", "XMLHttpRequest")
	request.Header.Set("X-Custom-Header", "SecretKey")

	response, err := gequhaiDefaultClient(client).Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("歌曲海源播放地址请求失败: http %d", response.StatusCode)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}

	var payload gequhaiMusicResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", err
	}
	if payload.Code != 200 {
		message := strings.TrimSpace(payload.Msg)
		if message == "" {
			message = "歌曲海源播放地址解析失败"
		}
		return "", fmt.Errorf("%s", message)
	}
	previewURL := strings.TrimSpace(payload.Data.URL)
	if previewURL == "" {
		return "", fmt.Errorf("歌曲海源未返回可播放地址")
	}
	return previewURL, nil
}

func gequhaiFetchSongLRCText(client *http.Client, rawID string) (*string, error) {
	pageHTML, err := gequhaiFetchSongPageHTML(client, rawID)
	if err != nil {
		return nil, err
	}
	pageData, err := gequhaiExtractTrackPageData(pageHTML)
	if err != nil {
		return nil, err
	}
	lyric := strings.TrimSpace(pageData.Lyric)
	if lyric == "" {
		return nil, nil
	}
	return &lyric, nil
}

func gequhaiFetchSongPageHTML(client *http.Client, rawID string) (string, error) {
	request, err := http.NewRequest(http.MethodGet, gequhaiSongPageURL(rawID), nil)
	if err != nil {
		return "", err
	}
	applyGequhaiPageHeaders(request, gequhaiBaseURL+"/")
	response, err := gequhaiDefaultClient(client).Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("歌曲海源详情页请求失败: http %d", response.StatusCode)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func gequhaiFetchSearchPageHTML(client *http.Client, keyword string) (string, error) {
	requestURL := gequhaiBaseURL + "/s/" + url.PathEscape(strings.TrimSpace(keyword))
	request, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return "", err
	}
	applyGequhaiPageHeaders(request, gequhaiBaseURL+"/")
	response, err := gequhaiDefaultClient(client).Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("歌曲海源搜索请求失败: http %d", response.StatusCode)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func gequhaiParseSearchResults(pageHTML string) ([]SearchResult, error) {
	document, err := goquery.NewDocumentFromReader(strings.NewReader(pageHTML))
	if err != nil {
		return nil, err
	}
	results := make([]SearchResult, 0)
	document.Find("tbody tr").Each(func(_ int, row *goquery.Selection) {
		link := row.Find(`a[href^="/play/"]`).First()
		href, ok := link.Attr("href")
		if !ok {
			return
		}
		rawID := strings.TrimSpace(strings.TrimPrefix(href, "/play/"))
		title := strings.TrimSpace(link.Text())
		artist := strings.TrimSpace(row.Find("td").Eq(2).Text())
		if rawID == "" || title == "" {
			return
		}
		results = append(results, SearchResult{
			SourceID: EncodeSourceID(ProviderGequhai, rawID),
			Title:    title,
			Artist:   artist,
		})
	})
	return results, nil
}

func gequhaiExtractTrackPageData(pageHTML string) (gequhaiTrackPageData, error) {
	document, err := goquery.NewDocumentFromReader(strings.NewReader(pageHTML))
	if err != nil {
		return gequhaiTrackPageData{}, err
	}
	lyric := gequhaiExtractLyric(document)
	data := gequhaiTrackPageData{
		PlayID:   gequhaiFindPatternValue(pageHTML, gequhaiPlayIDPattern),
		MP3Type:  gequhaiFindPatternValue(pageHTML, gequhaiMP3TypePattern),
		Title:    gequhaiDecodeJSString(gequhaiFindPatternValue(pageHTML, gequhaiTitlePattern)),
		Artist:   gequhaiDecodeJSString(gequhaiFindPatternValue(pageHTML, gequhaiArtistPattern)),
		CoverURL: gequhaiDecodeJSString(gequhaiFindPatternValue(pageHTML, gequhaiCoverURLPattern)),
		Lyric:    lyric,
	}
	if data.MP3Type == "" {
		data.MP3Type = "0"
	}
	if data.PlayID == "" {
		return gequhaiTrackPageData{}, fmt.Errorf("歌曲海源详情页缺少播放参数")
	}
	return data, nil
}

func gequhaiExtractLyric(document *goquery.Document) string {
	for _, selector := range []string{"#content-lrc2", "#content-lrc"} {
		selection := document.Find(selector).First()
		if selection.Length() == 0 {
			continue
		}
		htmlText, err := selection.Html()
		if err != nil {
			continue
		}
		lyric := gequhaiNormalizeHTMLText(htmlText)
		if lyric != "" {
			return lyric
		}
	}
	return ""
}

func gequhaiNormalizeHTMLText(raw string) string {
	normalized := strings.ReplaceAll(raw, "<br />", "\n")
	normalized = strings.ReplaceAll(normalized, "<br/>", "\n")
	normalized = strings.ReplaceAll(normalized, "<br>", "\n")
	replacer := strings.NewReplacer(
		"</p>", "\n",
		"<p>", "",
		"&nbsp;", " ",
	)
	normalized = replacer.Replace(normalized)
	normalized = html.UnescapeString(normalized)
	document, err := goquery.NewDocumentFromReader(strings.NewReader("<div>" + normalized + "</div>"))
	if err == nil {
		normalized = document.Text()
	}
	lines := strings.Split(normalized, "\n")
	cleaned := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			if len(cleaned) == 0 || cleaned[len(cleaned)-1] == "" {
				continue
			}
		}
		cleaned = append(cleaned, trimmed)
	}
	return strings.TrimSpace(strings.Join(cleaned, "\n"))
}

func gequhaiFindPatternValue(content string, pattern *regexp.Regexp) string {
	match := pattern.FindStringSubmatch(content)
	if len(match) < 2 {
		return ""
	}
	return strings.TrimSpace(match[1])
}

func gequhaiDecodeJSString(raw string) string {
	if raw == "" {
		return ""
	}
	replacer := strings.NewReplacer(
		`\\`, `\`,
		`\'`, `'`,
		`\n`, "\n",
		`\r`, "",
		`\/`, "/",
	)
	return strings.TrimSpace(replacer.Replace(raw))
}

func gequhaiSongPageURL(rawID string) string {
	return gequhaiBaseURL + "/play/" + url.PathEscape(strings.TrimSpace(rawID))
}

func applyGequhaiPageHeaders(request *http.Request, referer string) {
	request.Header.Set("User-Agent", gequhaiUserAgent)
	request.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	request.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	if referer != "" {
		request.Header.Set("Referer", referer)
	}
}

func gequhaiDefaultClient(client *http.Client) *http.Client {
	if client != nil {
		return client
	}
	return http.DefaultClient
}
