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

	err := runWithOptions(in, out, []string{"Bob"})
	require.NoError(t, err)

	payloads := readPayloads(t, out)
	require.Len(t, payloads, 2)
	require.True(t, bytes.Contains(payloads[0], []byte("hello XXX goodbye")))
	require.False(t, bytes.Contains(payloads[0], []byte("Bob")))
	require.Equal(t, []byte("unrelated"), payloads[1])
}

func TestScrubString_EmptyListIsNoOpOnPayload(t *testing.T) {
	dir := t.TempDir()
	in := filepath.Join(dir, "in.pcap")
	out := filepath.Join(dir, "out.pcap")

	writeFixturePcap(t, in, [][]byte{[]byte("hello Bob goodbye")})

	err := runWithOptions(in, out, nil)
	require.NoError(t, err)

	payloads := readPayloads(t, out)
	require.Len(t, payloads, 1)
	require.Equal(t, []byte("hello Bob goodbye"), payloads[0])
}
