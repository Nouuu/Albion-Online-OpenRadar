package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/nospy/albion-openradar/internal/photon"
	"github.com/nospy/albion-openradar/internal/photon/eventcodes"
	"github.com/nospy/albion-openradar/internal/photon/operationcodes"
	"github.com/stretchr/testify/require"
)

func payloadsOf(t *testing.T, path string) [][]byte {
	t.Helper()
	var out [][]byte
	require.NoError(t, iteratePcap(path, func(payload []byte, _, _ uint16) error {
		out = append(out, append([]byte(nil), payload...))
		return nil
	}))
	return out
}

func countCodes(t *testing.T, path string) (events map[int]int, responses map[int]int, packets int) {
	t.Helper()
	events, responses = map[int]int{}, map[int]int{}
	parser := photon.NewPhotonParser(
		func(e *photon.EventData) { photon.PostProcessEvent(e); events[intFromParam(e.Parameters[252])]++ },
		func(*photon.OperationRequest) {},
		func(r *photon.OperationResponse) {
			photon.PostProcessResponse(r)
			responses[intFromParam(r.Parameters[253])]++
		},
	)
	require.NoError(t, iteratePcap(path, func(payload []byte, _, _ uint16) error {
		packets++
		parser.ReceivePacket(payload)
		return nil
	}))
	return events, responses, packets
}

// pcap-derived
func TestRunRange_HeadThenSpan(t *testing.T) {
	root := filepath.Join("..", "..", "internal", "photon", "testdata")
	join := filepath.Join(root, "router", "join-finished.pcap")
	moves := filepath.Join(root, "move_heavy.pcap")
	if _, err := os.Stat(moves); err != nil {
		t.Skip("fixtures missing, run from repo root")
	}
	movePayloads := payloadsOf(t, moves)
	in := filepath.Join(t.TempDir(), "in.pcap")
	require.NoError(t, writePcapFragment(in, append(payloadsOf(t, join)[:1], movePayloads...)))
	allEvents, _, allPackets := countCodes(t, in)
	require.Equal(t, 3, allEvents[eventcodes.CastSpell])

	outGo, outJS := t.TempDir(), t.TempDir()
	r := RangeScenario{
		Name: "players/probe", Handler: "players", Port: 5056, Head: true,
		Start: MatchCriteria{Kind: "event", Code: eventcodes.CastSpell}, Nth: 1,
		End: MatchCriteria{Kind: "event", Code: eventcodes.Leave}, Span: 1,
	}
	require.NoError(t, runRange(in, outGo, outJS, r))

	pcapPath := filepath.Join(outGo, "players", "probe.pcap")
	events, responses, packets := countCodes(t, pcapPath)
	require.Equal(t, 1, responses[operationcodes.Join], "head keeps the Join response")
	require.Equal(t, 1, events[eventcodes.CastSpell], "range starts at the first CastSpell packet")
	require.Equal(t, 1, events[eventcodes.Leave], "range ends at the packet holding the next Leave")
	require.Less(t, packets, allPackets, "packets between the head and the range are dropped")
	require.Positive(t, events[eventcodes.Move])

	body, err := os.ReadFile(filepath.Join(outJS, "players", "probe.json"))
	require.NoError(t, err)
	var fx struct {
		Messages []struct {
			Kind       string         `json:"kind"`
			Parameters map[string]any `json:"parameters"`
		} `json:"messages"`
	}
	require.NoError(t, json.Unmarshal(body, &fx))
	require.Equal(t, "response", fx.Messages[0].Kind)
	require.Equal(t, float64(eventcodes.Leave), fx.Messages[len(fx.Messages)-1].Parameters["252"], "the last message is the End match")

	r.Span = 2
	require.NoError(t, runRange(in, outGo, outJS, r))
	events2, _, packets2 := countCodes(t, pcapPath)
	require.Equal(t, 2, events2[eventcodes.Leave])
	require.Greater(t, packets2, packets)
}

