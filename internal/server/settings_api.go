package server

import (
	"net/http"

	"github.com/segmentio/encoding/json"

	"github.com/nospy/albion-openradar/internal/capture"
	"github.com/nospy/albion-openradar/internal/logger"
)

type SettingsAPI struct {
	appDir string
	logger *logger.Logger
}

func NewSettingsAPI(appDir string, log *logger.Logger) *SettingsAPI {
	return &SettingsAPI{appDir: appDir, logger: log}
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

	cfg, err := capture.ReadConfig(a.appDir)
	if err != nil {
		http.Error(w, "read config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if patch.ServerLogsEnabled != nil {
		cfg.Logging.ServerLogsEnabled = *patch.ServerLogsEnabled
	}
	if patch.PcapRecording != nil {
		cfg.Logging.PcapRecording = *patch.PcapRecording
	}

	if err := capture.WriteConfig(a.appDir, cfg); err != nil {
		http.Error(w, "write config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if patch.ServerLogsEnabled != nil && a.logger != nil {
		a.logger.SetEnabled(*patch.ServerLogsEnabled)
	}

	writeJSON(w, http.StatusOK, cfg.Logging)
}
