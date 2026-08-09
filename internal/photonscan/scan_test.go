package photonscan

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func fixture(name string) string {
	return filepath.Join("..", "photon", "testdata", name)
}

// pcap-derived: the committed fixture corpus, already scrubbed

func TestScan_ReportsTheAlbionCodeRatherThanThePhotonOne(t *testing.T) {
	codes := map[int]bool{}
	err := Scan(fixture("generic_events.pcap"), func(m Message) {
		if m.Kind == KindEvent {
			codes[m.Code] = true
		}
	})

	require.NoError(t, err)
	// The Photon message code is 1 for all of these. Reading it instead of
	// parameter 252 would collapse the whole capture onto a single code.
	for _, want := range []int{29, 30, 123, 323} {
		require.True(t, codes[want], "expected to decode Albion event %d", want)
	}
}

func TestScan_ReportsMinusOneWhenTheCodeParameterIsAbsent(t *testing.T) {
	seen := false
	err := Scan(fixture("generic_events.pcap"), func(m Message) {
		if m.Kind == KindEvent && m.Code == -1 {
			seen = true
			require.NotContains(t, m.Params, byte(252))
		}
	})

	require.NoError(t, err)
	require.True(t, seen, "the corpus holds events with no code parameter")
}

func TestScan_SeparatesRequestsFromResponses(t *testing.T) {
	kinds := map[Kind]int{}
	err := Scan(fixture("operations.pcap"), func(m Message) { kinds[m.Kind]++ })

	require.NoError(t, err)
	require.NotZero(t, kinds[KindRequest])
	require.NotZero(t, kinds[KindResponse])
}

func TestScan_ExposesTheParameterTable(t *testing.T) {
	found := false
	err := Scan(fixture("players/spawn.pcap"), func(m Message) {
		if m.Kind == KindEvent && m.Code == 29 {
			found = true
			require.NotEmpty(t, m.Params)
		}
	})

	require.NoError(t, err)
	require.True(t, found, "the player spawn fixture carries event 29")
}

func TestScan_ReportsAMissingFile(t *testing.T) {
	err := Scan(fixture("does-not-exist.pcap"), func(Message) {})

	require.Error(t, err)
}

func TestStringsIn_FlattensNestedValues(t *testing.T) {
	require.Equal(t, []string{"a"}, StringsIn("a"))
	require.Equal(t, []string{"a", "b"}, StringsIn([]string{"a", "b"}))
	require.Equal(t, []string{"a", "b"}, StringsIn([]any{"a", []string{"b"}}))
}

func TestStringsIn_SkipsEmptyAndNonStringValues(t *testing.T) {
	require.Empty(t, StringsIn(""))
	require.Empty(t, StringsIn(42))
	require.Equal(t, []string{"a"}, StringsIn([]any{"", 7, "a"}))
}