// pcap-derived
func TestRunRange_KeepsMatchingPacketsOfTheGap(t *testing.T) {
	root := filepath.Join("..", "..", "internal", "photon", "testdata")
	join := filepath.Join(root, "router", "join-finished.pcap")
	moves := filepath.Join(root, "move_heavy.pcap")
	if _, err := os.Stat(moves); err != nil {
		t.Skip("fixtures missing, run from repo root")
	}
	in := filepath.Join(t.TempDir(), "in.pcap")
	require.NoError(t, writePcapFragment(in, append(payloadsOf(t, join)[:1], payloadsOf(t, moves)...)))
	outGo, outJS := t.TempDir(), t.TempDir()
	r := RangeScenario{
		Name: "players/probe", Handler: "players", Port: 5056, Head: true,
		Keep:  []MatchCriteria{{Kind: "event", Code: eventcodes.Leave}},
		Start: MatchCriteria{Kind: "event", Code: eventcodes.CastSpell}, Nth: 1,
		End: MatchCriteria{Kind: "event", Code: eventcodes.Leave}, Span: 1,
	}
	require.NoError(t, runRange(in, outGo, outJS, r))
	events, _, _ := countCodes(t, filepath.Join(outGo, "players", "probe.pcap"))
	require.Equal(t, 3, events[eventcodes.Leave], "two Leave packets of the gap plus the End packet")
	require.Equal(t, 1, events[eventcodes.CastSpell])
}

// pcap-derived
func TestRunRange_Errors(t *testing.T) {
	root := filepath.Join("..", "..", "internal", "photon", "testdata")
	moves := filepath.Join(root, "move_heavy.pcap")
	if _, err := os.Stat(moves); err != nil {
		t.Skip("fixtures missing, run from repo root")
	}
	outGo, outJS := t.TempDir(), t.TempDir()
	base := RangeScenario{
		Name: "players/probe", Handler: "players", Port: 5056,
		Start: MatchCriteria{Kind: "event", Code: eventcodes.CastSpell}, Nth: 1,
		End: MatchCriteria{Kind: "event", Code: eventcodes.Leave}, Span: 1,
	}

	other := base
	other.Port = 4242
	require.ErrorContains(t, runRange(moves, outGo, outJS, other), "no packet")

	missing := base
	missing.Nth = 4
	require.ErrorContains(t, runRange(moves, outGo, outJS, missing), "start")

	short := base
	short.Span = 9
	require.ErrorContains(t, runRange(moves, outGo, outJS, short), "end")

	head := base
	head.Head = true
	require.ErrorContains(t, runRange(moves, outGo, outJS, head), "Join")
}

func spawnIDs(t *testing.T, path string) []int {
	t.Helper()
	var ids []int
	parser := photon.NewPhotonParser(
		func(e *photon.EventData) {
			photon.PostProcessEvent(e)
			if intFromParam(e.Parameters[252]) == eventcodes.NewCharacter {
				ids = append(ids, intFromParam(e.Parameters[0]))
			}
		},
		func(*photon.OperationRequest) {},
		func(*photon.OperationResponse) {},
	)
	require.NoError(t, iteratePcap(path, func(payload []byte, _, _ uint16) error {
		parser.ReceivePacket(payload)
		return nil
	}))
	return ids
}

// pcap-derived
func TestJoinAndSpawnsOf_KeepsJoinAndNamedSpawns(t *testing.T) {
	root := filepath.Join("..", "..", "internal", "photon", "testdata")
	spawns := filepath.Join(root, "players", "spawn.pcap")
	join := filepath.Join(root, "router", "join-finished.pcap")
	moves := filepath.Join(root, "move_heavy.pcap")
	if _, err := os.Stat(moves); err != nil {
		t.Skip("fixtures missing, run from repo root")
	}
	payloads := append(payloadsOf(t, spawns), payloadsOf(t, join)[:1]...)
	in := filepath.Join(t.TempDir(), "in.pcap")
	require.NoError(t, writePcapFragment(in, append(payloads, payloadsOf(t, moves)...)))
	var distinct []int
	for _, id := range spawnIDs(t, in) {
		if !slices.Contains(distinct, id) {
			distinct = append(distinct, id)
		}
	}
	require.Len(t, distinct, 8)
	named := distinct[2]

	outGo, outJS := t.TempDir(), t.TempDir()
	r := RangeScenario{
		Name: "actions/probe", Handler: "actions", Port: 5056, Keep: joinAndSpawnsOf(named),
		Start: MatchCriteria{Kind: "event", Code: eventcodes.CastSpell}, Nth: 1, End: anyEvent, Span: 1,
	}
	require.NoError(t, runRange(in, outGo, outJS, r))

	out := filepath.Join(outGo, "actions", "probe.pcap")
	events, responses, _ := countCodes(t, out)
	kept := spawnIDs(t, out)
	require.Equal(t, 1, responses[operationcodes.Join], "the Join response of the flow stays")
	require.Contains(t, kept, named, "the packets holding the named spawn stay")
	for _, other := range []int{distinct[0], distinct[4], distinct[6]} {
		require.NotContains(t, kept, other, "the packets holding only other spawns go")
	}
	require.Equal(t, 1, events[eventcodes.CastSpell], "the range starts at the first CastSpell packet")
}
