package cloudplayer

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"cloudplayer/backend/config"
	kg "github.com/lfhy/kugou-music-api"
)

const kugouBenefitRetryCooldown = 15 * time.Minute

// Kugou benefit helpers keep daily sign-in, VIP refresh, and session cleanup out of the RPC handlers.
type kugouBenefitSnapshot struct {
	UserID         string
	LastSignedDate string
	VIPExpireAt    string
	SignedToday    bool
}

func hasKugouLoginCookie(session config.KugouSession) bool {
	return strings.TrimSpace(session.Cookie["token"]) != "" && strings.TrimSpace(session.Cookie["userid"]) != ""
}

func kugouSessionUserID(session config.KugouSession) string {
	return strings.TrimSpace(firstNonEmptyString(session.Cookie["userid"], session.LastUserID))
}

func (s *CloudPlayerService) afterKugouSessionMutation(previousUserID, nextUserID string) error {
	if err := s.clearPersistedPlaybackState(); err != nil {
		return err
	}
	s.state.SearchCache.ClearSearchEntries()
	for _, userID := range []string{strings.TrimSpace(previousUserID), strings.TrimSpace(nextUserID)} {
		if userID == "" {
			continue
		}
		if err := s.clearKugouPlaylistCacheForUser(userID); err != nil {
			return err
		}
	}
	return nil
}

func (s *CloudPlayerService) clearPersistedPlaybackState() error {
	settings := config.LoadSettings()
	settings.PlayQueue = nil
	settings.PlayQueueIndex = 0
	settings.PlaybackTrackKey = ""
	settings.PlaybackPositionMS = 0
	settings.PlaybackDurationMS = 0
	return config.SaveSettings(settings)
}

