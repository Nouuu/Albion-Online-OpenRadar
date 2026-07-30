package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newRoadsTestMux(api *RoadsAPI) *http.ServeMux {
	mux := http.NewServeMux()
	api.Register(mux)
	return mux
}

func TestRoadsAPI_ListEmpty(t *testing.T) {
	api := NewRoadsAPI(t.TempDir())
	mux := newRoadsTestMux(api)

	req := httptest.NewRequest(http.MethodGet, "/api/roads/edges", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var got []map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected no edges, got %+v", got)
	}
}

func TestRoadsAPI_PostThenGetReflectsEdge(t *testing.T) {
	dir := t.TempDir()
	api := NewRoadsAPI(dir)
	mux := newRoadsTestMux(api)

	body, _ := json.Marshal(map[string]any{"from": "4206", "to": "TNL-001", "pos": []float64{1.5, -2.5}})
	req := httptest.NewRequest(http.MethodPost, "/api/roads/edges", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST status %d, body=%s", rec.Code, rec.Body.String())
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/roads/edges", nil)
	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, req2)
	var got []map[string]any
	if err := json.NewDecoder(rec2.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 edge, got %+v", got)
	}
	if got[0]["from"] != "4206" || got[0]["to"] != "TNL-001" {
		t.Errorf("edge fields wrong: %+v", got[0])
	}
	if got[0]["discoveredAt"] == nil {
		t.Error("discoveredAt missing")
	}
}

func TestRoadsAPI_PostMissingFromOrTo(t *testing.T) {
	api := NewRoadsAPI(t.TempDir())
	mux := newRoadsTestMux(api)

	body, _ := json.Marshal(map[string]any{"from": "", "to": "TNL-001"})
	req := httptest.NewRequest(http.MethodPost, "/api/roads/edges", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", rec.Code)
	}
}

func TestRoadsAPI_PostMalformedBody(t *testing.T) {
	api := NewRoadsAPI(t.TempDir())
	mux := newRoadsTestMux(api)

	req := httptest.NewRequest(http.MethodPost, "/api/roads/edges", bytes.NewReader([]byte("{not json")))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "invalid body") {
		t.Errorf("body should mention invalid body: %s", rec.Body.String())
	}
}

func TestRoadsAPI_PostUpsertsExistingEdge(t *testing.T) {
	dir := t.TempDir()
	api := NewRoadsAPI(dir)
	mux := newRoadsTestMux(api)

	first, _ := json.Marshal(map[string]any{"from": "A", "to": "B"})
	req1 := httptest.NewRequest(http.MethodPost, "/api/roads/edges", bytes.NewReader(first))
	mux.ServeHTTP(httptest.NewRecorder(), req1)

	second, _ := json.Marshal(map[string]any{"from": "A", "to": "B", "pos": []float64{9, 9}})
	req2 := httptest.NewRequest(http.MethodPost, "/api/roads/edges", bytes.NewReader(second))
	mux.ServeHTTP(httptest.NewRecorder(), req2)

	req3 := httptest.NewRequest(http.MethodGet, "/api/roads/edges", nil)
	rec3 := httptest.NewRecorder()
	mux.ServeHTTP(rec3, req3)
	var got []map[string]any
	if err := json.NewDecoder(rec3.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected upsert to keep a single edge, got %+v", got)
	}
}

func TestRoadsAPI_ListGETOnlyRejectsPOST(t *testing.T) {
	api := NewRoadsAPI(t.TempDir())
	mux := newRoadsTestMux(api)

	req := httptest.NewRequest(http.MethodPut, "/api/roads/edges", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status %d, want 405", rec.Code)
	}
}
