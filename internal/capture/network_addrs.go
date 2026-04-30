package capture

import (
	"net"
	"sort"
)

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

type lanCandidate struct {
	name string
	ip   string
}

func rankLANCandidates(in []lanCandidate) []string {
	cp := make([]lanCandidate, len(in))
	copy(cp, in)
	sort.SliceStable(cp, func(i, j int) bool {
		ci := Categorize(cp[i].name, "")
		cj := Categorize(cp[j].name, "")
		return categoryRank[ci] < categoryRank[cj]
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
