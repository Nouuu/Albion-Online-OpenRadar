package capture

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
)

const (
	AlbionPort  = 5056
	SnapLen     = 65536
	Promiscuous = false
)

// NetworkInterface represents a network interface with its details
type NetworkInterface struct {
	Name    string
	Address string
	Device  string
}

// PacketHandler is called for each captured UDP payload
type PacketHandler func(payload []byte)

// Capturer handles packet capture from network interface
type Capturer struct {
	handle   *pcap.Handle
	iface    NetworkInterface
	onPacket PacketHandler
	ctx      context.Context
	cancel   context.CancelFunc

	// Traffic stats
	bytesReceived uint64
}

// New creates a new Capturer for the given IP address
func New(ctx context.Context, appDir string, ipOverride string) (*Capturer, error) {
	ip, device, err := resolveAdapter(appDir, ipOverride)
	if err != nil {
		return nil, err
	}

	handle, err := openDevice(device)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithCancel(ctx)
	return &Capturer{
		handle: handle,
		iface:  NetworkInterface{Address: ip, Device: device},
		ctx:    ctx,
		cancel: cancel,
	}, nil
}

// OnPacket sets the handler for captured packets
func (c *Capturer) OnPacket(handler PacketHandler) {
	c.onPacket = handler
}

// Start begins capturing packets (blocking)
func (c *Capturer) Start() error {
	packetSource := gopacket.NewPacketSource(c.handle, c.handle.LinkType())

	for {
		select {
		case <-c.ctx.Done():
			return c.ctx.Err()
		case packet, ok := <-packetSource.Packets():
			if !ok {
				return nil
			}
			c.processPacket(packet)
		}
	}
}

// Close stops the capture
func (c *Capturer) Close() {
	if c.cancel != nil {
		c.cancel()
	}
	if c.handle != nil {
		c.handle.Close()
	}
}

// AdapterIP returns the IP address of the network adapter being used
func (c *Capturer) AdapterIP() string {
	return c.iface.Address
}

func (c *Capturer) processPacket(packet gopacket.Packet) {
	udpLayer := packet.Layer(layers.LayerTypeUDP)
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

func (c *Capturer) BytesReceived() uint64 {
	return atomic.LoadUint64(&c.bytesReceived)
}

// resolveAdapter gets the IP and device name, with retry logic
func resolveAdapter(appDir, ipOverride string) (ip, device string, err error) {
	ip, err = getAdapterIP(appDir, ipOverride)
	if err != nil {
		return "", "", err
	}

	device, err = findDeviceByIP(ip)
	if err == nil {
		fmt.Printf("Using adapter IP: %s\n", ip)
		return ip, device, nil
	}

	// Retry only if no override was provided
	if ipOverride != "" {
		return "", "", fmt.Errorf("adapter with IP %s not found", ip)
	}

	fmt.Printf("Adapter with IP %s not found. Please select a new adapter.\n", ip)
	ip, err = getAdapterIP(appDir, "")
	if err != nil {
		return "", "", err
	}

	device, err = findDeviceByIP(ip)
	if err != nil {
		return "", "", err
	}

	fmt.Printf("Using adapter IP: %s\n", ip)
	return ip, device, nil
}

func openDevice(device string) (*pcap.Handle, error) {
	handle, err := pcap.OpenLive(device, SnapLen, Promiscuous, pcap.BlockForever)
	if err != nil {
		return nil, fmt.Errorf("failed to open device: %w", err)
	}

	filter := fmt.Sprintf("udp and (dst port %d or src port %d)", AlbionPort, AlbionPort)
	if err := handle.SetBPFFilter(filter); err != nil {
		handle.Close()
		return nil, fmt.Errorf("failed to set BPF filter: %w", err)
	}

	return handle, nil
}

// getAdapterIP reads IP from: 1) override, 2) ip.txt, 3) prompt
func getAdapterIP(appDir, ipOverride string) (string, error) {
	if ip := tryIPOverride(ipOverride); ip != "" {
		return ip, nil
	}

	if ip := tryIPFile(appDir); ip != "" {
		return ip, nil
	}

	return promptForInterface(appDir)
}

func tryIPOverride(ipOverride string) string {
	if ipOverride == "" {
		return ""
	}
	if net.ParseIP(ipOverride) == nil {
		return ""
	}
	fmt.Printf("Using IP from command line: %s\n", ipOverride)
	return ipOverride
}

func tryIPFile(appDir string) string {
	data, err := os.ReadFile(filepath.Join(appDir, "ip.txt"))
	if err != nil {
		return ""
	}
	ip := strings.TrimSpace(string(data))
	if net.ParseIP(ip) == nil {
		return ""
	}
	return ip
}

func promptForInterface(appDir string) (string, error) {
	interfaces, err := listInterfaces()
	if err != nil {
		return "", err
	}
	if len(interfaces) == 0 {
		return "", fmt.Errorf("no network interfaces found")
	}

	printInterfaces(interfaces)
	return selectInterface(interfaces, appDir)
}

func listInterfaces() ([]NetworkInterface, error) {
	devices, err := pcap.FindAllDevs()
	if err != nil {
		return nil, fmt.Errorf("failed to list devices: %w", err)
	}

	var interfaces []NetworkInterface
	for _, device := range devices {
		if iface := firstIPv4Interface(device); iface != nil {
			interfaces = append(interfaces, *iface)
		}
	}
	return interfaces, nil
}

func firstIPv4Interface(device pcap.Interface) *NetworkInterface {
	for _, addr := range device.Addresses {
		if ip4 := addr.IP.To4(); ip4 != nil {
			return &NetworkInterface{
				Name:    device.Description,
				Address: ip4.String(),
				Device:  device.Name,
			}
		}
	}
	return nil
}

func findDeviceByIP(ip string) (string, error) {
	devices, err := pcap.FindAllDevs()
	if err != nil {
		return "", fmt.Errorf("failed to list devices: %w", err)
	}

	for _, device := range devices {
		for _, addr := range device.Addresses {
			if addr.IP.String() == ip {
				return device.Name, nil
			}
		}
	}
	return "", fmt.Errorf("no device found with IP: %s", ip)
}

func printInterfaces(interfaces []NetworkInterface) {
	fmt.Println("\nPlease select the adapter used to connect to the Internet:")
	for i, iface := range interfaces {
		fmt.Printf("  %d. %s\t ip address: %s\n", i+1, iface.Name, iface.Address)
	}
	fmt.Println()
}

func selectInterface(interfaces []NetworkInterface, appDir string) (string, error) {
	reader := bufio.NewReader(os.Stdin)

	for {
		fmt.Print("Enter the adapter number: ")
		input, err := reader.ReadString('\n')
		if err != nil {
			return "", fmt.Errorf("failed to read input: %w", err)
		}

		idx, err := strconv.Atoi(strings.TrimSpace(input))
		if err != nil || idx < 1 || idx > len(interfaces) {
			fmt.Println("Invalid input, please try again.")
			continue
		}

		selected := interfaces[idx-1]
		fmt.Printf("\nYou have selected \"%s - %s\"\n\n", selected.Name, selected.Address)
		saveIPToFile(appDir, selected.Address)
		return selected.Address, nil
	}
}

func saveIPToFile(appDir, ip string) {
	path := filepath.Join(appDir, "ip.txt")
	if err := os.WriteFile(path, []byte(ip), 0o644); err != nil {
		fmt.Println("Warning: Error while saving the IP address.")
	}
}
