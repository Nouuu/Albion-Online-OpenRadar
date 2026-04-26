package server

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"

	"github.com/nospy/albion-openradar/internal/capture"
)

type NetworkManager interface {
	State() capture.State
	Reconfigure([]capture.NetworkInterface) error
}

type LANAddrFn func() []string

type NetworkAPI struct {
	mgr      NetworkManager
	mu       sync.RWMutex
	all      []capture.NetworkInterface
	appDir   string
	lanAddrs LANAddrFn
}

func NewNetworkAPI(mgr NetworkManager, all []capture.NetworkInterface, appDir string, lan LANAddrFn) *NetworkAPI {
	return &NetworkAPI{mgr: mgr, all: all, appDir: appDir, lanAddrs: lan}
}

func (a *NetworkAPI) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/network/interfaces", a.handleList)
	mux.HandleFunc("POST /api/network/interfaces", a.handleSelect)
	mux.HandleFunc("GET /api/network/state", a.handleState)
	mux.HandleFunc("POST /api/network/refresh", a.handleRefresh)
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
	snapshot := make([]capture.NetworkInterface, len(a.all))
	copy(snapshot, a.all)
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
	if !isLoopback(r.RemoteAddr) {
		http.Error(w, "capture interfaces can only be changed from the host PC", http.StatusForbidden)
		return
	}
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
	a.mu.Lock()
	a.all = fresh
	a.mu.Unlock()
	a.handleList(w, nil)
}

// ComputeLANAddresses returns IPv4 RFC1918 host addresses bound to local
// interfaces, used to print LAN URLs at startup and to populate /api/network/state.
func ComputeLANAddresses() []string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return nil
	}
	rfc1918 := []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}
	out := make([]string, 0)
	for _, a := range addrs {
		ipnet, ok := a.(*net.IPNet)
		if !ok {
			continue
		}
		ip4 := ipnet.IP.To4()
		if ip4 == nil {
			continue
		}
		for _, cidr := range rfc1918 {
			_, n, _ := net.ParseCIDR(cidr)
			if n.Contains(ip4) {
				out = append(out, ip4.String())
				break
			}
		}
	}
	return out
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
