package server

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"

	"github.com/nospy/albion-openradar/internal/capture"
)

type NetworkManager interface {
	State() capture.State
	Reconfigure([]capture.NetworkInterface) error
}

type LANAddrFn func() []string

type NetworkAPI struct {
	mgr      NetworkManager
	all      []capture.NetworkInterface
	appDir   string
	lanAddrs LANAddrFn
}

func NewNetworkAPI(mgr NetworkManager, all []capture.NetworkInterface, appDir string, lan LANAddrFn) *NetworkAPI {
	return &NetworkAPI{mgr: mgr, all: all, appDir: appDir, lanAddrs: lan}
}

func (a *NetworkAPI) Register(mux *http.ServeMux) {
	mux.Handle("/api/network/interfaces", a)
	mux.Handle("/api/network/state", a)
	mux.Handle("/api/network/refresh", a)
}

func (a *NetworkAPI) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/network/interfaces":
		switch r.Method {
		case http.MethodGet:
			a.handleList(w, r)
		case http.MethodPost:
			a.handleSelect(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case "/api/network/state":
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		a.handleState(w, r)
	case "/api/network/refresh":
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		a.handleRefresh(w, r)
	default:
		http.NotFound(w, r)
	}
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
	persisted := make(map[string]bool)
	cfg, _ := capture.ReadConfig(a.appDir)
	for _, p := range cfg.CaptureInterfaces {
		persisted[p.Name] = true
	}
	available := make(map[string]bool)
	for _, i := range a.all {
		available[i.Name] = true
	}
	rows := make([]ifaceRow, 0, len(a.all))
	for _, i := range capture.RankCandidates(a.all) {
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
	if !isLoopback(r.RemoteAddr) {
		http.Error(w, "capture interfaces can only be changed from the host PC", http.StatusForbidden)
		return
	}
	var body selectBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}
	desired := make([]capture.NetworkInterface, 0, len(body.Names))
	for _, name := range body.Names {
		for _, i := range a.all {
			if i.Name == name {
				desired = append(desired, i)
				break
			}
		}
	}
	if err := a.mgr.Reconfigure(desired); err != nil {
		http.Error(w, "reconfigure: "+err.Error(), http.StatusInternalServerError)
		return
	}
	persisted := make([]capture.PersistedInterface, 0, len(desired))
	for _, i := range desired {
		persisted = append(persisted, capture.PersistedInterface{Name: i.Name, Description: i.Description})
	}
	if err := capture.WriteConfig(a.appDir, capture.Config{CaptureInterfaces: persisted}); err != nil {
		http.Error(w, "persist: "+err.Error(), http.StatusInternalServerError)
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
	a.all = fresh
	a.handleList(w, nil)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func isLoopback(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	host = strings.TrimSpace(host)
	if host == "" {
		return false
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback()
}
