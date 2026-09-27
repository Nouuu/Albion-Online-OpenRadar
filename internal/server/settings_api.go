package server

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/nospy/albion-openradar/internal/capture"
	"github.com/nospy/albion-openradar/internal/logger"
)

// Recorder is the subset of capture.Manager used by SettingsAPI to control pcap recording.
type Recorder interface {
	StartRecording(dir string) error
	StopRecording() error
	IsRecording() bool
}

type SettingsAPI struct {
	appDir     string
	logger     *logger.Logger
	recorder   Recorder
	captureDir string
	applyMu    *sync.Mutex
}

// NewSettingsAPI creates a SettingsAPI. recorder may be nil (recording calls are skipped).
func NewSettingsAPI(appDir string, log *logger.Logger, recorder Recorder, captureDir string, applyMu *sync.Mutex) *SettingsAPI {
	return &SettingsAPI{
		appDir:     appDir,
		logger:     log,
		recorder:   recorder,
		captureDir: captureDir,
		applyMu:    applyMu,
	}
}

func (a *SettingsAPI) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/settings/logging", a.handleGet)
	mux.HandleFunc("POST /api/settings/logging", hostOnly(a.handlePost))
}

func (a *SettingsAPI) handleGet(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.runtimeLogging())
}

func (a *SettingsAPI) runtimeLogging() capture.LoggingConfig {
	return capture.LoggingConfig{
		ServerLogsEnabled: a.logger != nil && a.logger.IsEnabled(),
		PcapRecording:     a.recorder != nil && a.recorder.IsRecording(),
	}
}

type loggingPatch struct {
	ServerLogsEnabled *bool `json:"serverLogsEnabled"`
	PcapRecording     *bool `json:"pcapRecording"`
}

func (a *SettingsAPI) handlePost(w http.ResponseWriter, r *http.Request) {
	var patch loggingPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		http.Error(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}

	a.applyMu.Lock()
	defer a.applyMu.Unlock()

	if err := capture.MutateConfig(a.appDir, func(cfg *capture.Config) {
		if patch.ServerLogsEnabled != nil {
			cfg.Logging.ServerLogsEnabled = *patch.ServerLogsEnabled
		}
		if patch.PcapRecording != nil {
			cfg.Logging.PcapRecording = *patch.PcapRecording
		}
	}); err != nil {
		http.Error(w, "write config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if patch.ServerLogsEnabled != nil && a.logger != nil {
		a.logger.SetEnabled(*patch.ServerLogsEnabled)
	}

	if patch.PcapRecording != nil && a.recorder != nil {
		if *patch.PcapRecording {
			if err := a.recorder.StartRecording(a.captureDir); err != nil {
				logger.PrintWarn("PKT", "pcap recording could not start: %v", err)
				_ = capture.MutateConfig(a.appDir, func(cfg *capture.Config) {
					cfg.Logging.PcapRecording = false
				})
				http.Error(w, "pcap recording failed: "+err.Error(), http.StatusInternalServerError)
				return
			}
		} else {
			if err := a.recorder.StopRecording(); err != nil {
				logger.PrintWarn("PKT", "pcap recording could not stop: %v", err)
			}
		}
	}

	writeJSON(w, http.StatusOK, a.runtimeLogging())
}
