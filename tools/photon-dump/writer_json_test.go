package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWriteJSONFixture_Shape(t *testing.T) {
	dir := t.TempDir()
	out := filepath.Join(dir, "sub", "fixture.json")

	messages := []FixtureMessage{
		{Kind: "event", Parameters: map[string]any{"0": float64(42), "252": float64(27)}},
		{Kind: "response", Parameters: map[string]any{"253": float64(2), "8": float64(1337)}},
	}
	require.NoError(t, writeJSONFixture(out, messages))

	body, err := os.ReadFile(out)
	require.NoError(t, err)

	var decoded struct {
		Messages []FixtureMessage `json:"messages"`
	}
	require.NoError(t, json.Unmarshal(body, &decoded))
	require.Len(t, decoded.Messages, 2)
	require.Equal(t, "event", decoded.Messages[0].Kind)
	require.Equal(t, float64(27), decoded.Messages[0].Parameters["252"])
	require.Equal(t, "response", decoded.Messages[1].Kind)
	require.Equal(t, float64(2), decoded.Messages[1].Parameters["253"])
}
