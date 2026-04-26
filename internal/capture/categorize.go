package capture

import (
	"regexp"
	"sort"
	"strings"
)

type Category string

const (
	CategoryWiFi     Category = "wifi"
	CategoryEthernet Category = "ethernet"
	CategoryExitLag  Category = "exitlag"
	CategoryVPN      Category = "vpn"
	CategoryVirtual  Category = "virtual"
	CategoryOther    Category = "other"
)

// Order matters: Virtual first overrides Wi-Fi/Ethernet substrings; ExitLag before VPN.
var categoryRules = []struct {
	cat Category
	re  *regexp.Regexp
}{
	{CategoryVirtual, regexp.MustCompile(`virtualbox|vmware|hyper-v|virtual switch|vethernet|teredo|loopback pseudo|software loopback|wi-fi direct|mobile hotspot|\bdocker\d|\bbr-|\bvirbr\d|\bvmnet\d|\bveth|\blo\b`)},
	{CategoryExitLag, regexp.MustCompile(`exit\s*lag`)},
	{CategoryVPN, regexp.MustCompile(`vpn|wireguard|wintun|tap-windows|openvpn|\btun\d|\btap\d|\bwg\d|\bppp\d`)},
	{CategoryWiFi, regexp.MustCompile(`wi-?fi|wireless|802\.11|\bwlan\d|\bwlp\d|\bwifi\d`)},
	{CategoryEthernet, regexp.MustCompile(`ethernet|gigabit|family controller|\beth\d|\benp\d|\beno\d|\bens\d`)},
}

func Categorize(name, description string) Category {
	if name == "" && description == "" {
		return CategoryOther
	}
	hay := strings.ToLower(name + " " + description)
	for _, r := range categoryRules {
		if r.re.MatchString(hay) {
			return r.cat
		}
	}
	return CategoryOther
}

var categoryRank = map[Category]int{
	CategoryEthernet: 0,
	CategoryWiFi:     1,
	CategoryExitLag:  2,
	CategoryVPN:      3,
	CategoryVirtual:  4,
	CategoryOther:    5,
}

func RankCandidates(in []NetworkInterface) []NetworkInterface {
	out := make([]NetworkInterface, len(in))
	copy(out, in)
	sort.SliceStable(out, func(i, j int) bool {
		ci := Categorize(out[i].Name, out[i].Description)
		cj := Categorize(out[j].Name, out[j].Description)
		if ci != cj {
			return categoryRank[ci] < categoryRank[cj]
		}
		return out[i].Description != "" && out[j].Description == ""
	})
	return out
}
