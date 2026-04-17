// Rewrite MACs/IPs/timestamps in a pcap, preserve UDP payloads.
// Usage: go run ./tools/anonymize-pcap <input.pcap> <output.pcap>
package main

import (
	"fmt"
	"net"
	"os"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
)

var (
	fakeClientMAC = net.HardwareAddr{0x02, 0x00, 0x00, 0x00, 0x00, 0x01}
	fakeServerMAC = net.HardwareAddr{0x02, 0x00, 0x00, 0x00, 0x00, 0x02}
	fakeClientIP  = net.IPv4(10, 0, 0, 1)
	fakeServerIP  = net.IPv4(10, 0, 0, 2)
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: anonymize-pcap <input.pcap> <output.pcap>")
		os.Exit(2)
	}
	if err := run(os.Args[1], os.Args[2]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(in, out string) error {
	src, err := os.Open(in)
	if err != nil {
		return err
	}
	defer src.Close()

	reader, err := pcapgo.NewReader(src)
	if err != nil {
		return fmt.Errorf("read %s: %w", in, err)
	}

	dst, err := os.Create(out)
	if err != nil {
		return err
	}
	defer dst.Close()

	writer := pcapgo.NewWriter(dst)
	if err := writer.WriteFileHeader(uint32(reader.Snaplen()), reader.LinkType()); err != nil {
		return err
	}

	macMap := map[string]net.HardwareAddr{}
	ipMap := map[string]net.IP{}
	var nextMAC byte = 1
	var nextIP byte = 1

	pickMAC := func(real net.HardwareAddr) net.HardwareAddr {
		key := real.String()
		if fake, ok := macMap[key]; ok {
			return fake
		}
		nextMAC++
		fake := net.HardwareAddr{0x02, 0x00, 0x00, 0x00, 0x00, nextMAC}
		macMap[key] = fake
		return fake
	}
	pickIP := func(real net.IP) net.IP {
		key := real.String()
		if fake, ok := ipMap[key]; ok {
			return fake
		}
		nextIP++
		fake := net.IPv4(10, 0, 0, nextIP)
		ipMap[key] = fake
		return fake
	}

	macMap["seed-client"] = fakeClientMAC
	macMap["seed-server"] = fakeServerMAC
	ipMap["seed-client"] = fakeClientIP
	ipMap["seed-server"] = fakeServerIP

	var baseTime time.Time
	total := 0
	kept := 0

	for {
		data, ci, err := reader.ReadPacketData()
		if err != nil {
			break
		}
		total++

		pkt := gopacket.NewPacket(data, reader.LinkType(), gopacket.Default)
		eth, _ := pkt.Layer(layers.LayerTypeEthernet).(*layers.Ethernet)
		ip4, _ := pkt.Layer(layers.LayerTypeIPv4).(*layers.IPv4)
		udp, _ := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP)
		if eth == nil || ip4 == nil || udp == nil {
			continue
		}

		eth.SrcMAC = pickMAC(eth.SrcMAC)
		eth.DstMAC = pickMAC(eth.DstMAC)
		ip4.SrcIP = pickIP(ip4.SrcIP)
		ip4.DstIP = pickIP(ip4.DstIP)

		if err := udp.SetNetworkLayerForChecksum(ip4); err != nil {
			return fmt.Errorf("checksum wiring: %w", err)
		}

		buf := gopacket.NewSerializeBuffer()
		opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: true}
		if err := gopacket.SerializePacket(buf, opts, pkt); err != nil {
			return fmt.Errorf("serialize: %w", err)
		}
		out := buf.Bytes()

		if baseTime.IsZero() {
			baseTime = ci.Timestamp
		}
		newCI := gopacket.CaptureInfo{
			Timestamp:     time.Unix(0, 0).Add(ci.Timestamp.Sub(baseTime)),
			CaptureLength: len(out),
			Length:        len(out),
		}
		if err := writer.WritePacket(newCI, out); err != nil {
			return err
		}
		kept++
	}

	fmt.Printf("%d packets read, %d anonymized packets written to %s\n", total, kept, out)
	return nil
}
