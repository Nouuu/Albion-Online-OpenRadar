package server

import (
	"encoding/json"
	"net/http"

	"github.com/nospy/albion-openradar/internal/roads"
)

// RoadsAPI exposes runtime-discovered zone connections (Avalonian Roads and similar
// non-static exits) so the frontend GPS graph can merge them into its pathfinding data
// and persist them across sessions.
type RoadsAPI struct {
	appDir string
}

func NewRoadsAPI(appDir string) *RoadsAPI {
	return &RoadsAPI{appDir: appDir}
}

func (a *RoadsAPI) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/roads/edges", a.handleList)
	mux.HandleFunc("POST /api/roads/edges", a.handleAdd)
}

func (a *RoadsAPI) handleList(w http.ResponseWriter, _ *http.Request) {
	store, err := roads.ReadStore(a.appDir)
	if err != nil {
		http.Error(w, "read: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, store.Edges)
}

type addEdgeBody struct {
	From string      `json:"from"`
	To   string      `json:"to"`
	Pos  *[2]float64 `json:"pos"`
}

func (a *RoadsAPI) handleAdd(w http.ResponseWriter, r *http.Request) {
	var body addEdgeBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if body.From == "" || body.To == "" {
		http.Error(w, "from and to are required", http.StatusBadRequest)
		return
	}
	if err := roads.MutateStore(a.appDir, func(s *roads.Store) {
		roads.AddEdge(s, body.From, body.To, body.Pos)
	}); err != nil {
		http.Error(w, "persist: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
