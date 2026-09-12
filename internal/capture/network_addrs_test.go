package capture

import (
	"slices"
	"testing"
)

func TestIsRFC1918(t *testing.T) {
	cases := []struct {
		addr string
		want bool
	}{
		{"192.168.1.1", true},
		{"192.168.0.0", true},
		{"10.0.0.1", true},
		{"172.16.0.1", true},
		{"172.31.255.255", true},
		{"::ffff:10.1.2.3", true},
		{"172.32.0.1", false},
		{"8.8.8.8", false},
		{"fd00::1", false},
		{"fe80::1", false},
		{"1.2.3", false},
		{"", false},
	}
	for _, tc := range cases {
		if got := IsRFC1918(tc.addr); got != tc.want {
			t.Errorf("IsRFC1918(%q) = %v, want %v", tc.addr, got, tc.want)
		}
	}
}

func TestLANAddressesReturnsRFC1918OnlyOrEmpty(t *testing.T) {
	got := LANAddresses()
	for _, a := range got {
		if !IsRFC1918(a) {
			t.Errorf("LAN addr %q is not RFC1918", a)
		}
	}
}

func TestRankLANCandidates_PreferEthernetOverVirtual(t *testing.T) {
	in := []lanCandidate{
		{name: "vEthernet (Default Switch)", ip: "172.27.32.1"},
		{name: "Ethernet", ip: "192.168.1.37"},
		{name: "vEthernet (WSL)", ip: "172.30.208.1"},
		{name: "Wi-Fi", ip: "192.168.2.50"},
	}
	got := rankLANCandidates(in)
	want := []string{"192.168.1.37", "192.168.2.50", "172.27.32.1", "172.30.208.1"}
	if !slices.Equal(got, want) {
		t.Errorf("rankLANCandidates: got %v want %v", got, want)
	}
}

func TestRankLANCandidates_StableWithinCategory(t *testing.T) {
	in := []lanCandidate{
		{name: "vEthernet (Default Switch)", ip: "172.27.32.1"},
		{name: "vEthernet (WSL)", ip: "172.30.208.1"},
	}
	got := rankLANCandidates(in)
	want := []string{"172.27.32.1", "172.30.208.1"}
	if !slices.Equal(got, want) {
		t.Errorf("stable order: got %v want %v", got, want)
	}
}

func TestRankLANCandidates_UnknownNameFallsToOther(t *testing.T) {
	in := []lanCandidate{
		{name: "WeirdAdapterName", ip: "10.0.0.5"},
		{name: "Ethernet", ip: "192.168.1.37"},
	}
	got := rankLANCandidates(in)
	want := []string{"192.168.1.37", "10.0.0.5"}
	if !slices.Equal(got, want) {
		t.Errorf("unknown to Other: got %v want %v", got, want)
	}
}
