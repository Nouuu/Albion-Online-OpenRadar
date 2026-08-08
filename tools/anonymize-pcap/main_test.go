package main

import (
	"bytes"
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/stretchr/testify/require"
)

func writeFixturePcap(t *testing.T, path string, payloads [][]byte) {
	t.Helper()
	f, err := os.Create(path)
	require.NoError(t, err)
	defer f.Close()
	w := pcapgo.NewWriter(f)
	require.NoError(t, w.WriteFileHeader(1600, layers.LinkTypeEthernet))

	for i, payload := range payloads {
		eth := &layers.Ethernet{
			SrcMAC:       []byte{0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0x01},
			DstMAC:       []byte{0xbb, 0xbb, 0xbb, 0xbb, 0xbb, 0x02},
			EthernetType: layers.EthernetTypeIPv4,
		}
		ip := &layers.IPv4{
			Version: 4, IHL: 5, TTL: 64, Protocol: layers.IPProtocolUDP,
			SrcIP: []byte{192, 168, 0, 10}, DstIP: []byte{5, 188, 125, 1},
		}
		udp := &layers.UDP{SrcPort: 50000, DstPort: 5056}
		require.NoError(t, udp.SetNetworkLayerForChecksum(ip))

		buf := gopacket.NewSerializeBuffer()
		opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: true}
		require.NoError(t, gopacket.SerializeLayers(buf, opts, eth, ip, udp, gopacket.Payload(payload)))

		require.NoError(t, w.WritePacket(gopacket.CaptureInfo{
			Timestamp:     time.Unix(int64(i), 0),
			CaptureLength: len(buf.Bytes()),
			Length:        len(buf.Bytes()),
		}, buf.Bytes()))
	}
}

func readPayloads(t *testing.T, path string) [][]byte {
	t.Helper()
	f, err := os.Open(path)
	require.NoError(t, err)
	defer f.Close()
	r, err := pcapgo.NewReader(f)
	require.NoError(t, err)

	var out [][]byte
	for {
		data, _, err := r.ReadPacketData()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		pkt := gopacket.NewPacket(data, r.LinkType(), gopacket.Default)
		udp, _ := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP)
		require.NotNil(t, udp)
		out = append(out, append([]byte(nil), udp.Payload...))
	}
	return out
}

func TestScrubString_ReplacesAsciiNameWithSameLengthPadding(t *testing.T) {
	dir := t.TempDir()
	in := filepath.Join(dir, "in.pcap")
	out := filepath.Join(dir, "out.pcap")

	writeFixturePcap(t, in, [][]byte{
		[]byte("hello Bob goodbye"),
		[]byte("unrelated"),
	})

	err := runWithOptions(in, out, []string{"Bob"}, nil)
	require.NoError(t, err)

	payloads := readPayloads(t, out)
	require.Len(t, payloads, 2)
	require.True(t, bytes.Contains(payloads[0], []byte("hello XXX goodbye")))
	require.False(t, bytes.Contains(payloads[0], []byte("Bob")))
	require.Equal(t, []byte("unrelated"), payloads[1])
}

func TestParseArgs_DefaultsToScrubbingIdentityFields(t *testing.T) {
	opts, err := parseArgs([]string{"in.pcap", "out.pcap"})

	require.NoError(t, err)
	require.False(t, opts.noScrub)
	require.Empty(t, opts.scrubs)
}

func TestParseArgs_AcceptsExplicitNoScrub(t *testing.T) {
	opts, err := parseArgs([]string{"--no-scrub", "in.pcap", "out.pcap"})

	require.NoError(t, err)
	require.True(t, opts.noScrub)
	require.Empty(t, opts.scrubs)
	require.Equal(t, "in.pcap", opts.in)
	require.Equal(t, "out.pcap", opts.out)
}

func TestParseArgs_AcceptsRepeatedScrubStrings(t *testing.T) {
	opts, err := parseArgs([]string{"--scrub-string", "Alice", "--scrub-string", "Bob", "in.pcap", "out.pcap"})

	require.NoError(t, err)
	require.False(t, opts.noScrub)
	require.Equal(t, []string{"Alice", "Bob"}, opts.scrubs)
}

func TestParseArgs_RejectsScrubStringCombinedWithNoScrub(t *testing.T) {
	_, err := parseArgs([]string{"--no-scrub", "--scrub-string", "Alice", "in.pcap", "out.pcap"})

	require.Error(t, err)
	require.Contains(t, err.Error(), "--no-scrub")
}

func TestParseArgs_RejectsWrongPositionalCount(t *testing.T) {
	_, err := parseArgs([]string{"--no-scrub", "in.pcap"})

	require.Error(t, err)
	require.Contains(t, err.Error(), "usage")
}

func TestParseArgs_RejectsFlagsPlacedAfterThePaths(t *testing.T) {
	_, err := parseArgs([]string{"in.pcap", "out.pcap", "--scrub-string", "Alice"})

	require.Error(t, err)
	require.Contains(t, err.Error(), "before the two paths")
}

func TestScrubPayload_CountsReplacementsPerNeedle(t *testing.T) {
	counts := map[string]int{"Bob": 0, "Alice": 0}

	out := scrubPayload([]byte("Bob met Bob and Alice"), []string{"Bob", "Alice"}, counts)

	require.Equal(t, []byte("XXX met XXX and XXXXX"), out)
	require.Equal(t, 2, counts["Bob"])
	require.Equal(t, 1, counts["Alice"])
}

func TestScrubPayload_LeavesAbsentNeedleAtZero(t *testing.T) {
	counts := map[string]int{"Skoggangr": 0}

	out := scrubPayload([]byte("nothing to see"), []string{"Skoggangr"}, counts)

	require.Equal(t, []byte("nothing to see"), out)
	require.Equal(t, 0, counts["Skoggangr"])
}

func TestScrubString_EmptyListIsNoOpOnPayload(t *testing.T) {
	dir := t.TempDir()
	in := filepath.Join(dir, "in.pcap")
	out := filepath.Join(dir, "out.pcap")

	writeFixturePcap(t, in, [][]byte{[]byte("hello Bob goodbye")})

	err := runWithOptions(in, out, nil, nil)
	require.NoError(t, err)

	payloads := readPayloads(t, out)
	require.Len(t, payloads, 1)
	require.Equal(t, []byte("hello Bob goodbye"), payloads[0])
}