func (s *CloudPlayerService) clearKugouPlaylistCacheForUser(userID string) error {
	trimmed := strings.TrimSpace(userID)
	if trimmed == "" {
		return nil
	}
	tx, err := s.state.DB.Begin()
	if err != nil {
		return err
	}
	defer rollback(tx)
	if _, err := tx.Exec(`DELETE FROM kugou_playlist_cache_items WHERE user_id = ?`, trimmed); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM kugou_playlist_cache WHERE user_id = ?`, trimmed); err != nil {
		return err
	}
	return tx.Commit()
}

func saveKugouClientSession(client *kg.Client) error {
	session := config.LoadKugouSession()
	cookie := client.Cookie()
	nextUserID := strings.TrimSpace(cookie["userid"])
	if currentUserID := kugouSessionUserID(session); currentUserID != "" && currentUserID != nextUserID {
		session.LastBenefitSyncDate = ""
		session.LastBenefitSyncAt = ""
		session.LastBenefitStatus = ""
		session.LastSignedDate = ""
		session.LastVIPExpireAt = ""
	}
	session.Cookie = cookie
	session.LastUserID = nextUserID
	return config.SaveKugouSession(session)
}

func (s *CloudPlayerService) maybeSyncKugouBenefits(ctx context.Context) {
	session := config.LoadKugouSession()
	if !hasKugouLoginCookie(session) || !shouldSyncKugouBenefits(session, time.Now()) {
		return
	}
	if err := s.syncKugouBenefits(ctx, session); err != nil {
		log.Printf("kugou benefit sync failed: %v", err)
	}
}

func shouldSyncKugouBenefits(session config.KugouSession, now time.Time) bool {
	today := kugouChinaDate(now)
	if strings.TrimSpace(session.LastBenefitSyncDate) == today && strings.TrimSpace(session.LastBenefitStatus) != "error" {
		return false
	}
	lastAttempt, err := time.Parse(time.RFC3339, strings.TrimSpace(session.LastBenefitSyncAt))
	if err != nil {
		return true
	}
	return now.Sub(lastAttempt) >= kugouBenefitRetryCooldown
}

func (s *CloudPlayerService) syncKugouBenefits(ctx context.Context, session config.KugouSession) error {
	client, err := kg.New(kg.WithLite(true), kg.WithCookie(session.Cookie))
	if err != nil {
		return err
	}
	snapshot, err := readKugouBenefitSnapshot(ctx, client, client.Cookie())
	if err != nil {
		return s.saveKugouBenefitSnapshot(session, client.Cookie(), kugouBenefitSnapshot{}, "error", false, err)
	}
	if snapshot.SignedToday {
		return s.saveKugouBenefitSnapshot(session, client.Cookie(), snapshot, "already_signed", true, nil)
	}
	if err := claimKugouDailyVIP(ctx, client); err != nil {
		return s.saveKugouBenefitSnapshot(session, client.Cookie(), snapshot, "error", false, err)
	}
	refreshed, err := readKugouBenefitSnapshot(ctx, client, client.Cookie())
	if err != nil {
		return s.saveKugouBenefitSnapshot(session, client.Cookie(), snapshot, "error", false, err)
	}
	status := "success"
	if refreshed.SignedToday {
		status = "already_signed"
	}
	return s.saveKugouBenefitSnapshot(session, client.Cookie(), refreshed, status, true, nil)
}

func (s *CloudPlayerService) saveKugouBenefitSnapshot(session config.KugouSession, cookie map[string]string, snapshot kugouBenefitSnapshot, status string, markToday bool, cause error) error {
	session.Cookie = cloneStringMap(cookie)
	now := time.Now()
	session.LastUserID = strings.TrimSpace(firstNonEmptyString(snapshot.UserID, kugouSessionUserID(session)))
	session.LastSignedDate = strings.TrimSpace(snapshot.LastSignedDate)
	session.LastVIPExpireAt = strings.TrimSpace(snapshot.VIPExpireAt)
	session.LastBenefitStatus = strings.TrimSpace(status)
	session.LastBenefitSyncAt = now.Format(time.RFC3339)
	if markToday {
		session.LastBenefitSyncDate = kugouChinaDate(now)
	}
	if snapshot.UserID != "" {
		session.Cookie["userid"] = strings.TrimSpace(snapshot.UserID)
	}
	if err := config.SaveKugouSession(session); err != nil {
		return err
	}
	if cause != nil {
		return cause
	}
	return nil
}

func readKugouBenefitSnapshot(ctx context.Context, client *kg.Client, cookie map[string]string) (kugouBenefitSnapshot, error) {
	if _, err := ensureKugouUserDetail(ctx, client, cookie); err != nil {
		return kugouBenefitSnapshot{}, err
	}
	vipResp, err := client.UserVipDetail(ctx, kg.UserVipDetailRequest{Cookie: client.Cookie()})
	if err != nil {
		return kugouBenefitSnapshot{}, err
	}
	monthResp, err := client.YouthMonthVipRecord(ctx, kg.YouthMonthVipRecordRequest{Cookie: client.Cookie()})
	if err != nil {
		return kugouBenefitSnapshot{}, err
	}
	signedDate := latestKugouSignedDate(monthResp.Body)
	return kugouBenefitSnapshot{
		UserID:         normalizedKugouUserID(firstNonEmptyString(kugouBodyString(vipResp.Body, "userid"), client.Cookie()["userid"])),
		LastSignedDate: signedDate,
		VIPExpireAt:    latestKugouVIPEndTime(vipResp.Body),
		SignedToday:    signedDate != "" && signedDate == kugouChinaDate(time.Now()),
	}, nil
}

func ensureKugouUserDetail(ctx context.Context, client *kg.Client, cookie map[string]string) (*kg.UserDetailResponse, error) {
	resp, err := client.UserDetail(ctx, kg.UserDetailRequest{Cookie: cookie})
	if err == nil {
		return resp, nil
	}
	_, refreshErr := client.LoginByToken(ctx, kg.TokenLoginRequest{
		Token:  strings.TrimSpace(cookie["token"]),
		UserID: normalizedKugouUserID(cookie["userid"]),
		Cookie: cookie,
	})
	if refreshErr != nil {
		return nil, fmt.Errorf("user detail failed: %v; token refresh failed: %v", err, refreshErr)
	}
	return client.UserDetail(ctx, kg.UserDetailRequest{Cookie: client.Cookie()})
}

func claimKugouDailyVIP(ctx context.Context, client *kg.Client) error {
	listenResp, err := client.YouthListenSong(ctx, kg.YouthListenSongRequest{Cookie: client.Cookie()})
	if err != nil {
		return err
	}
	if code := kugouResponseCode(listenResp.Body); code != 0 && code != 130012 {
		return fmt.Errorf("listen_song failed: %s", strings.TrimSpace(string(listenResp.RawBody)))
	}
	for attempt := 0; attempt < 8; attempt++ {
		vipResp, vipErr := client.YouthVip(ctx, kg.YouthVipRequest{Cookie: client.Cookie()})
		if vipErr != nil {
			return vipErr
		}
		switch code := kugouResponseCode(vipResp.Body); code {
		case 0, 30002:
		default:
			return fmt.Errorf("youth_vip failed: %s", strings.TrimSpace(string(vipResp.RawBody)))
		}
	}
	return nil
}

func kugouResponseCode(body map[string]any) int {
	for _, key := range []string{"error_code", "errorCode", "code"} {
		value := strings.TrimSpace(kugouBodyString(body, key))
		if value == "" {
			continue
		}
		code, _ := strconv.Atoi(value)
		return code
	}
	return 0
}

func latestKugouSignedDate(body map[string]any) string {
	items, _ := pickKugouMap(body, "data")["list"].([]any)
	best := ""
	for _, item := range items {
		typed, _ := item.(map[string]any)
		if kugouResponseCode(map[string]any{"error_code": typed["receive_vip"]}) != 1 {
			continue
		}
		day := strings.TrimSpace(kugouBodyString(typed, "day"))
		if day > best {
			best = day
		}
	}
	return best
}

func latestKugouVIPEndTime(body map[string]any) string {
	items, _ := pickKugouMap(body, "data")["busi_vip"].([]any)
	best := ""
	for _, item := range items {
		typed, _ := item.(map[string]any)
		end := strings.TrimSpace(kugouBodyString(typed, "vip_end_time"))
		if end > best {
			best = end
		}
	}
	return best
}

func pickKugouMap(root map[string]any, key string) map[string]any {
	value, _ := root[key].(map[string]any)
	if value == nil {
		return map[string]any{}
	}
	return value
}

func normalizedKugouUserID(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || !strings.ContainsAny(trimmed, ".eE") {
		return trimmed
	}
	value, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return trimmed
	}
	return strconv.FormatInt(int64(value+0.5), 10)
}

func kugouChinaDate(now time.Time) string {
	return now.In(time.FixedZone("CST", 8*3600)).Format("2006-01-02")
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func cloneStringMap(input map[string]string) map[string]string {
	out := make(map[string]string, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}
