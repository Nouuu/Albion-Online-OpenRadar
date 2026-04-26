package capture

import "net"

// rfc1918Nets is the parsed set of private IPv4 ranges defined in RFC 1918.
// Parsed once at init to avoid re-parsing per call.
var rfc1918Nets = func() []*net.IPNet {
	cidrs := []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}
	out := make([]*net.IPNet, 0, len(cidrs))
	for _, c := range cidrs {
		_, n, err := net.ParseCIDR(c)
		if err == nil {
			out = append(out, n)
		}
	}
	return out
}()

// IsRFC1918 reports whether addr is a non-empty IPv4 string inside one of the
// RFC 1918 private ranges (10/8, 172.16/12, 192.168/16). Loopback and link-local
// addresses are excluded.
func IsRFC1918(addr string) bool {
	ip := net.ParseIP(addr)
	if ip == nil {
		return false
	}
	ip4 := ip.To4()
	if ip4 == nil {
		return false
	}
	for _, n := range rfc1918Nets {
		if n.Contains(ip4) {
			return true
		}
	}
	return false
}

// LANAddresses returns IPv4 RFC 1918 host addresses bound to local interfaces.
// Used to print LAN URLs at startup and to populate /api/network/state.
func LANAddresses() []string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return nil
	}
	out := make([]string, 0)
	for _, a := range addrs {
		ipnet, ok := a.(*net.IPNet)
		if !ok {
			continue
		}
		ip4 := ipnet.IP.To4()
		if ip4 == nil {
			continue
		}
		s := ip4.String()
		if IsRFC1918(s) {
			out = append(out, s)
		}
	}
	return out
}
