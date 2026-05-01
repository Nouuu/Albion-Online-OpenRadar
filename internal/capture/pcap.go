package capture

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/google/gopacket/pcapgo"

	"github.com/nospy/albion-openradar/internal/logger"
)

var reUnsafeFilename = regexp.MustCompile(`[^A-Za-z0-9_\-]`)

const (
	AlbionPort  = 5056
	SnapLen     = 65536
	Promiscuous = false
	ReadTimeout = 100 * time.Millisecond
)

type NetworkInterface struct {
	Name        string
	Description string
	Address     string
	Device      string
}

type PacketHandler func(payload []byte)

type Capturer struct {
	handle    *pcap.Handle
	iface     NetworkInterface
	onPacket  PacketHandler
	ctx       context.Context
	cancel    context.CancelFunc
	closeOnce sync.Once

	bytesReceived uint64

	recordMu          sync.Mutex
	recordFile        *os.File
	recordWriter      *pcapgo.Writer
	recordWriteErrors uint64
}

// captureFactory is overridable in tests; restore via t.Cleanup.
var captureFactory = openLiveCapture

// findAllDevs is overridable in tests; restore via t.Cleanup.
var findAllDevs = pcap.FindAllDevs

func openLiveCapture(ctx context.Context, iface NetworkInterface) (*Capturer, error) {
	handle, err := pcap.OpenLive(iface.Device, SnapLen, Promiscuous, ReadTimeout)
	if err != nil {
		return nil, fmt.Errorf("open device %q: %w", iface.Device, err)
	}
	filter := fmt.Sprintf("udp and (dst port %d or src port %d)", AlbionPort, AlbionPort)
	if err := handle.SetBPFFilter(filter); err != nil {
		handle.Close()
		return nil, fmt.Errorf("set BPF filter on %q: %w", iface.Device, err)
	}
	//nolint:gosec // G118: cancel is stored on Capturer and invoked by Close().
	cctx, cancel := context.WithCancel(ctx)
	return &Capturer{
		handle: handle,
		iface:  iface,
		ctx:    cctx,
		cancel: cancel,
	}, nil
}

func (c *Capturer) OnPacket(h PacketHandler) { c.onPacket = h }

func (c *Capturer) Start() error {
	if c.handle == nil {
		// stub-mode for tests: block until cancellation, no real pcap source.
		<-c.ctx.Done()
		return c.ctx.Err()
	}
	source := gopacket.NewPacketSource(c.handle, c.handle.LinkType())
	for {
		select {
		case <-c.ctx.Done():
			return c.ctx.Err()
		case pkt, ok := <-source.Packets():
			if !ok {
				return nil
			}
			c.processPacket(pkt)
		}
	}
}

// Close cancels the read loop and closes the handle. Caller must serialize
// against Start; Manager owns the locking.
func (c *Capturer) Close() {
	c.closeOnce.Do(func() {
		if c.cancel != nil {
			c.cancel()
		}
		c.StopRecording() //nolint:errcheck // file close error is non-actionable during shutdown
		if c.handle != nil {
			c.handle.Close()
		}
	})
}

func (c *Capturer) Iface() NetworkInterface { return c.iface }

func (c *Capturer) BytesReceived() uint64 { return atomic.LoadUint64(&c.bytesReceived) }

func (c *Capturer) Stats() (*pcap.Stats, error) {
	if c.handle == nil {
		return nil, nil
	}
	return c.handle.Stats()
}

// sanitizeIfaceName replaces characters not in [A-Za-z0-9_-] with underscores.
// Returns "unknown" if the result is empty.
func sanitizeIfaceName(name string) string {
	s := reUnsafeFilename.ReplaceAllString(name, "_")
	if s == "" {
		return "unknown"
	}
	return s
}

// StartRecording begins writing all packets to a new capture_<TS>_<iface>.pcap in dir.
// Returns an error if already recording or if the file cannot be created.
func (c *Capturer) StartRecording(dir string) error {
	c.recordMu.Lock()
	defer c.recordMu.Unlock()

	if c.recordWriter != nil {
		return errors.New("recording already in progress")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create recording dir: %w", err)
	}

	ts := time.Now().Format("2006-01-02T15-04-05")
	iface := sanitizeIfaceName(c.iface.Name)
	path := filepath.Join(dir, fmt.Sprintf("capture_%s_%s.pcap", ts, iface))

	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create recording file: %w", err)
	}

	w := pcapgo.NewWriter(f)
	var linkType layers.LinkType
	if c.handle != nil {
		linkType = c.handle.LinkType()
	} else {
		linkType = layers.LinkTypeEthernet
	}
	if err := w.WriteFileHeader(SnapLen, linkType); err != nil {
		f.Close()
		return fmt.Errorf("write pcap header: %w", err)
	}

	c.recordFile = f
	c.recordWriter = w
	return nil
}

// StopRecording flushes and closes the current recording. Returns nil if not recording.
func (c *Capturer) StopRecording() error {
	c.recordMu.Lock()
	defer c.recordMu.Unlock()

	if c.recordWriter == nil {
		return nil
	}
	err := c.recordFile.Close()
	c.recordFile = nil
	c.recordWriter = nil
	return err
}

// IsRecording reports whether a recording is currently active.
func (c *Capturer) IsRecording() bool {
	c.recordMu.Lock()
	defer c.recordMu.Unlock()
	return c.recordWriter != nil
}

func (c *Capturer) processPacket(p gopacket.Packet) {
	c.recordMu.Lock()
	if c.recordWriter != nil {
		if err := c.recordWriter.WritePacket(p.Metadata().CaptureInfo, p.Data()); err != nil {
			n := atomic.AddUint64(&c.recordWriteErrors, 1)
			if n%100 == 1 {
				logger.PrintWarn("PKT", "pcap recorder write error: %v", err)
			}
		}
	}
	c.recordMu.Unlock()

	udpLayer := p.Layer(layers.LayerTypeUDP)
	if udpLayer == nil {
		return
	}
	udp, ok := udpLayer.(*layers.UDP)
	if !ok || len(udp.Payload) == 0 || c.onPacket == nil {
		return
	}
	atomic.AddUint64(&c.bytesReceived, uint64(len(udp.Payload)))
	c.onPacket(udp.Payload)
}

func EnumerateInterfaces() ([]NetworkInterface, error) {
	devs, err := findAllDevs()
	if err != nil {
		return nil, fmt.Errorf("list devices: %w", err)
	}
	var out []NetworkInterface
	for _, d := range devs {
		for _, addr := range d.Addresses {
			ip4 := addr.IP.To4()
			if ip4 == nil {
				continue
			}
			out = append(out, NetworkInterface{
				Name:        d.Name,
				Description: d.Description,
				Address:     ip4.String(),
				Device:      d.Name,
			})
			break
		}
	}
	return out, nil
}

func ResolveByIP(ip string) (PersistedInterface, error) {
	ifaces, err := EnumerateInterfaces()
	if err != nil {
		return PersistedInterface{}, err
	}
	for _, i := range ifaces {
		if i.Address == ip {
			return PersistedInterface{Name: i.Name, Description: i.Description}, nil
		}
	}
	return PersistedInterface{}, fmt.Errorf("no interface with IP %s", ip)
}
