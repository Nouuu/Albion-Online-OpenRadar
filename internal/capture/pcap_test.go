package capture

import (
	"errors"
	"net"
	"testing"

	"github.com/google/gopacket/pcap"
)

func withStubFindAllDevs(t *testing.T, devs []pcap.Interface, err error) {
	t.Helper()
	prev := findAllDevs
	findAllDevs = func() ([]pcap.Interface, error) { return devs, err }
	t.Cleanup(func() { findAllDevs = prev })
}

func TestEnumerateInterfacesPicksFirstIPv4(t *testing.T) {
	withStubFindAllDevs(t, []pcap.Interface{
		{
			Name:        `\Device\NPF_{1}`,
			Description: "Intel Wi-Fi",
			Addresses: []pcap.InterfaceAddress{
				{IP: net.ParseIP("fe80::1")},
				{IP: net.ParseIP("192.168.1.10")},
				{IP: net.ParseIP("192.168.1.99")},
			},
		},
		{
			Name:        `\Device\NPF_{2}`,
			Description: "Loopback",
			Addresses:   []pcap.InterfaceAddress{{IP: net.ParseIP("::1")}},
		},
		{
			Name:        `\Device\NPF_{3}`,
			Description: "Ethernet",
			Addresses:   []pcap.InterfaceAddress{{IP: net.ParseIP("10.0.0.5")}},
		},
	}, nil)

	out, err := EnumerateInterfaces()
	if err != nil {
		t.Fatalf("EnumerateInterfaces: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("got %d interfaces, want 2 (IPv6-only skipped)", len(out))
	}
	if out[0].Address != "192.168.1.10" {
		t.Errorf("first iface addr = %q, want %q (first IPv4 wins)", out[0].Address, "192.168.1.10")
	}
	if out[0].Device != out[0].Name {
		t.Errorf("Device=%q Name=%q, want equal", out[0].Device, out[0].Name)
	}
	if out[1].Address != "10.0.0.5" {
		t.Errorf("second iface addr = %q, want %q", out[1].Address, "10.0.0.5")
	}
}

func TestEnumerateInterfacesError(t *testing.T) {
	withStubFindAllDevs(t, nil, errors.New("permission denied"))
	if _, err := EnumerateInterfaces(); err == nil {
		t.Fatal("expected error from EnumerateInterfaces")
	}
}

func TestResolveByIPMatch(t *testing.T) {
	withStubFindAllDevs(t, []pcap.Interface{
		{
			Name:        `\Device\NPF_{1}`,
			Description: "Wi-Fi",
			Addresses:   []pcap.InterfaceAddress{{IP: net.ParseIP("192.168.1.10")}},
		},
		{
			Name:        `\Device\NPF_{2}`,
			Description: "Ethernet",
			Addresses:   []pcap.InterfaceAddress{{IP: net.ParseIP("10.0.0.5")}},
		},
	}, nil)

	got, err := ResolveByIP("10.0.0.5")
	if err != nil {
		t.Fatalf("ResolveByIP: %v", err)
	}
	if got.Name != `\Device\NPF_{2}` || got.Description != "Ethernet" {
		t.Errorf("ResolveByIP = %+v, want Name=NPF_{2} Description=Ethernet", got)
	}
}

func TestResolveByIPNotFound(t *testing.T) {
	withStubFindAllDevs(t, []pcap.Interface{
		{
			Name:        `\Device\NPF_{1}`,
			Description: "Wi-Fi",
			Addresses:   []pcap.InterfaceAddress{{IP: net.ParseIP("192.168.1.10")}},
		},
	}, nil)

	if _, err := ResolveByIP("172.16.0.1"); err == nil {
		t.Fatal("expected not-found error")
	}
}
