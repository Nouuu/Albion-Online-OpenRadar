package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/nospy/albion-openradar/internal/capture"
	"github.com/nospy/albion-openradar/internal/logger"
)

type fakeManager struct {
	state         capture.State
	reconfArgs    []capture.NetworkInterface
	reconfErr     error
	allInterfaces []capture.NetworkInterface
	recording     bool
	onReconfigure func(*fakeManager)
}

func (f *fakeManager) State() capture.State { return f.state }
func (f *fakeManager) IsRecording() bool    { return f.recording }
func (f *fakeManager) Reconfigure(t []capture.NetworkInterface) error {
	f.reconfArgs = slices.Clone(t)
	if f.onReconfigure != nil {
		f.onReconfigure(f)
	}
	return f.reconfErr
}

var _ NetworkManager = (*capture.Manager)(nil)

func TestNetworkManager_ExposesIsRecording(t *testing.T) {
	var nm NetworkManager = &fakeManager{recording: true}
	if !nm.IsRecording() {
		t.Error("NetworkManager.IsRecording() = false, want true")
	}
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
	api := NewNetworkAPI(fm, fm.allInterfaces, "/tmp/notused", func() []string { return []string{"192.168.1.5"} }, &sync.Mutex{})
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
	api := NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil }, &sync.Mutex{})
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
	api := NewNetworkAPI(fm, nil, dir, func() []string { return nil }, &sync.Mutex{})
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
	api := NewNetworkAPI(fm, nil, "/tmp", func() []string { return []string{"192.168.1.1"} }, &sync.Mutex{})
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
	api := NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil }, &sync.Mutex{})
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
	api := NewNetworkAPI(fm, nil, dir, func() []string { return nil }, &sync.Mutex{})
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
	api := NewNetworkAPI(fm, nil, t.TempDir(), func() []string { return nil }, &sync.Mutex{})
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
	api := NewNetworkAPI(fm, nil, t.TempDir(), func() []string { return nil }, &sync.Mutex{})
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
	api := NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil }, &sync.Mutex{})
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
	api := NewNetworkAPI(fm, fm.allInterfaces, t.TempDir(), func() []string { return nil }, &sync.Mutex{})
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

func TestIsHost(t *testing.T) {
	cases := []struct {
		name       string
		remoteAddr string
		localAddr  net.Addr
		forwarded  string
		want       bool
	}{
		{name: "loopback v4", remoteAddr: "127.0.0.1:1234", want: true},
		{name: "loopback v6", remoteAddr: "[::1]:5555", want: true},
		{name: "remote equals local", remoteAddr: "192.168.1.42:5555", localAddr: &net.TCPAddr{IP: net.ParseIP("192.168.1.42")}, want: true},
		{name: "lan without local match", remoteAddr: "192.168.1.42:5555", want: false},
		{name: "lan with forwarded-for ignored", remoteAddr: "192.168.1.99:5555", forwarded: "127.0.0.1", want: false},
		{name: "unparseable remote", remoteAddr: "not-an-address", localAddr: &net.TCPAddr{}, want: false},
		{name: "4-in-6 remote equals local v4", remoteAddr: "[::ffff:192.168.1.42]:5555", localAddr: &net.TCPAddr{IP: net.IP{192, 168, 1, 42}}, want: true},
		{name: "zone id matches", remoteAddr: "[fe80::1%eth0]:5555", localAddr: &net.TCPAddr{IP: net.ParseIP("fe80::1"), Zone: "eth0"}, want: true},
		{name: "local addr wrong type", remoteAddr: "192.168.1.42:5555", localAddr: &net.UDPAddr{IP: net.ParseIP("192.168.1.42")}, want: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/x", nil)
			req.RemoteAddr = tc.remoteAddr
			if tc.forwarded != "" {
				req.Header.Set("X-Forwarded-For", tc.forwarded)
			}
			if tc.localAddr != nil {
				req = req.WithContext(context.WithValue(req.Context(), http.LocalAddrContextKey, tc.localAddr))
			}
			if got := isHost(req); got != tc.want {
				t.Errorf("isHost() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestHostOnly_RejectsLANOnThreePostRoutes(t *testing.T) {
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		Logging: capture.LoggingConfig{ServerLogsEnabled: true},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}
	before, err := os.ReadFile(filepath.Join(dir, "network.json"))
	if err != nil {
		t.Fatalf("read seed file: %v", err)
	}

	fm := &fakeManager{}
	netAPI := NewNetworkAPI(fm, nil, dir, func() []string { return nil }, &sync.Mutex{})
	log := logger.New(t.TempDir(), false)
	t.Cleanup(func() { log.Stop() })
	settingsAPI := NewSettingsAPI(dir, log, nil, "", &sync.Mutex{})

	mux := http.NewServeMux()
	netAPI.Register(mux)
	settingsAPI.Register(mux)

	routes := []struct {
		path string
		body []byte
	}{
		{"/api/settings/logging", []byte(`{"serverLogsEnabled":true}`)},
		{"/api/network/refresh", nil},
		{"/api/network/interfaces", []byte(`{"names":[]}`)},
	}
	for _, rt := range routes {
		t.Run(rt.path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, rt.path, bytes.NewReader(rt.body))
			req.RemoteAddr = "192.168.1.42:5555"
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)
			if rec.Code != http.StatusForbidden {
				t.Fatalf("status %d, want 403", rec.Code)
			}
			if got := strings.TrimSpace(rec.Body.String()); got != hostOnlyMessage {
				t.Errorf("body = %q, want %q", got, hostOnlyMessage)
			}
		})
	}

	if len(fm.reconfArgs) != 0 {
		t.Errorf("Reconfigure should not have been called, got %+v", fm.reconfArgs)
	}
	if log.IsEnabled() {
		t.Error("logger state changed by rejected LAN POST")
	}
	after, err := os.ReadFile(filepath.Join(dir, "network.json"))
	if err != nil {
		t.Fatalf("read file after: %v", err)
	}
	if string(before) != string(after) {
		t.Errorf("network.json changed by rejected LAN POST")
	}
}

