package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
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
	safe := make([]FixtureMessage, len(messages))
	for i, m := range messages {
		safe[i] = FixtureMessage{
			Kind:       m.Kind,
			Parameters: jsonSafeMap(m.Parameters),
			ReturnCode: m.ReturnCode,
		}
	}
	body, err := json.MarshalIndent(fixtureFile{
		Scenario: filepath.Base(path),
		Handler:  filepath.Base(filepath.Dir(path)),
		Messages: safe,
	}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, body, 0o644)
}

func jsonSafeMap(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = jsonSafeValue(v)
	}
	return out
}

func jsonSafeValue(v any) any {
	switch x := v.(type) {
	case map[any]any:
		out := make(map[string]any, len(x))
		for k, vv := range x {
			out[fmt.Sprintf("%v", k)] = jsonSafeValue(vv)
		}
		return out
	case map[byte]any:
		out := make(map[string]any, len(x))
		for k, vv := range x {
			out[strconv.Itoa(int(k))] = jsonSafeValue(vv)
		}
		return out
	case []any:
		out := make([]any, len(x))
		for i, vv := range x {
			out[i] = jsonSafeValue(vv)
		}
		return out
	}
	return v
}
