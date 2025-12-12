package capture

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"

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
	Device  string // pcap device name
}

// PacketHandler is called for each captured UDP payload
type PacketHandler func(payload []byte)

// Capturer handles packet capture from network interface
type Capturer struct {
	handle   *pcap.Handle
	iface    NetworkInterface
	onPacket PacketHandler
	appDir   string
}

// ListInterfaces returns all available network interfaces with IPv4 addresses
func ListInterfaces() ([]NetworkInterface, error) {
	devices, err := pcap.FindAllDevs()
	if err != nil {
		return nil, fmt.Errorf("failed to list devices: %w", err)
	}

	var interfaces []NetworkInterface
	for _, device := range devices {
		for _, addr := range device.Addresses {
			// Only IPv4
			if ip4 := addr.IP.To4(); ip4 != nil {
				interfaces = append(interfaces, NetworkInterface{
					Name:    device.Description,
					Address: ip4.String(),
					Device:  device.Name,
				})
				break // Only first IPv4 per device
			}
		}
	}

	return interfaces, nil
}

// FindDeviceByIP finds the pcap device name for a given IP address
func FindDeviceByIP(ip string) (string, error) {
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

// GetAdapterIP reads IP from: 1) ipOverride param, 2) ip.txt file, 3) prompts user
func GetAdapterIP(appDir string, ipOverride string) (string, error) {
	ipFilePath := filepath.Join(appDir, "ip.txt")

	// 1. Use override if provided (e.g., from -ip flag)
	if ipOverride != "" {
		if net.ParseIP(ipOverride) != nil {
			fmt.Printf("⚡ Using IP from command line: %s\n", ipOverride)
			return ipOverride, nil
		}
		return "", fmt.Errorf("invalid IP address provided: %s", ipOverride)
	}

	// 2. Try to read from ip.txt
	if data, err := os.ReadFile(ipFilePath); err == nil {
		ip := strings.TrimSpace(string(data))
		if net.ParseIP(ip) != nil {
			return ip, nil
		}
	}

	// 3. List interfaces and prompt user
	interfaces, err := ListInterfaces()
	if err != nil {
		return "", err
	}

	if len(interfaces) == 0 {
		return "", fmt.Errorf("no network interfaces found")
	}

	fmt.Println("\nPlease select the adapter used to connect to the Internet:")
	for i, iface := range interfaces {
		fmt.Printf("  %d. %s\t ip address: %s\n", i+1, iface.Name, iface.Address)
	}
	fmt.Println()

	reader := bufio.NewReader(os.Stdin)
	for {
		fmt.Print("Enter the adapter number: ")
		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		idx, err := strconv.Atoi(input)
		if err != nil || idx < 1 || idx > len(interfaces) {
			fmt.Println("Invalid input, please try again.\n")
			continue
		}

		selected := interfaces[idx-1]
		fmt.Printf("\nYou have selected \"%s - %s\"\n\n", selected.Name, selected.Address)

		// Save to ip.txt
		if err := os.WriteFile(ipFilePath, []byte(selected.Address), 0644); err != nil {
			fmt.Println("Warning: Error while saving the IP address.")
		}

		return selected.Address, nil
	}
}

// New creates a new Capturer for the given IP address
// ipOverride can be empty to use ip.txt or interactive prompt
func New(appDir string, ipOverride string) (*Capturer, error) {
	ip, err := GetAdapterIP(appDir, ipOverride)
	if err != nil {
		return nil, err
	}

	device, err := FindDeviceByIP(ip)
	if err != nil {
		// IP not found, prompt again (only if no override was provided)
		if ipOverride != "" {
			return nil, fmt.Errorf("adapter with IP %s not found", ip)
		}
		fmt.Printf("Adapter with IP %s not found. Please select a new adapter.\n", ip)
		ip, err = GetAdapterIP(appDir, "")
		if err != nil {
			return nil, err
		}
		device, err = FindDeviceByIP(ip)
		if err != nil {
			return nil, err
		}
	}

	fmt.Printf("Using adapter IP: %s\n", ip)

	// Open the device
	handle, err := pcap.OpenLive(device, SnapLen, Promiscuous, pcap.BlockForever)
	if err != nil {
		return nil, fmt.Errorf("failed to open device: %w", err)
	}

	// Set BPF filter for Albion port
	filter := fmt.Sprintf("udp and (dst port %d or src port %d)", AlbionPort, AlbionPort)
	if err := handle.SetBPFFilter(filter); err != nil {
		handle.Close()
		return nil, fmt.Errorf("failed to set BPF filter: %w", err)
	}

	return &Capturer{
		handle: handle,
		iface: NetworkInterface{
			Address: ip,
			Device:  device,
		},
		appDir: appDir,
	}, nil
}

// OnPacket sets the handler for captured packets
func (c *Capturer) OnPacket(handler PacketHandler) {
	c.onPacket = handler
}

// Start begins capturing packets (blocking)
func (c *Capturer) Start() error {
	packetSource := gopacket.NewPacketSource(c.handle, c.handle.LinkType())

	for packet := range packetSource.Packets() {
		// Extract UDP layer
		udpLayer := packet.Layer(layers.LayerTypeUDP)
		if udpLayer == nil {
			continue
		}

		udp, _ := udpLayer.(*layers.UDP)
		payload := udp.Payload

		if len(payload) > 0 && c.onPacket != nil {
			c.onPacket(payload)
		}
	}

	return nil
}

// Close stops the capture
func (c *Capturer) Close() {
	if c.handle != nil {
		c.handle.Close()
	}
}
