package photon

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/stretchr/testify/require"
)

type decodedOp struct {
	kind       string
	realCode   int
	paramKeys  map[byte]bool
	returnCode int16
}

type pcapStats struct {
	events    map[byte]int
	requests  map[byte]int
	responses map[byte]int
	ops       map[string][]decodedOp
}

func replayPcap(t *testing.T, path string) pcapStats {
	t.Helper()
	f, err := os.Open(path)
	require.NoError(t, err)
	defer f.Close()

	reader, err := pcapgo.NewReader(f)
	require.NoError(t, err)

	stats := pcapStats{
		events:    map[byte]int{},
		requests:  map[byte]int{},
		responses: map[byte]int{},
		ops:       map[string][]decodedOp{},
	}

	recordOp := func(kind string, realCode int, params map[byte]interface{}, rc int16) {
		keys := make(map[byte]bool, len(params))
		for k := range params {
			keys[k] = true
		}
		stats.ops[kind] = append(stats.ops[kind], decodedOp{
			kind:       kind,
			realCode:   realCode,
			paramKeys:  keys,
			returnCode: rc,
		})
	}

	parser := NewPhotonParser(
		func(e *EventData) {
			PostProcessEvent(e)
			stats.events[e.Code]++
			recordOp("event", intFromParam(e.Parameters[252]), e.Parameters, 0)
		},
		func(r *OperationRequest) {
			PostProcessRequest(r)
			stats.requests[r.OperationCode]++
			recordOp("request", intFromParam(r.Parameters[253]), r.Parameters, 0)
		},
		func(r *OperationResponse) {
			PostProcessResponse(r)
			stats.responses[r.OperationCode]++
			recordOp("response", intFromParam(r.Parameters[253]), r.Parameters, r.ReturnCode)
		},
	)

	for {
		data, _, err := reader.ReadPacketData()
		if err != nil {
			break
		}
		pkt := gopacket.NewPacket(data, layers.LayerTypeEthernet, gopacket.Default)
		if udp := pkt.Layer(layers.LayerTypeUDP); udp != nil {
			parser.ReceivePacket(udp.(*layers.UDP).Payload)
		}
	}
	return stats
}

func intFromParam(v interface{}) int {
	switch x := v.(type) {
	case byte:
		return int(x)
	case int8:
		return int(x)
	case int16:
		return int(x)
	case int32:
		return int(x)
	case int64:
		return int(x)
	}
	return -1
}

func (s pcapStats) countRouterOps(kind string, realCode int) int {
	n := 0
	for _, op := range s.ops[kind] {
		if op.realCode == realCode {
			n++
		}
	}
	return n
}

func (s pcapStats) hasRouterOp(kind string, realCode int, requiredKeys ...byte) bool {
	for _, op := range s.ops[kind] {
		if op.realCode != realCode {
			continue
		}
		ok := true
		for _, k := range requiredKeys {
			if !op.paramKeys[k] {
				ok = false
				break
			}
		}
		if ok {
			return true
		}
	}
	return false
}

func fixturePath(t *testing.T, name string) string {
	t.Helper()
	path := filepath.Join("testdata", name)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skipf("fixture missing: %s", path)
	}
	return path
}

// Anonymized live Albion post-patch traffic. Real IPs, MACs and timestamps
// were rewritten; UDP payloads (the Photon protocol under test) are intact.
// Per-code parameter layouts observed in this capture are documented in
// docs/technical/PROTOCOL18_PARAM_LAYOUTS.md.

func TestLivePcap_MoveHeavy(t *testing.T) {
	stats := replayPcap(t, fixturePath(t, "move_heavy.pcap"))
	require.GreaterOrEqual(t, stats.events[3], 100,
		"expected many Move events, saw %v", stats.events)
	require.True(t, stats.hasRouterOp("event", 3, 4, 5),
		"at least one Move event must carry finite Parameters[4] and [5]")
}

func TestLivePcap_GenericEvents(t *testing.T) {
	stats := replayPcap(t, fixturePath(t, "generic_events.pcap"))
	require.GreaterOrEqual(t, stats.events[1], 50,
		"expected generic (dispatch byte 1) events, saw %v", stats.events)
	// NewCharacter (real code 29) spawns a player; Parameters[1] is the name.
	require.True(t, stats.hasRouterOp("event", 29, 1),
		"expected at least one NewCharacter event with Parameters[1] (name)")
}

func TestLivePcap_Operations(t *testing.T) {
	stats := replayPcap(t, fixturePath(t, "operations.pcap"))
	// Under Protocol18 the wire OperationCode is always 1; real code lives
	// in Parameters[253]. Assert the Move request shape the frontend reads.
	require.GreaterOrEqual(t,
		stats.countRouterOps("request", 22), 100,
		"expected >=100 Move requests (real=22), saw req(real)=%v", stats.ops["request"])
	require.True(t, stats.hasRouterOp("request", 22, 0, 1, 3, 253),
		"Move request missing expected keys [0,1,3,253]")
}

func TestLivePcap_Fragments(t *testing.T) {
	stats := replayPcap(t, fixturePath(t, "fragments.pcap"))
	decoded := 0
	for _, n := range stats.events {
		decoded += n
	}
	for _, n := range stats.requests {
		decoded += n
	}
	for _, n := range stats.responses {
		decoded += n
	}
	require.Greater(t, decoded, 0,
		"expected at least one decoded message across fragments, saw events=%v", stats.events)
}

// Protocol18 carries the real op code in Parameters[253]; the frontend
// router dispatches on that key. Add rows when a new frontend-visible
// code or fixture needs coverage.
func TestLivePcap_RouterContract(t *testing.T) {
	type signal struct {
		kind         string
		realCode     int
		min          int
		requiredKeys []byte
		desc         string
	}

	cases := []struct {
		fixture string
		signals []signal
	}{
		{
			fixture: "move_map_change.pcap",
			signals: []signal{
				{"request", 22, 50, []byte{0, 1, 3, 253}, "Move (sets lpX/lpY via Parameters[1])"},
				{"response", 2, 1, []byte{8, 9, 253}, "JoinFinished (sets lpX/lpY via Parameters[9], mapId via [8])"},
				{"response", 41, 1, []byte{0, 253}, "ChangeCluster (new map id in Parameters[0])"},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.fixture, func(t *testing.T) {
			stats := replayPcap(t, fixturePath(t, tc.fixture))
			for _, sig := range tc.signals {
				got := stats.countRouterOps(sig.kind, sig.realCode)
				require.GreaterOrEqual(t, got, sig.min,
					"%s real=%d (%s): expected >=%d, got %d",
					sig.kind, sig.realCode, sig.desc, sig.min, got)
				require.True(t,
					stats.hasRouterOp(sig.kind, sig.realCode, sig.requiredKeys...),
					"%s real=%d (%s): no decoded op carried all required keys %v",
					sig.kind, sig.realCode, sig.desc, sig.requiredKeys)
			}
		})
	}
}
