package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRunExtract_ProducesBothArtifacts(t *testing.T) {
	root := filepath.Join("..", "..")
	in := filepath.Join(root, "internal", "photon", "testdata", "generic_events.pcap")
	if _, err := os.Stat(in); err != nil {
		t.Skip("generic_events.pcap missing, run from repo root")
	}

	outGo := t.TempDir()
	outJS := t.TempDir()

	local := []Scenario{{
		Name:    "events/generic-probe",
		Handler: "events",
		Match:   MatchCriteria{Kind: "event", Code: -1},
	}}

	err := runExtract(in, outGo, outJS, local)
	require.NoError(t, err)

	_, err = os.Stat(filepath.Join(outGo, "events", "generic-probe.pcap"))
	require.NoError(t, err, "pcap fragment not written")
	_, err = os.Stat(filepath.Join(outJS, "events", "generic-probe.json"))
	require.NoError(t, err, "json fixture not written")
}
