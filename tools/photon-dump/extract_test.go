package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/stretchr/testify/require"

	"github.com/nospy/albion-openradar/internal/photon"
)

func writeMiniPcap(t *testing.T, path string, payloads [][]byte) {
	t.Helper()
	f, err := os.Create(path)
	require.NoError(t, err)
	defer f.Close()
	w := pcapgo.NewWriter(f)
	require.NoError(t, w.WriteFileHeader(1600, layers.LinkTypeEthernet))
	for i, payload := range payloads {
		eth := &layers.Ethernet{
			SrcMAC: []byte{0xaa, 0, 0, 0, 0, 1}, DstMAC: []byte{0xbb, 0, 0, 0, 0, 2},
			EthernetType: layers.EthernetTypeIPv4,
		}
		ip := &layers.IPv4{Version: 4, IHL: 5, TTL: 64, Protocol: layers.IPProtocolUDP,
			SrcIP: []byte{10, 0, 0, 1}, DstIP: []byte{10, 0, 0, 2}}
		udp := &layers.UDP{SrcPort: 5056, DstPort: 50000}
		require.NoError(t, udp.SetNetworkLayerForChecksum(ip))
		buf := gopacket.NewSerializeBuffer()
		opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: true}
		require.NoError(t, gopacket.SerializeLayers(buf, opts, eth, ip, udp, gopacket.Payload(payload)))
		require.NoError(t, w.WritePacket(gopacket.CaptureInfo{
			Timestamp: time.Unix(int64(i), 0), CaptureLength: len(buf.Bytes()), Length: len(buf.Bytes()),
		}, buf.Bytes()))
	}
}

func TestIteratePcap_CountsUdpPayloads(t *testing.T) {
	dir := t.TempDir()
	in := filepath.Join(dir, "mini.pcap")
	writeMiniPcap(t, in, [][]byte{
		{0x01, 0x02},
		{0x03, 0x04, 0x05},
	})
	var got int
	err := iteratePcap(in, func(payload []byte) error { got++; return nil })
	require.NoError(t, err)
	require.Equal(t, 2, got)
}

func evt(code int, id int64) *photon.EventData {
	return &photon.EventData{Code: 1, Parameters: map[byte]any{0: id, 252: int64(code)}}
}

func TestCollector_KeepsCorrelatedFollowUps(t *testing.T) {
	sc := Scenario{
		Name: "h/follow", Handler: "h",
		Match:       MatchCriteria{Kind: "event", Code: 40},
		FollowUps:   []MatchCriteria{{Kind: "event", Code: 1}},
		CorrelateBy: 0,
		Limit:       1,
	}
	c := newCollector([]Scenario{sc})
	feed := func(e *photon.EventData, raw string) {
		c.offer([]byte(raw), "event", e.Parameters, 0, func(m MatchCriteria) bool { return matchesEvent(m, e) })
	}
	feed(evt(1, 7), "leave-before")
	feed(evt(40, 7), "spawn")
	feed(evt(1, 8), "leave-other")
	feed(evt(1, 7), "leave-after")
	feed(evt(40, 9), "spawn-over-limit")
	feed(evt(1, 9), "leave-of-over-limit")

	var raws []string
	for _, h := range c.hits["h/follow"] {
		raws = append(raws, string(h.raw))
	}
	require.Equal(t, []string{"spawn", "leave-after"}, raws)
}
