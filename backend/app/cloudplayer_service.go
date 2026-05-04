package cloudplayer

import "cloudplayer/backend/state"

// CloudPlayerService exposes the desktop app capabilities to the Wails frontend.
const recentPlaysMax = 100

type CloudPlayerService struct {
	state *state.AppState
}

func NewCloudPlayerService(state *state.AppState) *CloudPlayerService {
	return &CloudPlayerService{state: state}
}
