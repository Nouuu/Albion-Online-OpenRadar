package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInventory_WritesCensusMarkdown(t *testing.T) {
	in := filepath.Join("..", "..", "internal", "photon", "testdata", "generic_events.pcap")
	if _, err := os.Stat(in); err != nil {
		t.Skip("generic_events.pcap missing, run from repo root")
	}

	outDir := t.TempDir()
	outPath := filepath.Join(outDir, "census.md")

	err := runInventory(in, outPath)
	require.NoError(t, err)

	body, err := os.ReadFile(outPath)
	require.NoError(t, err)
	s := string(body)
	require.True(t, strings.Contains(s, "# Protocol18 Observed Codes"), "missing title")
	require.True(t, strings.Contains(s, "## Event codes"), "missing events section")
	require.True(t, strings.Contains(s, "## Operation requests"), "missing requests section")
	require.True(t, strings.Contains(s, "## Operation responses"), "missing responses section")
}
