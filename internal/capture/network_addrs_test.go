package capture

import "testing"

func TestIsRFC1918(t *testing.T) {
	if !IsRFC1918("192.168.1.1") {
		t.Error("192.168.1.1 should be RFC1918")
	}
	if IsRFC1918("8.8.8.8") {
		t.Error("8.8.8.8 should not be RFC1918")
	}
	if IsRFC1918("") {
		t.Error("empty should not be RFC1918")
	}
}

func TestLANAddressesReturnsRFC1918OnlyOrEmpty(t *testing.T) {
	got := LANAddresses()
	for _, a := range got {
		if !IsRFC1918(a) {
			t.Errorf("LAN addr %q is not RFC1918", a)
		}
	}
	// Empty slice is allowed (CI runners often have no RFC1918 IP).
}
