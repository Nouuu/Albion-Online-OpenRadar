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
)

// writeMiniPcap emits N UDP packets with given payloads (port 5056 both ways).
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
