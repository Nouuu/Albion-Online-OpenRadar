package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
)

// writePcapFragment wraps each payload in a minimal Eth/IPv4/UDP frame; parent dirs created.
func writePcapFragment(path string, packets [][]byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create: %w", err)
	}
	defer f.Close()

	w := pcapgo.NewWriter(f)
	if err := w.WriteFileHeader(1600, layers.LinkTypeEthernet); err != nil {
		return err
	}
	for i, pkt := range packets {
		eth := &layers.Ethernet{
			SrcMAC: []byte{0x02, 0, 0, 0, 0, 0x01}, DstMAC: []byte{0x02, 0, 0, 0, 0, 0x02},
			EthernetType: layers.EthernetTypeIPv4,
		}
		ip := &layers.IPv4{Version: 4, IHL: 5, TTL: 64, Protocol: layers.IPProtocolUDP,
			SrcIP: []byte{10, 0, 0, 1}, DstIP: []byte{10, 0, 0, 2}}
		udp := &layers.UDP{SrcPort: 5056, DstPort: 50000}
		if err := udp.SetNetworkLayerForChecksum(ip); err != nil {
			return err
		}
		buf := gopacket.NewSerializeBuffer()
		opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: true}
		if err := gopacket.SerializeLayers(buf, opts, eth, ip, udp, gopacket.Payload(pkt)); err != nil {
			return err
		}
		if err := w.WritePacket(gopacket.CaptureInfo{
			Timestamp: time.Unix(int64(i), 0), CaptureLength: len(buf.Bytes()), Length: len(buf.Bytes()),
		}, buf.Bytes()); err != nil {
			return err
		}
	}
	return nil
}
