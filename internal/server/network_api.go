package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"slices"
	"strings"
	"sync"

	"github.com/nospy/albion-openradar/internal/capture"
	"github.com/nospy/albion-openradar/internal/logger"
)

const hostOnlyMessage = "Only the PC running the radar can change this."

type NetworkManager interface {
	State() capture.State
	Reconfigure([]capture.NetworkInterface) error
	IsRecording() bool
}

type LANAddrFn func() []string

type NetworkAPI struct {
	mgr      NetworkManager
	mu       sync.RWMutex
	all      []capture.NetworkInterface
	appDir   string
	lanAddrs LANAddrFn
	applyMu  *sync.Mutex
}

func NewNetworkAPI(mgr NetworkManager, all []capture.NetworkInterface, appDir string, lan LANAddrFn, applyMu *sync.Mutex) *NetworkAPI {
	return &NetworkAPI{mgr: mgr, all: all, appDir: appDir, lanAddrs: lan, applyMu: applyMu}
}

func (a *NetworkAPI) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/network/interfaces", a.handleList)
	mux.HandleFunc("POST /api/network/interfaces", hostOnly(a.handleSelect))
	mux.HandleFunc("GET /api/network/state", a.handleState)
	mux.HandleFunc("POST /api/network/refresh", hostOnly(a.handleRefresh))
}

type ifaceRow struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Address     string `json:"address"`
	Category    string `json:"category"`
	IsPersisted bool   `json:"isPersisted"`
	IsAvailable bool   `json:"isAvailable"`
}

func (a *NetworkAPI) handleList(w http.ResponseWriter, _ *http.Request) {
	a.mu.RLock()
	snapshot := slices.Clone(a.all)
	a.mu.RUnlock()

	persisted := make(map[string]bool)
	cfg, _ := capture.ReadConfig(a.appDir)
	for _, p := range cfg.CaptureInterfaces {
		persisted[p.Name] = true
	}
	available := make(map[string]bool)
	for _, i := range snapshot {
		available[i.Name] = true
	}
	rows := make([]ifaceRow, 0, len(snapshot))
	for _, i := range capture.RankCandidates(snapshot) {
		rows = append(rows, ifaceRow{
			Name:        i.Name,
			Description: i.Description,
			Address:     i.Address,
			Category:    string(capture.Categorize(i.Name, i.Description)),
			IsPersisted: persisted[i.Name],
			IsAvailable: available[i.Name],
		})
	}
	writeJSON(w, http.StatusOK, rows)
}

type stateBody struct {
	CaptureInterfaces []capture.CaptureSummary `json:"captureInterfaces"`
	IsCapturing       bool                     `json:"isCapturing"`
	LanAddresses      []string                 `json:"lanAddresses"`
	LastErrors        map[string]string        `json:"lastErrors"`
	Status            string                   `json:"status"`
}

func (a *NetworkAPI) handleState(w http.ResponseWriter, _ *http.Request) {
	s := a.mgr.State()
	body := stateBody{
		CaptureInterfaces: s.Active,
		IsCapturing:       len(s.Active) > 0,
		LanAddresses:      a.lanAddrs(),
		LastErrors:        s.LastErrors,
		Status:            string(s.Status),
	}
	writeJSON(w, http.StatusOK, body)
}

type selectBody struct {
	Names []string `json:"names"`
}

func (a *NetworkAPI) handleSelect(w http.ResponseWriter, r *http.Request) {
	var body selectBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}
	a.mu.RLock()
	available := make(map[string]capture.NetworkInterface, len(a.all))
	for _, i := range a.all {
		available[i.Name] = i
	}
	a.mu.RUnlock()
	desired := make([]capture.NetworkInterface, 0, len(body.Names))
	var unknown []string
	for _, name := range body.Names {
		if i, ok := available[name]; ok {
			desired = append(desired, i)
		} else {
			unknown = append(unknown, name)
		}
	}
	if len(unknown) > 0 {
		http.Error(w, fmt.Sprintf("unknown interface names: %v", unknown), http.StatusBadRequest)
		return
	}
	a.applyMu.Lock()
	defer a.applyMu.Unlock()

	wasRecording := a.mgr.IsRecording()
	reconfErr := a.mgr.Reconfigure(desired)
	if errors.Is(reconfErr, capture.ErrClosed) {
		http.Error(w, "reconfigure: "+reconfErr.Error(), http.StatusServiceUnavailable)
		return
	}
	opened := desired
	if reconfErr != nil {
		active := make(map[string]bool)
		for _, c := range a.mgr.State().Active {
			active[c.Name] = true
		}
		opened = slices.DeleteFunc(slices.Clone(desired), func(i capture.NetworkInterface) bool { return !active[i.Name] })
	}
	persisted := make([]capture.PersistedInterface, 0, len(opened))
	for _, i := range opened {
		persisted = append(persisted, capture.PersistedInterface{Name: i.Name, Description: i.Description})
	}
	recording := a.mgr.IsRecording()
	if wasRecording && !recording {
		logger.PrintWarn("PKT", "pcap recording stopped during interface apply: %v", reconfErr)
	}
	if err := capture.MutateConfig(a.appDir, func(cfg *capture.Config) {
		cfg.CaptureInterfaces = persisted
		if !recording {
			cfg.Logging.PcapRecording = false
		}
	}); err != nil {
		http.Error(w, errors.Join(fmt.Errorf("persist: %w", err), reconfErr).Error(), http.StatusInternalServerError)
		return
	}
	if reconfErr != nil {
		http.Error(w, "reconfigure: "+reconfErr.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *NetworkAPI) handleRefresh(w http.ResponseWriter, _ *http.Request) {
	fresh, err := capture.EnumerateInterfaces()
	if err != nil {
		http.Error(w, "enumerate: "+err.Error(), http.StatusInternalServerError)
		return
	}
	a.mu.Lock()
	a.all = fresh
	a.mu.Unlock()
	a.handleList(w, nil)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func isLoopback(remoteAddr string) bool {
	if ap, err := netip.ParseAddrPort(remoteAddr); err == nil {
		return ap.Addr().IsLoopback()
	}
	ip, err := netip.ParseAddr(strings.TrimSpace(remoteAddr))
	return err == nil && ip.IsLoopback()
}

func isHost(r *http.Request) bool {
	if isLoopback(r.RemoteAddr) {
		return true
	}
	remote, err := netip.ParseAddrPort(r.RemoteAddr)
	if err != nil {
		return false
	}
	local, ok := r.Context().Value(http.LocalAddrContextKey).(*net.TCPAddr)
	if !ok {
		return false
	}
	return remote.Addr().Unmap() == local.AddrPort().Addr().Unmap()
}

func hostOnly(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !isHost(r) {
			http.Error(w, hostOnlyMessage, http.StatusForbidden)
			return
		}
		h(w, r)
	}
}
