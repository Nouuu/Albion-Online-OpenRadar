package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/nospy/albion-openradar/internal/capture"
)

type fakeManager struct {
	state         capture.State
	reconfArgs    []capture.NetworkInterface
	reconfErr     error
	allInterfaces []capture.NetworkInterface
}

func (f *fakeManager) State() capture.State { return f.state }
func (f *fakeManager) Reconfigure(t []capture.NetworkInterface) error {
	f.reconfArgs = append([]capture.NetworkInterface(nil), t...)
	return f.reconfErr
}

func newTestMux(api *NetworkAPI) *http.ServeMux {
	mux := http.NewServeMux()
	api.Register(mux)
	return mux
}

func TestNetworkAPI_ListReturnsCategorized(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{
			{Name: "n1", Description: "Wi-Fi", Address: "192.168.1.1"},
			{Name: "n2", Description: "Realtek PCIe GbE Family Controller", Address: "192.168.1.2"},
		},
		state: capture.State{
			Active: []capture.CaptureSummary{{Name: "n1"}},
		},
	}
	api := NewNetworkAPI(fm, fm.allInterfaces, "/tmp/notused", func() []string { return []string{"192.168.1.5"} })
	mux := newTestMux(api)
	req := httptest.NewRequest(http.MethodGet, "/api/network/interfaces", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var got []map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len=%d", len(got))
	}
	for _, row := range got {
		if row["category"] == "" {
			t.Errorf("missing category in %+v", row)
		}
	}
}

func TestNetworkAPI_PostFromLoopback(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{
			{Name: "x", Description: "Wi-Fi", Address: "10.0.0.1"},
		},
	}
	dir := t.TempDir()
	api := NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil })
	mux := newTestMux(api)

	body, _ := json.Marshal(map[string]any{"names": []string{"x"}})
	req := httptest.NewRequest(http.MethodPost, "/api/network/interfaces", bytes.NewReader(body))
	req.RemoteAddr = "127.0.0.1:1234"
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("loopback POST got %d, body=%s", rec.Code, rec.Body.String())
	}
	if len(fm.reconfArgs) != 1 || fm.reconfArgs[0].Name != "x" {
		t.Errorf("Reconfigure called with %+v", fm.reconfArgs)
	}
	cfg, _ := capture.ReadConfig(dir)
	if len(cfg.CaptureInterfaces) != 1 || cfg.CaptureInterfaces[0].Name != "x" {
		t.Errorf("config not persisted: %+v", cfg)
	}
}

func TestNetworkAPI_PostFromLanRejected(t *testing.T) {
	fm := &fakeManager{}
	dir := t.TempDir()
	api := NewNetworkAPI(fm, nil, dir, func() []string { return nil })
	mux := newTestMux(api)

	body, _ := json.Marshal(map[string]any{"names": []string{"x"}})
	req := httptest.NewRequest(http.MethodPost, "/api/network/interfaces", bytes.NewReader(body))
	req.RemoteAddr = "192.168.1.42:5555"
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("status %d, want 403", rec.Code)
	}
	if len(fm.reconfArgs) != 0 {
		t.Errorf("Reconfigure should not have been called from non-loopback")
	}
}

func TestNetworkAPI_StateShape(t *testing.T) {
	fm := &fakeManager{
		state: capture.State{
			Status: capture.StatusRunning,
			Active: []capture.CaptureSummary{{Name: "x", Description: "Wi-Fi", Address: "10.0.0.1"}},
		},
	}
	api := NewNetworkAPI(fm, nil, "/tmp", func() []string { return []string{"192.168.1.1"} })
	mux := newTestMux(api)
	req := httptest.NewRequest(http.MethodGet, "/api/network/state", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["isCapturing"] != true {
		t.Errorf("isCapturing=%v", body["isCapturing"])
	}
	if body["lanAddresses"] == nil {
		t.Error("lanAddresses missing")
	}
	active, ok := body["captureInterfaces"].([]any)
	if !ok || len(active) != 1 {
		t.Fatalf("captureInterfaces shape: %T %v", body["captureInterfaces"], body["captureInterfaces"])
	}
	row, ok := active[0].(map[string]any)
	if !ok {
		t.Fatalf("captureInterfaces[0] not an object: %T", active[0])
	}
	for _, key := range []string{"name", "description", "address", "category"} {
		if _, present := row[key]; !present {
			t.Errorf("captureInterfaces[0] missing camelCase key %q (front-end reads c.name); got keys=%v", key, mapKeys(row))
		}
	}
	if row["name"] != "x" {
		t.Errorf("captureInterfaces[0].name=%v want %q", row["name"], "x")
	}
}

func mapKeys(m map[string]any) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func TestNetworkAPI_PostUnknownNames(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{{Name: "a", Description: "Wi-Fi", Address: "10.0.0.1"}},
	}
	dir := t.TempDir()
	api := NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil })
	mux := newTestMux(api)

	body, _ := json.Marshal(map[string]any{"names": []string{"a", "unknown"}})
	req := httptest.NewRequest(http.MethodPost, "/api/network/interfaces", bytes.NewReader(body))
	req.RemoteAddr = "127.0.0.1:1234"
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "unknown") {
		t.Errorf("body should mention unknown names: %s", rec.Body.String())
	}
	if len(fm.reconfArgs) != 0 {
		t.Errorf("Reconfigure should not have been called, got %+v", fm.reconfArgs)
	}
}

