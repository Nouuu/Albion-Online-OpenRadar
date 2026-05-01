package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/nospy/albion-openradar/internal/capture"
	"github.com/nospy/albion-openradar/internal/logger"
)

// fakeRecorder is an in-memory Recorder for tests.
type fakeRecorder struct {
	mu        sync.Mutex
	recording bool
	startErr  error
	stopErr   error
}

func (r *fakeRecorder) StartRecording(_ string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.startErr != nil {
		return r.startErr
	}
	r.recording = true
	return nil
}

func (r *fakeRecorder) StopRecording() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.stopErr != nil {
		return r.stopErr
	}
	r.recording = false
	return nil
}

func (r *fakeRecorder) IsRecording() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.recording
}

func newSettingsTestMux(t *testing.T, dir string) (*http.ServeMux, *logger.Logger) {
	t.Helper()
	log := logger.New(t.TempDir(), false)
	t.Cleanup(func() { log.Stop() })
	api := NewSettingsAPI(dir, log, nil, "")
	mux := http.NewServeMux()
	api.Register(mux)
	return mux, log
}

func TestSettingsLogging_GetReturnsCurrentConfig(t *testing.T) {
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		Logging: capture.LoggingConfig{ServerLogsEnabled: true, PcapRecording: false},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}
	mux, _ := newSettingsTestMux(t, dir)

	req := httptest.NewRequest(http.MethodGet, "/api/settings/logging", http.NoBody)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rec.Code)
	}
	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["serverLogsEnabled"] != true {
		t.Errorf("serverLogsEnabled=%v, want true", body["serverLogsEnabled"])
	}
	if body["pcapRecording"] != false {
		t.Errorf("pcapRecording=%v, want false", body["pcapRecording"])
	}
}

func TestSettingsLogging_PostUpdatesPersistAndApply(t *testing.T) {
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		Logging: capture.LoggingConfig{ServerLogsEnabled: false, PcapRecording: false},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}
	mux, log := newSettingsTestMux(t, dir)

	body, _ := json.Marshal(map[string]any{"serverLogsEnabled": true})
	req := httptest.NewRequest(http.MethodPost, "/api/settings/logging", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var resp map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["serverLogsEnabled"] != true {
		t.Errorf("response serverLogsEnabled=%v, want true", resp["serverLogsEnabled"])
	}
	if resp["pcapRecording"] != false {
		t.Errorf("response pcapRecording=%v, want false", resp["pcapRecording"])
	}

	cfg, err := capture.ReadConfig(dir)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	if !cfg.Logging.ServerLogsEnabled {
		t.Error("network.json: serverLogsEnabled not persisted as true")
	}
	if cfg.Logging.PcapRecording {
		t.Error("network.json: pcapRecording changed unexpectedly")
	}

	if !log.IsEnabled() {
		t.Error("logger.IsEnabled() == false, want true after POST")
	}
}

func TestSettingsLogging_PostPartialBody(t *testing.T) {
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		Logging: capture.LoggingConfig{ServerLogsEnabled: true, PcapRecording: false},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}
	mux, _ := newSettingsTestMux(t, dir)

	body, _ := json.Marshal(map[string]any{"pcapRecording": true})
	req := httptest.NewRequest(http.MethodPost, "/api/settings/logging", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rec.Code)
	}
	cfg, err := capture.ReadConfig(dir)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	if !cfg.Logging.ServerLogsEnabled {
		t.Error("serverLogsEnabled was reset; partial update must leave it untouched")
	}
	if !cfg.Logging.PcapRecording {
		t.Error("pcapRecording not updated to true")
	}
}

func TestSettingsLogging_PostInvalidJson(t *testing.T) {
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		Logging: capture.LoggingConfig{ServerLogsEnabled: true, PcapRecording: false},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}
	mux, _ := newSettingsTestMux(t, dir)

	req := httptest.NewRequest(http.MethodPost, "/api/settings/logging", bytes.NewReader([]byte("{not json")))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", rec.Code)
	}
	cfg, err := capture.ReadConfig(dir)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	if !cfg.Logging.ServerLogsEnabled {
		t.Error("network.json was modified despite invalid JSON")
	}
}

func TestSettingsLogging_PostPreservesNetworkInterfaces(t *testing.T) {
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		CaptureInterfaces: []capture.PersistedInterface{{Name: "X"}},
		Logging:           capture.LoggingConfig{ServerLogsEnabled: true},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}
	mux, _ := newSettingsTestMux(t, dir)

	body, _ := json.Marshal(map[string]any{"pcapRecording": true})
	req := httptest.NewRequest(http.MethodPost, "/api/settings/logging", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	cfg, err := capture.ReadConfig(dir)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	if len(cfg.CaptureInterfaces) != 1 || cfg.CaptureInterfaces[0].Name != "X" {
		t.Errorf("CaptureInterfaces changed: %+v", cfg.CaptureInterfaces)
	}
	if !cfg.Logging.ServerLogsEnabled {
		t.Error("Logging.ServerLogsEnabled was reset by partial POST")
	}
	if !cfg.Logging.PcapRecording {
		t.Error("Logging.PcapRecording not updated to true")
	}
}

func TestSettingsServerLogs_LegacyEndpointIsGone(t *testing.T) {
	dir := t.TempDir()
	mux, _ := newSettingsTestMux(t, dir)

	for _, method := range []string{http.MethodGet, http.MethodPost} {
		req := httptest.NewRequest(method, "/api/settings/server-logs", http.NoBody)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s /api/settings/server-logs: status %d, want 404", method, rec.Code)
		}
	}
}

func TestSettingsLogging_PostStartsRecording(t *testing.T) {
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		Logging: capture.LoggingConfig{PcapRecording: false},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}

	log := logger.New(t.TempDir(), false)
	t.Cleanup(func() { log.Stop() })
	rec := &fakeRecorder{}
	api := NewSettingsAPI(dir, log, rec, t.TempDir())
	mux := http.NewServeMux()
	api.Register(mux)

	body, _ := json.Marshal(map[string]any{"pcapRecording": true})
	req := httptest.NewRequest(http.MethodPost, "/api/settings/logging", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body=%s", rr.Code, rr.Body.String())
	}
	if !rec.IsRecording() {
		t.Error("recorder.IsRecording() == false after POST pcapRecording=true")
	}
}

func TestSettingsLogging_PostStopsRecording(t *testing.T) {
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		Logging: capture.LoggingConfig{PcapRecording: true},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}

	log := logger.New(t.TempDir(), false)
	t.Cleanup(func() { log.Stop() })
	rec := &fakeRecorder{recording: true}
	api := NewSettingsAPI(dir, log, rec, t.TempDir())
	mux := http.NewServeMux()
	api.Register(mux)

	body, _ := json.Marshal(map[string]any{"pcapRecording": false})
	req := httptest.NewRequest(http.MethodPost, "/api/settings/logging", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body=%s", rr.Code, rr.Body.String())
	}
	if rec.IsRecording() {
		t.Error("recorder.IsRecording() == true after POST pcapRecording=false")
	}
}
