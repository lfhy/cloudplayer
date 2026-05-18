package cloudplayer

import (
	"fmt"

	"cloudplayer/backend/config"
)

// Collection-mode patch handling stays separate so settings persistence can keep focused on orchestration.
func (s *CloudPlayerService) applyMusicCollectionModePatch(settings *config.Settings, patch SettingsPatch) error {
	if patch.MusicOnlineMode != nil {
		if *patch.MusicOnlineMode {
			status, err := s.GetKugouLoginStatus()
			if err != nil {
				return err
			}
			if !status.LoggedIn {
				return fmt.Errorf("请先登录酷狗概念版后再开启在线模式")
			}
		}
		settings.MusicOnlineMode = *patch.MusicOnlineMode
		if *patch.MusicOnlineMode {
			settings.MusicCollectionMode = config.MusicCollectionModeOnline
		} else if config.NormalizeMusicCollectionMode(settings.MusicCollectionMode) == config.MusicCollectionModeOnline {
			settings.MusicCollectionMode = config.MusicCollectionModeOffline
		}
	}
	if patch.MusicCollectionMode == nil {
		return nil
	}
	mode := config.NormalizeMusicCollectionMode(*patch.MusicCollectionMode)
	if mode != config.MusicCollectionModeOffline {
		status, err := s.GetKugouLoginStatus()
		if err != nil {
			return err
		}
		if !status.LoggedIn {
			return fmt.Errorf("请先登录酷狗概念版后再切换到云端歌单模式")
		}
	}
	settings.MusicCollectionMode = mode
	settings.MusicOnlineMode = mode == config.MusicCollectionModeOnline
	return nil
}
