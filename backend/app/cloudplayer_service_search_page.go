package cloudplayer

// Search page aggregation remaps provider chunks onto the app's fixed 30-row infinite-scroll pages.

import (
	"fmt"
	"net/http"

	"cloudplayer/backend/model"
	"cloudplayer/backend/musicsource"
)

func aggregateSearchProviderPage(client *http.Client, provider musicsource.Provider, keyword string, logicalPage uint32) (model.SearchResponse, error) {
	resolvedPage := maxUint32(logicalPage, 1)
	targetOffset := int(resolvedPage-1) * searchPageResultTarget
	targetTotal := targetOffset + searchPageResultTarget
	aggregated := make([]musicsource.SearchResult, 0, targetTotal)
	seen := make(map[string]struct{}, targetTotal)
	providerPage := uint32(1)
	hasNext := false

	for len(aggregated) < targetTotal {
		rows, pageHasNext, err := provider.Search(client, keyword, providerPage)
		if err != nil {
			partial := buildLogicalSearchResponse(aggregated, targetOffset, len(aggregated) > targetOffset)
			return partial, fmt.Errorf("provider page %d: %w", providerPage, err)
		}

		added := appendUniqueSearchResults(&aggregated, rows, seen)
		hasNext = pageHasNext
		if len(aggregated) >= targetTotal || !pageHasNext || added == 0 {
			break
		}
		providerPage += 1
	}

	return buildLogicalSearchResponse(aggregated, targetOffset, hasNext), nil
}

func appendUniqueSearchResults(target *[]musicsource.SearchResult, rows []musicsource.SearchResult, seen map[string]struct{}) int {
	added := 0
	for _, row := range rows {
		if row.SourceID != "" {
			if _, ok := seen[row.SourceID]; ok {
				continue
			}
			seen[row.SourceID] = struct{}{}
		}
		*target = append(*target, row)
		added += 1
	}
	return added
}

func buildLogicalSearchResponse(aggregated []musicsource.SearchResult, targetOffset int, hasNext bool) model.SearchResponse {
	if targetOffset < 0 {
		targetOffset = 0
	}
	if targetOffset >= len(aggregated) {
		return model.SearchResponse{
			Results: nil,
			HasNext: hasNext,
		}
	}

	end := minSearchPageInt(len(aggregated), targetOffset+searchPageResultTarget)
	results := make([]musicsource.SearchResult, end-targetOffset)
	copy(results, aggregated[targetOffset:end])
	return model.SearchResponse{
		Results: results,
		HasNext: hasNext || end < len(aggregated),
	}
}

func minSearchPageInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}
