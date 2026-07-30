// Package roads persists Avalonian Road (and other non-static) zone connections
// discovered at runtime as the player travels through them. Unlike the static
// world graph shipped in zone-graph.json, these edges reset periodically in-game
// and are learned by observing zone transitions that the static graph can't explain.
package roads

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const storeFilename = "roads.json"

// Edge is a directed, discovered connection from one zone to another.
// Pos is the local in-zone coordinate of the exit that was used, when known.
type Edge struct {
	From         string      `json:"from"`
	To           string      `json:"to"`
	Pos          *[2]float64 `json:"pos,omitempty"`
	DiscoveredAt time.Time   `json:"discoveredAt"`
}

// Store is the full set of discovered edges, persisted as roads.json next to the binary.
type Store struct {
	Edges []Edge `json:"edges"`
}

// AddEdge upserts a (From,To) edge into the store, refreshing DiscoveredAt/Pos when the
// edge is already known rather than appending a duplicate.
func AddEdge(s *Store, from, to string, pos *[2]float64) {
	now := time.Now()
	for i := range s.Edges {
		if s.Edges[i].From == from && s.Edges[i].To == to {
			s.Edges[i].Pos = pos
			s.Edges[i].DiscoveredAt = now
			return
		}
	}
	s.Edges = append(s.Edges, Edge{From: from, To: to, Pos: pos, DiscoveredAt: now})
}

// ReadStore reads roads.json from appDir. A missing file is not an error; it returns
// an empty Store, mirroring capture.ReadConfig's behavior for network.json.
func ReadStore(appDir string) (Store, error) {
	path := filepath.Join(appDir, storeFilename)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Store{}, nil
		}
		return Store{}, fmt.Errorf("read %s: %w", path, err)
	}
	var s Store
	if err := json.Unmarshal(data, &s); err != nil {
		return Store{}, fmt.Errorf("parse %s: %w", path, err)
	}
	return s, nil
}

// WriteStore writes roads.json atomically (temp file + rename), same pattern as
// capture.WriteConfig.
func WriteStore(appDir string, s Store) error {
	path := filepath.Join(appDir, storeFilename)
	tmp := path + ".tmp"
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal store: %w", err)
	}
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write tmp: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("rename tmp: %w", err)
	}
	return nil
}

// MutateStore reads the store, applies the mutator, and writes it back atomically.
func MutateStore(appDir string, mutate func(*Store)) error {
	s, err := ReadStore(appDir)
	if err != nil {
		return err
	}
	mutate(&s)
	return WriteStore(appDir, s)
}
