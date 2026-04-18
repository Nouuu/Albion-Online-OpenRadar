// Rewrite MACs/IPs/timestamps in a pcap, preserve UDP payloads.
// Optional --scrub-string <value> (repeatable): ASCII byte-level replacement
// with same-length 'X' padding inside UDP payloads. Use to remove the local
// player name before committing anonymized fragments.
//
// Usage:
//   go run ./tools/anonymize-pcap <input.pcap> <output.pcap> [--scrub-string name]...
package main

import (
	"bytes"
	"flag"
	"fmt"
	"net"
	"os"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
)

type stringList []string

func (s *stringList) String() string     { return fmt.Sprintf("%v", []string(*s)) }
func (s *stringList) Set(v string) error { *s = append(*s, v); return nil }

func main() {
	var scrub stringList
	fs := flag.NewFlagSet("anonymize-pcap", flag.ExitOnError)
	fs.Var(&scrub, "scrub-string", "ASCII string to replace in UDP payloads with same-length 'X' padding (repeatable)")
	if err := fs.Parse(os.Args[1:]); err != nil {
		os.Exit(2)
	}
	if fs.NArg() != 2 {
		fmt.Fprintln(os.Stderr, "usage: anonymize-pcap <input.pcap> <output.pcap> [--scrub-string name]...")
		os.Exit(2)
	}
	if err := runWithOptions(fs.Arg(0), fs.Arg(1), scrub); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

var (
	fakeClientMAC = net.HardwareAddr{0x02, 0x00, 0x00, 0x00, 0x00, 0x01}
	fakeServerMAC = net.HardwareAddr{0x02, 0x00, 0x00, 0x00, 0x00, 0x02}
	fakeClientIP  = net.IPv4(10, 0, 0, 1)
	fakeServerIP  = net.IPv4(10, 0, 0, 2)
)

func runWithOptions(in, out string, scrubs []string) error {
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

		if len(scrubs) > 0 {
			udp.Payload = scrubPayload(udp.Payload, scrubs)
		}

		buf := gopacket.NewSerializeBuffer()
		opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: true}
		// SerializeLayers (not SerializePacket) so that the modified udp.Payload
		// is used as the payload, rather than the original parsed Payload layer.
		if err := gopacket.SerializeLayers(buf, opts, eth, ip4, udp, gopacket.Payload(udp.Payload)); err != nil {
			return fmt.Errorf("serialize: %w", err)
		}
		outBytes := buf.Bytes()

		if baseTime.IsZero() {
			baseTime = ci.Timestamp
		}
		newCI := gopacket.CaptureInfo{
			Timestamp:     time.Unix(0, 0).Add(ci.Timestamp.Sub(baseTime)),
			CaptureLength: len(outBytes),
			Length:        len(outBytes),
		}
		if err := writer.WritePacket(newCI, outBytes); err != nil {
			return err
		}
		kept++
	}

	fmt.Printf("%d packets read, %d anonymized packets written to %s\n", total, kept, out)
	return nil
}

func scrubPayload(payload []byte, needles []string) []byte {
	if len(needles) == 0 {
		return payload
	}
	out := append([]byte(nil), payload...)
	for _, n := range needles {
		if n == "" {
			continue
		}
		pad := bytes.Repeat([]byte{'X'}, len(n))
		out = bytes.ReplaceAll(out, []byte(n), pad)
	}
	return out
}
