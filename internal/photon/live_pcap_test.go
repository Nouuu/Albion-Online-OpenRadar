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

type pcapStats struct {
	events    map[byte]int
	requests  map[byte]int
	responses map[byte]int
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
	}
	parser := NewPhotonParser(
		func(e *EventData) {
			PostProcessEvent(e)
			stats.events[e.Code]++
		},
		func(r *OperationRequest) {
			PostProcessRequest(r)
			stats.requests[r.OperationCode]++
		},
		func(r *OperationResponse) {
			PostProcessResponse(r)
			stats.responses[r.OperationCode]++
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
}

func TestLivePcap_GenericEvents(t *testing.T) {
	stats := replayPcap(t, fixturePath(t, "generic_events.pcap"))
	require.GreaterOrEqual(t, stats.events[1], 50,
		"expected generic (dispatch byte 1) events, saw %v", stats.events)
}

func TestLivePcap_Operations(t *testing.T) {
	stats := replayPcap(t, fixturePath(t, "operations.pcap"))
	totalOps := 0
	for _, n := range stats.requests {
		totalOps += n
	}
	for _, n := range stats.responses {
		totalOps += n
	}
	require.Greater(t, totalOps, 0,
		"expected at least one request/response, saw req=%v resp=%v", stats.requests, stats.responses)
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
