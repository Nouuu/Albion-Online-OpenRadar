package server

import (
	"io/fs"
	"net/http"

	"github.com/segmentio/encoding/json"

	"github.com/nospy/albion-openradar/internal/audio"
	"github.com/nospy/albion-openradar/internal/logger"
)

// AlertPlayer is the subset of the audio player used by AlertAPI.
type AlertPlayer interface {
	Has(file string) bool
	Play(file string, volume float64)
}

type AlertAPI struct {
	player AlertPlayer
}

// NewAlertAPI creates an AlertAPI. player may be nil when the machine has no audio device.
func NewAlertAPI(player AlertPlayer) *AlertAPI {
	return &AlertAPI{player: player}
}

// newAlertPlayer returns nil when no audio device can be opened, so the radar keeps
// capturing and drawing on a machine that cannot make a sound.
func newAlertPlayer(soundsFS fs.FS) AlertPlayer {
	player, err := audio.NewPlayer(soundsFS)
	if err != nil {
		logger.PrintWarn("SND", "alert sound unavailable on this machine: %v", err)
		return nil
	}
	return player
}

func (a *AlertAPI) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/alert/play", a.handlePlay)
}

type alertPlayRequest struct {
	File   string  `json:"file"`
	Volume float64 `json:"volume"`
}

func (a *AlertAPI) handlePlay(w http.ResponseWriter, r *http.Request) {
	var req alertPlayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if a.player == nil {
		http.Error(w, "no audio device on the machine running the radar", http.StatusServiceUnavailable)
		return
	}
	if !a.player.Has(req.File) {
		http.Error(w, "unknown sound", http.StatusNotFound)
		return
	}

	a.player.Play(req.File, min(1, max(0, req.Volume)))
	w.WriteHeader(http.StatusNoContent)
}
