package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Parameters keys are decimal strings for JSON stability.
type FixtureMessage struct {
	Kind       string         `json:"kind"`
	Parameters map[string]any `json:"parameters"`
	ReturnCode int16          `json:"returnCode,omitempty"`
}

type fixtureFile struct {
	Scenario string           `json:"scenario"`
	Handler  string           `json:"handler"`
	Messages []FixtureMessage `json:"messages"`
}

func writeJSONFixture(path string, messages []FixtureMessage) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}
	body, err := json.MarshalIndent(fixtureFile{
		Scenario: filepath.Base(path),
		Handler:  filepath.Base(filepath.Dir(path)),
		Messages: messages,
	}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, body, 0o644)
}
