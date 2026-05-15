package cloudplayer

import "cloudplayer/backend/config"

// Collection-mode helpers centralize offline / online / hybrid branching for playlist and favorites behavior.
func currentMusicCollectionMode() string {
	return config.NormalizeMusicCollectionMode(config.LoadSettings().MusicCollectionMode)
}

func collectionModeIsOffline() bool {
	return currentMusicCollectionMode() == config.MusicCollectionModeOffline
}

func collectionModeIsOnline() bool {
	return currentMusicCollectionMode() == config.MusicCollectionModeOnline
}

func collectionModeIsHybrid() bool {
	return currentMusicCollectionMode() == config.MusicCollectionModeHybrid
}

func collectionModeUsesCloudPlaylists() bool {
	mode := currentMusicCollectionMode()
	return mode == config.MusicCollectionModeOnline || mode == config.MusicCollectionModeHybrid
}

func collectionModeUsesOnlineFavorites() bool {
	return collectionModeIsOnline()
}

func collectionModeAllowsLocalFallback() bool {
	return collectionModeIsHybrid()
}
