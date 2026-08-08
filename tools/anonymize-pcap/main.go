// Rewrite MACs, IPs, timestamps in a pcap. --scrub-string (repeatable)
// ASCII-replaces matches in UDP payloads with same-length 'X' padding.
//
// Usage: go run ./tools/anonymize-pcap --scrub-string name [--scrub-string name]... <input.pcap> <output.pcap>
//
//	go run ./tools/anonymize-pcap --no-scrub <input.pcap> <output.pcap>
package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"os"
	"sort"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
)

type stringList []string

func (s *stringList) String() string     { return fmt.Sprintf("%v", []string(*s)) }
func (s *stringList) Set(v string) error { *s = append(*s, v); return nil }

const usage = "usage: anonymize-pcap [--scrub-string name]... <input.pcap> <output.pcap>\n" +
	"       anonymize-pcap --no-scrub <input.pcap> <output.pcap>\n" +
	"flags must come before the two paths"

type options struct {
	in      string
	out     string
	scrubs  []string
	noScrub bool
}

func parseArgs(args []string) (options, error) {
	var scrub stringList
	var noScrub bool

	fs := flag.NewFlagSet("anonymize-pcap", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	fs.Var(&scrub, "scrub-string", "extra ASCII string to replace on top of the identity fields (repeatable)")
	fs.BoolVar(&noScrub, "no-scrub", false, "write the capture without touching UDP payloads")
	if err := fs.Parse(args); err != nil {
		return options{}, err
	}
	if fs.NArg() != 2 {
		return options{}, errors.New(usage)
	}
	if noScrub && len(scrub) > 0 {
		return options{}, errors.New("--no-scrub cannot be combined with --scrub-string")
	}

	return options{in: fs.Arg(0), out: fs.Arg(1), scrubs: scrub, noScrub: noScrub}, nil
}

func main() {
	opts, err := parseArgs(os.Args[1:])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	var identity []string
	if !opts.noScrub {
		identity, err = collectIdentityValues(opts.in)
		if err != nil {
			fmt.Fprintln(os.Stderr, "error:", err)
			os.Exit(1)
		}
	}

	if err := run(opts, identity); err != nil {
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

func run(opts options, identity []string) error {
	return runWithOptions(opts.in, opts.out, opts.scrubs, identity)
}

func runWithOptions(in, out string, scrubs, identity []string) error {
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

	counts := make(map[string]int, len(scrubs)+len(identity))
	for _, n := range scrubs {
		counts[n] = 0
	}
	for _, n := range identity {
		counts[n] = 0
	}

	var baseTime time.Time
	total := 0
	kept := 0

	type decoded struct {
		eth *layers.Ethernet
		ip4 *layers.IPv4
		udp *layers.UDP
		ci  gopacket.CaptureInfo
	}
	var packets []decoded

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

		if len(identity) > 0 {
			udp.Payload = scrubPrefixedValues(udp.Payload, identity, counts)
		}
		if len(scrubs) > 0 {
			udp.Payload = scrubPayload(udp.Payload, scrubs, counts)
		}

		packets = append(packets, decoded{eth: eth, ip4: ip4, udp: udp, ci: ci})
	}

	if len(identity) > 0 {
		payloads := make([][]byte, len(packets))
		for i, p := range packets {
			payloads[i] = p.udp.Payload
		}
		scrubSplitValues(payloads, identity, counts)
	}

	for _, p := range packets {
		eth, ip4, udp, ci := p.eth, p.ip4, p.udp, p.ci

		buf := gopacket.NewSerializeBuffer()
		opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: true}
		// SerializeLayers picks up the mutated udp.Payload; SerializePacket would reuse the original parsed layer.
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
	reportScrubCounts(os.Stdout, counts)
	return nil
}

func reportScrubCounts(w io.Writer, counts map[string]int) {
	if len(counts) == 0 {
		return
	}
	needles := make([]string, 0, len(counts))
	for n := range counts {
		needles = append(needles, n)
	}
	sort.Strings(needles)

	for _, n := range needles {
		fmt.Fprintf(w, "  %s: %d replacements\n", n, counts[n])
	}
}

const scrubByte = 'X'

// scrubPayload applies needles in order; overlapping matches resolve by first match wins. ASCII only.
func scrubPayload(payload []byte, needles []string, counts map[string]int) []byte {
	if len(needles) == 0 {
		return payload
	}
	out := append([]byte(nil), payload...)
	for _, n := range needles {
		if n == "" {
			continue
		}
		hits := bytes.Count(out, []byte(n))
		if hits == 0 {
			continue
		}
		counts[n] += hits
		pad := bytes.Repeat([]byte{scrubByte}, len(n))
		out = bytes.ReplaceAll(out, []byte(n), pad)
	}
	return out
}
