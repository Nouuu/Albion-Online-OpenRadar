package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
