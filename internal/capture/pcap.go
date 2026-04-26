package capture

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
)

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
}

// captureFactory is overridable in tests; restore via t.Cleanup.
var captureFactory = openLiveCapture

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

func (c *Capturer) processPacket(p gopacket.Packet) {
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
	devs, err := pcap.FindAllDevs()
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
