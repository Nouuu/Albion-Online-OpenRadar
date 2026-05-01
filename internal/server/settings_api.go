package server

import (
	"net/http"

	"github.com/segmentio/encoding/json"

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
}

// NewSettingsAPI creates a SettingsAPI. recorder may be nil (recording calls are skipped).
func NewSettingsAPI(appDir string, log *logger.Logger, recorder Recorder, captureDir string) *SettingsAPI {
	return &SettingsAPI{
		appDir:     appDir,
		logger:     log,
		recorder:   recorder,
		captureDir: captureDir,
	}
}

func (a *SettingsAPI) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/settings/logging", a.handleGet)
	mux.HandleFunc("POST /api/settings/logging", a.handlePost)
}

func (a *SettingsAPI) handleGet(w http.ResponseWriter, _ *http.Request) {
	cfg, err := capture.ReadConfig(a.appDir)
	if err != nil {
		http.Error(w, "read config: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, cfg.Logging)
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

	var newLogging capture.LoggingConfig
	if err := capture.MutateConfig(a.appDir, func(cfg *capture.Config) {
		if patch.ServerLogsEnabled != nil {
			cfg.Logging.ServerLogsEnabled = *patch.ServerLogsEnabled
		}
		if patch.PcapRecording != nil {
			cfg.Logging.PcapRecording = *patch.PcapRecording
		}
		newLogging = cfg.Logging
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

	writeJSON(w, http.StatusOK, newLogging)
}
