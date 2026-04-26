package capture

import (
	"testing"
)

func TestCategorize(t *testing.T) {
	cases := []struct {
		name        string
		ifaceName   string
		description string
		want        Category
	}{
		// Windows descriptions
		{"win wifi intel", `\Device\NPF_{1}`, "Intel(R) Wi-Fi 6 AX201", CategoryWiFi},
		{"win wifi realtek wireless", `\Device\NPF_{2}`, "Realtek 8821CE Wireless LAN 802.11ac PCI-E NIC", CategoryWiFi},
		{"win ethernet realtek family", `\Device\NPF_{3}`, "Realtek PCIe GbE Family Controller", CategoryEthernet},
		{"win ethernet intel connection", `\Device\NPF_{4}`, "Intel(R) Ethernet Connection (7) I219-V", CategoryEthernet},
		{"win ethernet killer gigabit", `\Device\NPF_{5}`, "Killer E2600 Gigabit Ethernet Controller", CategoryEthernet},
		{"win exitlag", `\Device\NPF_{6}`, "ExitLag LightWeight Filter", CategoryExitLag},
		{"win exit lag spaced", `\Device\NPF_{7}`, "Exit Lag Adapter", CategoryExitLag},
		{"win vpn tap", `\Device\NPF_{8}`, "TAP-Windows Adapter V9", CategoryVPN},
		{"win vpn wintun", `\Device\NPF_{9}`, "WireGuard Tunnel", CategoryVPN},
		{"win vpn openvpn", `\Device\NPF_{10}`, "OpenVPN Wintun", CategoryVPN},
		{"win virtual hyper-v", `\Device\NPF_{11}`, "Hyper-V Virtual Ethernet Adapter", CategoryVirtual},
		{"win virtual vethernet", `\Device\NPF_{12}`, "vEthernet (Default Switch)", CategoryVirtual},
		{"win virtual virtualbox", `\Device\NPF_{13}`, "VirtualBox Host-Only Ethernet Adapter", CategoryVirtual},
		{"win virtual vmware", `\Device\NPF_{14}`, "VMware Virtual Ethernet Adapter for VMnet8", CategoryVirtual},
		{"win virtual teredo", `\Device\NPF_{15}`, "Teredo Tunneling Pseudo-Interface", CategoryVirtual},
		{"win virtual loopback pseudo", `\Device\NPF_{16}`, "Software Loopback Interface 1", CategoryVirtual},
		{"win virtual wifi direct", `\Device\NPF_{17}`, "Microsoft Wi-Fi Direct Virtual Adapter", CategoryVirtual},
		{"win virtual mobile hotspot", `\Device\NPF_{18}`, "Microsoft Wi-Fi Direct Virtual Adapter #2 Mobile Hotspot", CategoryVirtual},
		{"win other bluetooth", `\Device\NPF_{19}`, "Bluetooth Network Connection", CategoryOther},

		// Linux interface names (description often empty)
		{"linux wifi wlan0", "wlan0", "", CategoryWiFi},
		{"linux wifi wlp3s0", "wlp3s0", "", CategoryWiFi},
		{"linux ethernet eth0", "eth0", "", CategoryEthernet},
		{"linux ethernet enp0s3", "enp0s3", "", CategoryEthernet},
		{"linux ethernet eno1", "eno1", "", CategoryEthernet},
		{"linux vpn tun0", "tun0", "", CategoryVPN},
		{"linux vpn tap0", "tap0", "", CategoryVPN},
		{"linux vpn wg0", "wg0", "", CategoryVPN},
		{"linux vpn ppp0", "ppp0", "", CategoryVPN},
		{"linux virtual docker0", "docker0", "", CategoryVirtual},
		{"linux virtual virbr0", "virbr0", "", CategoryVirtual},
		{"linux virtual vmnet1", "vmnet1", "", CategoryVirtual},
		{"linux virtual veth", "veth0a1b2c3", "", CategoryVirtual},
		{"linux virtual lo", "lo", "", CategoryVirtual},
		{"linux virtual br-docker", "br-1234abcd", "", CategoryVirtual},

		// Edge cases
		{"empty", "", "", CategoryOther},
		{"unknown adapter", "Some Random Adapter", "", CategoryOther},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Categorize(tc.ifaceName, tc.description)
			if got != tc.want {
				t.Errorf("Categorize(%q, %q) = %q, want %q", tc.ifaceName, tc.description, got, tc.want)
			}
		})
	}
}

func TestRankCandidates(t *testing.T) {
	in := []NetworkInterface{
		{Name: "lo", Description: ""},
		{Name: `\Device\NPF_{V}`, Description: "VirtualBox Host-Only"},
		{Name: `\Device\NPF_{W}`, Description: "Wi-Fi"},
		{Name: `\Device\NPF_{E}`, Description: "Realtek PCIe GbE Family Controller"},
		{Name: `\Device\NPF_{X}`, Description: "ExitLag LightWeight Filter"},
		{Name: "tun0", Description: ""},
	}
	got := RankCandidates(in)
	wantOrder := []string{
		"Realtek PCIe GbE Family Controller", // ethernet
		"Wi-Fi",                              // wifi
		"ExitLag LightWeight Filter",         // exitlag
		"",                                   // vpn (tun0 has empty description)
		"VirtualBox Host-Only",               // virtual
		"",                                   // virtual (lo has empty description)
	}
	if len(got) != len(wantOrder) {
		t.Fatalf("got %d entries, want %d", len(got), len(wantOrder))
	}
	for i, want := range wantOrder {
		if got[i].Description != want {
			t.Errorf("position %d: description %q, want %q", i, got[i].Description, want)
		}
	}
}