func TestNetworkAPI_PostMalformedBody(t *testing.T) {
	fm := &fakeManager{}
	dir := t.TempDir()
	api := NewNetworkAPI(fm, nil, dir, func() []string { return nil })
	mux := newTestMux(api)

	req := httptest.NewRequest(http.MethodPost, "/api/network/interfaces", bytes.NewReader([]byte("{not json")))
	req.RemoteAddr = "127.0.0.1:1234"
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "invalid body") {
		t.Errorf("body should mention invalid body: %s", rec.Body.String())
	}
}

func TestNetworkAPI_RefreshGETIs405(t *testing.T) {
	fm := &fakeManager{}
	api := NewNetworkAPI(fm, nil, t.TempDir(), func() []string { return nil })
	mux := newTestMux(api)

	req := httptest.NewRequest(http.MethodGet, "/api/network/refresh", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status %d, want 405", rec.Code)
	}
}

func TestNetworkAPI_StatePOSTIs405(t *testing.T) {
	fm := &fakeManager{}
	api := NewNetworkAPI(fm, nil, t.TempDir(), func() []string { return nil })
	mux := newTestMux(api)

	req := httptest.NewRequest(http.MethodPost, "/api/network/state", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status %d, want 405", rec.Code)
	}
}

func TestNetworkSelect_PreservesLogging(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{
			{Name: "eth0", Description: "Ethernet", Address: "10.0.0.1"},
		},
	}
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		Logging: capture.LoggingConfig{ServerLogsEnabled: true},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}
	api := NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil })
	mux := newTestMux(api)

	body, _ := json.Marshal(map[string]any{"names": []string{"eth0"}})
	req := httptest.NewRequest(http.MethodPost, "/api/network/interfaces", bytes.NewReader(body))
	req.RemoteAddr = "127.0.0.1:1234"
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, body=%s", rec.Code, rec.Body.String())
	}
	cfg, err := capture.ReadConfig(dir)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	if !cfg.Logging.ServerLogsEnabled {
		t.Error("Logging.ServerLogsEnabled was reset by POST /api/network/interfaces")
	}
	if len(cfg.CaptureInterfaces) != 1 || cfg.CaptureInterfaces[0].Name != "eth0" {
		t.Errorf("CaptureInterfaces wrong: %+v", cfg.CaptureInterfaces)
	}
}

// Proves the RWMutex fix: without it, concurrent reads of a.all while a writer
// mutates the slice would race under -race.
func TestNetworkAPI_RefreshConcurrentSafe(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{{Name: "n1", Description: "Wi-Fi", Address: "10.0.0.1"}},
	}
	api := NewNetworkAPI(fm, fm.allInterfaces, t.TempDir(), func() []string { return nil })
	mux := newTestMux(api)

	var wg sync.WaitGroup
	for range 50 {
		wg.Go(func() {
			req := httptest.NewRequest(http.MethodGet, "/api/network/interfaces", nil)
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Errorf("list status %d", rec.Code)
			}
		})
	}
	for range 5 {
		wg.Go(func() {
			fresh := []capture.NetworkInterface{{Name: "mut", Description: "X", Address: "10.0.0.99"}}
			api.mu.Lock()
			api.all = fresh
			api.mu.Unlock()
		})
	}
	wg.Wait()
}
