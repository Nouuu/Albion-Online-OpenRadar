package main

import (
	"bytes"
	"path/filepath"
	"testing"

	"github.com/nospy/albion-openradar/internal/photonscan"
	"github.com/stretchr/testify/require"
)

// pcap-derived: the committed fixture corpus, already scrubbed

func TestStringsIn_GroupsAValueUnderItsCodeAndIndex(t *testing.T) {
	found, err := stringsIn(filepath.Join("..", "..", "internal", "photon", "testdata", "chests", "spawn.pcap"))

	require.NoError(t, err)
	require.Equal(t, 1, found[site{
		kind:  photonscan.KindEvent,
		code:  391,
		index: 4,
		value: "SWAMP_RED_LOOTCHEST_DYNAMIC_CAMP_KEEPER_SMALL",
	}])
}

func TestStringsIn_CountsRepeatedValuesAtTheSameSite(t *testing.T) {
	found, err := stringsIn(filepath.Join("..", "..", "internal", "photon", "testdata", "fishing", "spawn.pcap"))

	require.NoError(t, err)
	require.Equal(t, 4, found[site{
		kind:  photonscan.KindEvent,
		code:  359,
		index: 4,
		value: "FishingNodeFish",
	}])
}

func TestStringsIn_ReportsAMissingFile(t *testing.T) {
	_, err := stringsIn("does-not-exist.pcap")

	require.Error(t, err)
}

func TestReport_SortsByKindThenCodeThenIndex(t *testing.T) {
	found := map[site]int{
		{kind: photonscan.KindResponse, code: 2, index: 8, value: "z"}: 1,
		{kind: photonscan.KindEvent, code: 29, index: 8, value: "b"}:   2,
		{kind: photonscan.KindEvent, code: 29, index: 1, value: "a"}:   1,
	}

	var out bytes.Buffer
	report(&out, found)

	require.Equal(t,
		"    ev    29 [1] \"a\"                                           x1\n"+
			"    ev    29 [8] \"b\"                                           x2\n"+
			"    res    2 [8] \"z\"                                           x1\n",
		out.String())
}

func TestReport_WritesNothingForAnEmptyCapture(t *testing.T) {
	var out bytes.Buffer

	report(&out, map[site]int{})

	require.Empty(t, out.String())
}
