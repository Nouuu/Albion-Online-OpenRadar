package main

import (
	"testing"

	"github.com/nospy/albion-openradar/internal/capture"
)

func TestResolvePersistedWithIPOverride(t *testing.T) {
	all := []capture.NetworkInterface{
		{Name: "n1", Description: "Wi-Fi", Address: "192.168.1.1"},
		{Name: "n2", Description: "Eth", Address: "192.168.1.2"},
	}
	got := resolvePersisted(capture.Config{}, all, "192.168.1.2")
	if len(got) != 1 || got[0].Name != "n2" {
		t.Errorf("override match: got %+v", got)
	}
	got = resolvePersisted(capture.Config{}, all, "10.0.0.99")
	if got != nil {
		t.Errorf("override miss should return nil, got %+v", got)
	}
}

func TestResolvePersistedFromConfig(t *testing.T) {
	all := []capture.NetworkInterface{
		{Name: "n1", Description: "Wi-Fi", Address: "192.168.1.1"},
		{Name: "n2", Description: "Eth", Address: "192.168.1.2"},
	}
	cfg := capture.Config{CaptureInterfaces: []capture.PersistedInterface{
		{Name: "n2"},
		{Name: "missing"},
	}}
	got := resolvePersisted(cfg, all, "")
	if len(got) != 1 || got[0].Name != "n2" {
		t.Errorf("got %+v, want one entry n2", got)
	}
}

func TestAutoPickDefaults(t *testing.T) {
	all := []capture.NetworkInterface{
		{Name: "lo", Description: "Software Loopback", Address: "127.0.0.1"},
		{Name: "vbox", Description: "VirtualBox Host-Only", Address: "192.168.56.1"},
		{Name: "wifi", Description: "Wi-Fi", Address: "192.168.1.42"},
		{Name: "eth", Description: "Realtek PCIe GbE Family Controller", Address: "10.0.0.10"},
		{Name: "publicEth", Description: "Some Ethernet", Address: "8.8.8.8"},
		{Name: "exitlag", Description: "ExitLag LightWeight Filter", Address: "192.168.99.1"},
	}
	got := autoPickDefaults(all)
	if len(got) != 3 {
		t.Fatalf("len=%d, want 3 (eth, wifi, exitlag)", len(got))
	}
	names := []string{got[0].Name, got[1].Name, got[2].Name}
	want := []string{"eth", "wifi", "exitlag"}
	for i, w := range want {
		if names[i] != w {
			t.Errorf("position %d: got %q, want %q (full: %v)", i, names[i], w, names)
		}
	}
}

func TestAutoPickDefaultsExcludesNonRFC1918(t *testing.T) {
	all := []capture.NetworkInterface{
		{Name: "publicEth", Description: "Some Ethernet", Address: "8.8.8.8"},
		{Name: "publicWifi", Description: "Wi-Fi", Address: "1.2.3.4"},
	}
	got := autoPickDefaults(all)
	if len(got) != 0 {
		t.Errorf("got %d, want 0 (no RFC1918)", len(got))
	}
}

func TestAutoPickDefaultsExcludesVirtualAndVPN(t *testing.T) {
	all := []capture.NetworkInterface{
		{Name: "tun0", Description: "WireGuard", Address: "10.8.0.5"},
		{Name: "vbox", Description: "VirtualBox Host-Only", Address: "192.168.56.1"},
	}
	got := autoPickDefaults(all)
	if len(got) != 0 {
		t.Errorf("got %d, want 0 (vpn+virtual excluded)", len(got))
	}
}