func TestHostOnly_GETsStayOpenFromLAN(t *testing.T) {
	fm := &fakeManager{}
	dir := t.TempDir()
	api := NewNetworkAPI(fm, nil, dir, func() []string { return nil }, &sync.Mutex{})
	mux := newTestMux(api)

	for _, path := range []string{"/api/network/interfaces", "/api/network/state"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.RemoteAddr = "192.168.1.42:5555"
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("GET %s from LAN: status %d, want 200", path, rec.Code)
		}
	}
}

func TestIsLoopback(t *testing.T) {
	cases := []struct {
		addr string
		want bool
	}{
		{"127.0.0.1:1234", true},
		{"127.0.0.1", true},
		{" 127.0.0.1", true},
		{"[::1]:5001", true},
		{"::1", true},
		{"[::1]", false},
		{"[::ffff:127.0.0.1]:80", true},
		{"192.168.1.42:5555", false},
		{"[fe80::1]:5001", false},
		{"", false},
		{"not-an-ip:12", false},
	}
	for _, tc := range cases {
		if got := isLoopback(tc.addr); got != tc.want {
			t.Errorf("isLoopback(%q) = %v, want %v", tc.addr, got, tc.want)
		}
	}
}

func postSelect(t *testing.T, mux *http.ServeMux, names ...string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"names": names})
	req := httptest.NewRequest(http.MethodPost, "/api/network/interfaces", bytes.NewReader(body))
	req.RemoteAddr = "127.0.0.1:1234"
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func persistedNames(t *testing.T, dir string) []string {
	t.Helper()
	cfg, err := capture.ReadConfig(dir)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	names := make([]string, 0, len(cfg.CaptureInterfaces))
	for _, p := range cfg.CaptureInterfaces {
		names = append(names, p.Name)
	}
	return names
}

