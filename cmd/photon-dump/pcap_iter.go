package main

import (
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
)

// iteratePcap reads every packet in the pcap and invokes fn with the UDP payload.
// Non-UDP packets are skipped silently. io.EOF terminates iteration cleanly;
// other read errors propagate as-is.
func iteratePcap(path string, fn func(payload []byte) error) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()
	r, err := pcapgo.NewReader(f)
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	for {
		data, _, err := r.ReadPacketData()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read packet: %w", err)
		}
		pkt := gopacket.NewPacket(data, r.LinkType(), gopacket.Default)
		udp, _ := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP)
		if udp == nil {
			continue
		}
		if err := fn(udp.Payload); err != nil {
			return err
		}
	}
}
