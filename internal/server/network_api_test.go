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
	req := httptest.NewRequest("GET", "/api/network/interfaces", nil)
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
	if rec.Code != 200 {
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

	body, _ := json.Marshal(map[string]any{"names": []string{"x"}})
	req := httptest.NewRequest("POST", "/api/network/interfaces", bytes.NewReader(body))
	req.RemoteAddr = "127.0.0.1:1234"
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
	if rec.Code != 200 {
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

	body, _ := json.Marshal(map[string]any{"names": []string{"x"}})
	req := httptest.NewRequest("POST", "/api/network/interfaces", bytes.NewReader(body))
	req.RemoteAddr = "192.168.1.42:5555"
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
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
	req := httptest.NewRequest("GET", "/api/network/state", nil)
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
	if rec.Code != 200 {
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
}

func TestNetworkAPI_PostUnknownNames(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{{Name: "a", Description: "Wi-Fi", Address: "10.0.0.1"}},
	}
	dir := t.TempDir()
	api := NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil })

	body, _ := json.Marshal(map[string]any{"names": []string{"a", "unknown"}})
	req := httptest.NewRequest("POST", "/api/network/interfaces", bytes.NewReader(body))
	req.RemoteAddr = "127.0.0.1:1234"
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
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

	req := httptest.NewRequest("POST", "/api/network/interfaces", bytes.NewReader([]byte("{not json")))
	req.RemoteAddr = "127.0.0.1:1234"
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
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

	req := httptest.NewRequest("GET", "/api/network/refresh", nil)
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status %d, want 405", rec.Code)
	}
}

func TestNetworkAPI_StatePOSTIs405(t *testing.T) {
	fm := &fakeManager{}
	api := NewNetworkAPI(fm, nil, t.TempDir(), func() []string { return nil })

	req := httptest.NewRequest("POST", "/api/network/state", nil)
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status %d, want 405", rec.Code)
	}
}

// Proves the RWMutex fix: without it, concurrent reads of a.all while a writer
// mutates the slice would race under -race.
func TestNetworkAPI_RefreshConcurrentSafe(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{{Name: "n1", Description: "Wi-Fi", Address: "10.0.0.1"}},
	}
	api := NewNetworkAPI(fm, fm.allInterfaces, t.TempDir(), func() []string { return nil })

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest("GET", "/api/network/interfaces", nil)
			rec := httptest.NewRecorder()
			api.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Errorf("list status %d", rec.Code)
			}
		}()
	}
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			fresh := []capture.NetworkInterface{{Name: "mut", Description: "X", Address: "10.0.0.99"}}
			api.mu.Lock()
			api.all = fresh
			api.mu.Unlock()
			_ = idx
		}(i)
	}
	wg.Wait()
}
