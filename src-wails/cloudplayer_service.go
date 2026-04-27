package main

// CloudPlayerService exposes the desktop app capabilities to the Wails frontend.
const recentPlaysMax = 100

type CloudPlayerService struct {
	state *AppState
}

func NewCloudPlayerService(state *AppState) *CloudPlayerService {
	return &CloudPlayerService{state: state}
}
