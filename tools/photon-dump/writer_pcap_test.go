package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/stretchr/testify/require"
)

func TestWritePcapFragment_RoundTrip(t *testing.T) {
	dir := t.TempDir()
	out := filepath.Join(dir, "sub", "frag.pcap")

	packets := [][]byte{
		append([]byte("hdr1-"), make([]byte, 40)...),
		append([]byte("hdr2-"), make([]byte, 40)...),
	}

	require.NoError(t, writePcapFragment(out, packets))

	f, err := os.Open(out)
	require.NoError(t, err)
	defer f.Close()
	r, err := pcapgo.NewReader(f)
	require.NoError(t, err)
	require.Equal(t, layers.LinkTypeEthernet, r.LinkType())

	var got int
	for {
		data, _, err := r.ReadPacketData()
		if err != nil {
			break
		}
		require.NotEmpty(t, data)
		_ = gopacket.NewPacket(data, r.LinkType(), gopacket.Default)
		got++
	}
	require.Equal(t, 2, got)
}