func TestNetworkSelect_PartialApplyPersistsOpenedOnly(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{
			{Name: "a", Description: "Wi-Fi", Address: "10.0.0.1"},
			{Name: "b", Description: "Ethernet", Address: "10.0.0.2"},
		},
		reconfErr: errors.New("partial open failures: [b: boom]"),
		onReconfigure: func(f *fakeManager) {
			f.state = capture.State{
				Status:     capture.StatusRunning,
				Active:     []capture.CaptureSummary{{Name: "a"}},
				LastErrors: map[string]string{"b": "boom"},
			}
		},
	}
	dir := t.TempDir()
	mux := newTestMux(NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil }, &sync.Mutex{}))

	rec := postSelect(t, mux, "a", "b")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500; body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "b: boom") {
		t.Errorf("body does not name the failed interface and its error: %s", rec.Body.String())
	}
	if got := persistedNames(t, dir); !slices.Equal(got, []string{"a"}) {
		t.Errorf("persisted %v, want [a]", got)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/network/interfaces", nil)
	list := httptest.NewRecorder()
	mux.ServeHTTP(list, req)
	var rows []ifaceRow
	if err := json.NewDecoder(list.Body).Decode(&rows); err != nil {
		t.Fatalf("decode: %v", err)
	}
	for _, r := range rows {
		if want := r.Name == "a"; r.IsPersisted != want {
			t.Errorf("row %q isPersisted=%v, want %v", r.Name, r.IsPersisted, want)
		}
	}
}

func TestNetworkSelect_RecordingResetWritesPcapFalse(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{
			{Name: "a", Description: "Wi-Fi", Address: "10.0.0.1"},
			{Name: "b", Description: "Ethernet", Address: "10.0.0.2"},
		},
		recording: true,
		reconfErr: errors.New("pcap recording could not start on b: denied"),
		onReconfigure: func(f *fakeManager) {
			f.recording = false
			f.state = capture.State{
				Status: capture.StatusRunning,
				Active: []capture.CaptureSummary{{Name: "a"}, {Name: "b"}},
			}
		},
	}
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		Logging: capture.LoggingConfig{ServerLogsEnabled: true, PcapRecording: true},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}
	mux := newTestMux(NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil }, &sync.Mutex{}))

	rec := postSelect(t, mux, "a", "b")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500; body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "denied") {
		t.Errorf("body does not carry the recording error: %s", rec.Body.String())
	}
	cfg, err := capture.ReadConfig(dir)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	if cfg.Logging.PcapRecording {
		t.Error("network.json pcapRecording still true after the Manager stopped recording")
	}
	if !cfg.Logging.ServerLogsEnabled {
		t.Error("serverLogsEnabled lost")
	}
	if got := persistedNames(t, dir); !slices.Equal(got, []string{"a", "b"}) {
		t.Errorf("persisted %v, want [a b]", got)
	}
}

func TestNetworkSelect_ErrClosedAnswers503AndPersistsNothing(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{{Name: "a", Description: "Wi-Fi", Address: "10.0.0.1"}},
		reconfErr:     capture.ErrClosed,
	}
	dir := t.TempDir()
	if err := capture.WriteConfig(dir, capture.Config{
		CaptureInterfaces: []capture.PersistedInterface{{Name: "old"}},
		Logging:           capture.LoggingConfig{PcapRecording: true},
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}
	before, err := os.ReadFile(filepath.Join(dir, "network.json"))
	if err != nil {
		t.Fatalf("read seed: %v", err)
	}
	mux := newTestMux(NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil }, &sync.Mutex{}))

	rec := postSelect(t, mux, "a")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status %d, want 503; body=%s", rec.Code, rec.Body.String())
	}
	after, err := os.ReadFile(filepath.Join(dir, "network.json"))
	if err != nil {
		t.Fatalf("read after: %v", err)
	}
	if !bytes.Equal(before, after) {
		t.Errorf("network.json changed: before %s after %s", before, after)
	}
}

func TestNetworkSelect_WaitsForApplyMu(t *testing.T) {
	fm := &fakeManager{allInterfaces: []capture.NetworkInterface{{Name: "a", Description: "Wi-Fi", Address: "10.0.0.1"}}}
	applyMu := &sync.Mutex{}
	mux := newTestMux(NewNetworkAPI(fm, fm.allInterfaces, t.TempDir(), func() []string { return nil }, applyMu))

	applyMu.Lock()
	done := make(chan int)
	go func() { done <- postSelect(t, mux, "a").Code }()
	select {
	case code := <-done:
		applyMu.Unlock()
		t.Fatalf("POST answered %d while applyMu was held", code)
	case <-time.After(50 * time.Millisecond):
	}
	applyMu.Unlock()
	if code := <-done; code != http.StatusOK {
		t.Errorf("status %d after unlock, want 200", code)
	}
}
