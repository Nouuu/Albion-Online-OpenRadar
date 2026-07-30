package roads

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestReadStoreMissing(t *testing.T) {
	dir := t.TempDir()
	s, err := ReadStore(dir)
	if err != nil {
		t.Fatalf("ReadStore on empty dir: %v", err)
	}
	if len(s.Edges) != 0 {
		t.Errorf("missing store returned %d edges, want 0", len(s.Edges))
	}
}

func TestReadStoreMalformed(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "roads.json"), []byte("{not json"), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if _, err := ReadStore(dir); err == nil {
		t.Fatal("expected error on malformed JSON")
	}
}

func TestStoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	pos := [2]float64{1.5, -2.5}
	s := Store{Edges: []Edge{{From: "4206", To: "TNL-001", Pos: &pos, DiscoveredAt: time.Now()}}}
	if err := WriteStore(dir, s); err != nil {
		t.Fatalf("WriteStore: %v", err)
	}
	got, err := ReadStore(dir)
	if err != nil {
		t.Fatalf("ReadStore: %v", err)
	}
	if len(got.Edges) != 1 || got.Edges[0].From != "4206" || got.Edges[0].To != "TNL-001" {
		t.Fatalf("round-trip mismatch: %+v", got.Edges)
	}
	if got.Edges[0].Pos == nil || (*got.Edges[0].Pos)[0] != 1.5 || (*got.Edges[0].Pos)[1] != -2.5 {
		t.Errorf("Pos not preserved: %+v", got.Edges[0].Pos)
	}
}

func TestWriteStoreOverwritesAtomically(t *testing.T) {
	dir := t.TempDir()
	if err := WriteStore(dir, Store{Edges: []Edge{{From: "A", To: "B", DiscoveredAt: time.Now()}}}); err != nil {
		t.Fatal(err)
	}
	if err := WriteStore(dir, Store{Edges: []Edge{{From: "C", To: "D", DiscoveredAt: time.Now()}}}); err != nil {
		t.Fatal(err)
	}
	got, _ := ReadStore(dir)
	if len(got.Edges) != 1 || got.Edges[0].From != "C" {
		t.Errorf("overwrite failed, got %+v", got.Edges)
	}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".tmp" {
			t.Errorf("leftover tmp file: %s", e.Name())
		}
	}
}

func TestAddEdgeAppendsNewEdge(t *testing.T) {
	var s Store
	AddEdge(&s, "A", "B", nil)
	if len(s.Edges) != 1 || s.Edges[0].From != "A" || s.Edges[0].To != "B" {
		t.Fatalf("unexpected edges: %+v", s.Edges)
	}
}

func TestAddEdgeUpsertsExisting(t *testing.T) {
	var s Store
	AddEdge(&s, "A", "B", nil)
	first := s.Edges[0].DiscoveredAt

	time.Sleep(time.Millisecond)
	pos := [2]float64{5, 6}
	AddEdge(&s, "A", "B", &pos)

	if len(s.Edges) != 1 {
		t.Fatalf("expected upsert to keep a single edge, got %d", len(s.Edges))
	}
	if s.Edges[0].Pos == nil || (*s.Edges[0].Pos)[0] != 5 {
		t.Errorf("Pos not refreshed: %+v", s.Edges[0].Pos)
	}
	if !s.Edges[0].DiscoveredAt.After(first) {
		t.Errorf("DiscoveredAt not refreshed: first=%v got=%v", first, s.Edges[0].DiscoveredAt)
	}
}

func TestAddEdgeDistinguishesDirection(t *testing.T) {
	var s Store
	AddEdge(&s, "A", "B", nil)
	AddEdge(&s, "B", "A", nil)
	if len(s.Edges) != 2 {
		t.Fatalf("A->B and B->A should be distinct edges, got %+v", s.Edges)
	}
}

func TestMutateStore_PreservesUntouchedEdges(t *testing.T) {
	dir := t.TempDir()
	seed := Store{Edges: []Edge{{From: "A", To: "B", DiscoveredAt: time.Now()}}}
	if err := WriteStore(dir, seed); err != nil {
		t.Fatalf("WriteStore: %v", err)
	}

	if err := MutateStore(dir, func(s *Store) {
		AddEdge(s, "C", "D", nil)
	}); err != nil {
		t.Fatalf("MutateStore: %v", err)
	}

	got, err := ReadStore(dir)
	if err != nil {
		t.Fatalf("ReadStore: %v", err)
	}
	if len(got.Edges) != 2 {
		t.Fatalf("expected 2 edges after mutate, got %+v", got.Edges)
	}
}
