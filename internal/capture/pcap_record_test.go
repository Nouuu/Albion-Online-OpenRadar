package capture

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/google/gopacket/pcapgo"
)

// pcap-derived: fixture from internal/photon/testdata/fragments.pcap (real Albion capture).
const photonFixture = "../photon/testdata/fragments.pcap"

// newCapturerFromOffline opens a pcap fixture to obtain a real *pcap.Handle
// and returns a Capturer wired to it. The handle is closed by c.Close().
func newCapturerFromOffline(t *testing.T, fixturePath string) *Capturer {
	t.Helper()
	handle, err := pcap.OpenOffline(fixturePath)
	if err != nil {
		t.Skipf("cannot open fixture %s: %v", fixturePath, err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	return &Capturer{
		handle: handle,
		ctx:    ctx,
		cancel: cancel,
	}
}

func TestStartRecording_CreatesReadableFile(t *testing.T) {
	c := newCapturerFromOffline(t, photonFixture)
	defer c.Close()

	sourceLinkType := c.handle.LinkType()

	dir := t.TempDir()
	if err := c.StartRecording(dir); err != nil {
		t.Fatalf("StartRecording: %v", err)
	}
	defer c.StopRecording() //nolint:errcheck // cleanup path in test

	matches, err := filepath.Glob(filepath.Join(dir, "capture_*.pcap"))
	if err != nil {
		t.Fatalf("Glob: %v", err)
	}
	if len(matches) != 1 {
		t.Fatalf("want exactly one capture_*.pcap, got %v", matches)
	}

	h, err := pcap.OpenOffline(matches[0])
	if err != nil {
		t.Fatalf("OpenOffline on recorded file: %v", err)
	}
	defer h.Close()
	if h.LinkType() != sourceLinkType {
		t.Errorf("recorded LinkType() = %v, want %v", h.LinkType(), sourceLinkType)
	}
}

func TestStartRecording_TwiceIsAnError(t *testing.T) {
	c := newCapturerFromOffline(t, photonFixture)
	defer c.Close()

	dir := t.TempDir()
	if err := c.StartRecording(dir); err != nil {
		t.Fatalf("first StartRecording: %v", err)
	}
	defer c.StopRecording() //nolint:errcheck // cleanup path in test

	if err := c.StartRecording(dir); err == nil {
		t.Fatal("second StartRecording: expected error, got nil")
	}
}

func TestStopRecording_BeforeStartIsNoOp(t *testing.T) {
	c := newCapturerFromOffline(t, photonFixture)
	defer c.Close()

	if err := c.StopRecording(); err != nil {
		t.Fatalf("StopRecording on fresh capturer: %v", err)
	}
}

// TestProcessPacket_WritesToRecorder feeds synthetic Ethernet+UDP packets
// through the capturer's processPacket while recording, then verifies the
// recorded file contains exactly those packets.
//
// synthetic: packets are constructed in-process; no live Albion traffic needed.
func TestProcessPacket_WritesToRecorder(t *testing.T) {
	c := newCapturerFromOffline(t, photonFixture)
	defer c.Close()

	dir := t.TempDir()
	if err := c.StartRecording(dir); err != nil {
		t.Fatalf("StartRecording: %v", err)
	}

	payloads := [][]byte{
		[]byte("hello"),
		[]byte("world"),
	}

	for _, pl := range payloads {
		pkt := buildUDPPacket(t, pl)
		c.processPacket(pkt)
	}

	if err := c.StopRecording(); err != nil {
		t.Fatalf("StopRecording: %v", err)
	}

	matches, err := filepath.Glob(filepath.Join(dir, "capture_*.pcap"))
	if err != nil || len(matches) != 1 {
		t.Fatalf("expected one capture file, Glob returned %v err=%v", matches, err)
	}

	f, err := os.Open(matches[0])
	if err != nil {
		t.Fatalf("open recorded file: %v", err)
	}
	defer f.Close()

	reader, err := pcapgo.NewReader(f)
	if err != nil {
		t.Fatalf("pcapgo.NewReader: %v", err)
	}

	src := gopacket.NewPacketSource(reader, reader.LinkType())
	got := 0
	for pkt := range src.Packets() {
		if got >= len(payloads) {
			t.Fatalf("more packets than expected in recording")
		}
		udpLayer := pkt.Layer(layers.LayerTypeUDP)
		if udpLayer == nil {
			t.Fatalf("packet %d: no UDP layer", got)
		}
		udp := udpLayer.(*layers.UDP)
		if !bytes.Equal(udp.Payload, payloads[got]) {
			t.Errorf("packet %d payload = %q, want %q", got, udp.Payload, payloads[got])
		}
		got++
	}
	if got != len(payloads) {
		t.Errorf("recorded %d packets, want %d", got, len(payloads))
	}
}

func TestClose_StopsRecording(t *testing.T) {
	c := newCapturerFromOffline(t, photonFixture)

	dir := t.TempDir()
	if err := c.StartRecording(dir); err != nil {
		t.Fatalf("StartRecording: %v", err)
	}

	payload := []byte("closepkt")
	pkt := buildUDPPacket(t, payload)
	c.processPacket(pkt)

	c.Close()

	matches, err := filepath.Glob(filepath.Join(dir, "capture_*.pcap"))
	if err != nil || len(matches) != 1 {
		t.Fatalf("expected one capture file after Close, got %v err=%v", matches, err)
	}

	f, err := os.Open(matches[0])
	if err != nil {
		t.Fatalf("open recorded file after Close: %v", err)
	}
	defer f.Close()

	reader, err := pcapgo.NewReader(f)
	if err != nil {
		t.Fatalf("pcapgo.NewReader: %v", err)
	}

	src := gopacket.NewPacketSource(reader, reader.LinkType())
	got := 0
	for pkt := range src.Packets() {
		udpLayer := pkt.Layer(layers.LayerTypeUDP)
		if udpLayer == nil {
			t.Fatalf("packet %d: no UDP layer", got)
		}
		udp := udpLayer.(*layers.UDP)
		if !bytes.Equal(udp.Payload, payload) {
			t.Errorf("packet %d payload = %q, want %q", got, udp.Payload, payload)
		}
		got++
	}
	if got != 1 {
		t.Errorf("recorded %d packets, want 1", got)
	}
}

// buildUDPPacket constructs a minimal Ethernet+IPv4+UDP packet carrying payload
// on UDP src/dst port AlbionPort so processPacket's BPF-free path picks it up.
func buildUDPPacket(t *testing.T, payload []byte) gopacket.Packet {
	t.Helper()

	buf := gopacket.NewSerializeBuffer()
	opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: false}

	eth := &layers.Ethernet{
		SrcMAC:       []byte{0, 0, 0, 0, 0, 1},
		DstMAC:       []byte{0, 0, 0, 0, 0, 2},
		EthernetType: layers.EthernetTypeIPv4,
	}
	ip := &layers.IPv4{
		Version:  4,
		TTL:      64,
		Protocol: layers.IPProtocolUDP,
		SrcIP:    []byte{127, 0, 0, 1},
		DstIP:    []byte{127, 0, 0, 1},
	}
	udp := &layers.UDP{
		SrcPort: AlbionPort,
		DstPort: AlbionPort,
	}
	udp.SetNetworkLayerForChecksum(ip)

	if err := gopacket.SerializeLayers(buf, opts, eth, ip, udp, gopacket.Payload(payload)); err != nil {
		t.Fatalf("SerializeLayers: %v", err)
	}

	pkt := gopacket.NewPacket(buf.Bytes(), layers.LayerTypeEthernet, gopacket.Default)
	ci := gopacket.CaptureInfo{
		Timestamp:     time.Now(),
		CaptureLength: len(buf.Bytes()),
		Length:        len(buf.Bytes()),
	}
	pkt.Metadata().CaptureInfo = ci
	return pkt
}
