package capture

import (
	"cmp"
	"net"
	"net/netip"
	"slices"
)

func IsRFC1918(addr string) bool {
	ip, err := netip.ParseAddr(addr)
	if err != nil {
		return false
	}
	ip = ip.Unmap()
	return ip.Is4() && ip.IsPrivate()
}

type lanCandidate struct {
	name string
	ip   string
}

func rankLANCandidates(in []lanCandidate) []string {
	cp := slices.Clone(in)
	slices.SortStableFunc(cp, func(a, b lanCandidate) int {
		return cmp.Compare(categoryRank[Categorize(a.name, "")], categoryRank[Categorize(b.name, "")])
	})
	out := make([]string, len(cp))
	for i, c := range cp {
		out[i] = c.ip
	}
	return out
}

func LANAddresses() []string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	cands := make([]lanCandidate, 0)
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
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
				cands = append(cands, lanCandidate{name: iface.Name, ip: s})
			}
		}
	}
	return rankLANCandidates(cands)
}
