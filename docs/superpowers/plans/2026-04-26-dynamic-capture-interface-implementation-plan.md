# Dynamic Capture Interface Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace IP-keyed `ip.txt` persistence + single-handle pcap with a multi-interface `Manager` keyed by stable `{name, description}`. Expose runtime add/remove via a new HTTP API and a new "Network" section on the Settings page. Decouple capture interfaces from LAN serving addresses in TUI/UI. Closes #91.

**Architecture:** New `Manager` owns a set of single-handle `Capturer` workers, one per active interface. Open/close ordering is strict (BPF before goroutine, cancellation before close, additions before removals during reconfigure). HTTP POST is restricted to loopback. Frontend uses fetch + 5s polling. Memory `feedback_no_worktrees` applies — work in main repo on `feat/91-dynamic-capture-interface`, no worktree.

**Tech Stack:** Go 1.26, gopacket/pcap, vanilla JavaScript ES modules, Vitest 4.x, happy-dom, DaisyUI 5.

**Spec:** `docs/superpowers/specs/2026-04-26-dynamic-capture-interface-design.md`

---

## File structure

### Create

- `internal/capture/categorize.go` — `Category` enum, regex constants, `Categorize`, `RankCandidates`.
- `internal/capture/categorize_test.go` — table-driven tests on real-world adapter names.
- `internal/capture/network_config.go` — `Config` struct, read/write `network.json`, migrate `ip.txt`.
- `internal/capture/network_config_test.go`.
- `internal/capture/manager.go` — `Manager` struct with `Reconfigure`, `Close`, `State`.
- `internal/capture/manager_test.go` — lifecycle, diff, failure isolation, no goroutine leaks.
- `internal/server/network_api.go` — 4 HTTP handlers + loopback helper.
- `internal/server/network_api_test.go`.
- `web/scripts/handlers/NetworkSettingsHandler.js` — fetch + render + apply.
- `web/scripts/handlers/_NetworkSettingsHandler.test.js`.

### Modify

- `internal/capture/pcap.go` — keep `Capturer` (single-handle), drop `New`, `getAdapterIP`, `tryIPFile`, `tryIPOverride`, `promptForInterface`, `printInterfaces`, `selectInterface`, `saveIPToFile`. Add `OpenCapture(name)` package-level injectable factory.
- `internal/server/http.go` — register `/api/network/*` routes.
- `internal/ui/dashboard.go` — replace `adapterIP` with `captureInterfaces []CaptureSummary` + `lanAddresses []string`, update display.
- `internal/templates/pages/settings.gohtml` — new "Network" section + `<script>` block instantiating `NetworkSettingsHandler`.
- `cmd/radar/main.go` — instantiate `Manager` instead of `Capturer`, remove `--ip` interactive flow (keep flag for legacy override → resolves to interface name once).

### No changes

- `internal/photon/*` — packet handling unchanged.
- `internal/server/websocket.go` — unchanged.
- `web/scripts/core/*`, `web/scripts/utils/*`, `web/scripts/drawings/*`, `web/scripts/handlers/*Handler.js` (other than the new one) — unchanged.

---

## Task 1: Categorize and rank interfaces

**Files:**
- Create: `internal/capture/categorize.go`, `internal/capture/categorize_test.go`.

- [ ] **Step 1: Write the failing test**

Create `internal/capture/categorize_test.go`:

```go
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
		"Wi-Fi",                                // wifi
		"ExitLag LightWeight Filter",           // exitlag
		"",                                     // vpn (tun0 has empty description)
		"VirtualBox Host-Only",                 // virtual
		"",                                     // virtual (lo has empty description)
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
go test ./internal/capture/ -run 'TestCategorize|TestRankCandidates' -v
```

Expected: FAIL with `undefined: Category`, `undefined: Categorize`, `undefined: RankCandidates`.

- [ ] **Step 3: Implement `categorize.go`**

Create `internal/capture/categorize.go`:

```go
package capture

import (
	"regexp"
	"sort"
	"strings"
)

// Category labels a network interface for UI display and ranking.
type Category string

const (
	CategoryWiFi     Category = "wifi"
	CategoryEthernet Category = "ethernet"
	CategoryExitLag  Category = "exitlag"
	CategoryVPN      Category = "vpn"
	CategoryVirtual  Category = "virtual"
	CategoryOther    Category = "other"
)

// categoryRules are evaluated in order; first match wins. Patterns run on
// lowercase(name + " " + description) to work for Windows (description-rich)
// and Linux (name-rich) alike.
var categoryRules = []struct {
	cat Category
	re  *regexp.Regexp
}{
	{CategoryVirtual, regexp.MustCompile(`virtualbox|vmware|hyper-v|virtual switch|vethernet|teredo|loopback pseudo|software loopback|wi-fi direct|mobile hotspot|\bdocker\d|\bbr-|\bvirbr\d|\bvmnet\d|\bveth|^lo$`)},
	{CategoryExitLag, regexp.MustCompile(`exit\s*lag`)},
	{CategoryVPN, regexp.MustCompile(`vpn|wireguard|wintun|tap-windows|openvpn|\btun\d|\btap\d|\bwg\d|\bppp\d`)},
	{CategoryWiFi, regexp.MustCompile(`wi-?fi|wireless|802\.11|\bwlan\d|\bwlp\d|\bwifi\d`)},
	{CategoryEthernet, regexp.MustCompile(`ethernet|gigabit|family controller|\beth\d|\benp\d|\beno\d|\bens\d`)},
}

// Categorize classifies an interface from its OS name and human description.
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

// RankCandidates returns a stable copy of in sorted by category priority.
// Ties keep input order (sort.SliceStable).
func RankCandidates(in []NetworkInterface) []NetworkInterface {
	out := make([]NetworkInterface, len(in))
	copy(out, in)
	sort.SliceStable(out, func(i, j int) bool {
		ci := Categorize(out[i].Name, out[i].Description)
		cj := Categorize(out[j].Name, out[j].Description)
		return categoryRank[ci] < categoryRank[cj]
	})
	return out
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
go test ./internal/capture/ -run 'TestCategorize|TestRankCandidates' -v
```

Expected: PASS, all 36+ subtests green.

- [ ] **Step 5: Commit**

```bash
git add internal/capture/categorize.go internal/capture/categorize_test.go
git commit -m "feat(91): categorize network interfaces by name+description"
```

---

## Task 2: Network config persistence + ip.txt migration

**Files:**
- Create: `internal/capture/network_config.go`, `internal/capture/network_config_test.go`.

- [ ] **Step 1: Write the failing test**

Create `internal/capture/network_config_test.go`:

```go
package capture

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestConfigRoundTrip(t *testing.T) {
	dir := t.TempDir()
	cfg := Config{
		CaptureInterfaces: []PersistedInterface{
			{Name: `\Device\NPF_{ABC}`, Description: "Wi-Fi"},
			{Name: `\Device\NPF_{DEF}`, Description: "Realtek"},
		},
	}
	if err := WriteConfig(dir, cfg); err != nil {
		t.Fatalf("WriteConfig: %v", err)
	}
	got, err := ReadConfig(dir)
	if err != nil {
		t.Fatalf("ReadConfig: %v", err)
	}
	if len(got.CaptureInterfaces) != 2 {
		t.Fatalf("got %d entries, want 2", len(got.CaptureInterfaces))
	}
	if got.CaptureInterfaces[0].Description != "Wi-Fi" {
		t.Errorf("entry 0 description = %q, want Wi-Fi", got.CaptureInterfaces[0].Description)
	}
}

func TestReadConfigMissing(t *testing.T) {
	dir := t.TempDir()
	cfg, err := ReadConfig(dir)
	if err != nil {
		t.Fatalf("ReadConfig on empty dir: %v", err)
	}
	if len(cfg.CaptureInterfaces) != 0 {
		t.Errorf("missing config returned %d entries, want 0", len(cfg.CaptureInterfaces))
	}
}

func TestReadConfigMalformed(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "network.json"), []byte("{not json"), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	cfg, err := ReadConfig(dir)
	if err == nil {
		t.Fatalf("expected error on malformed JSON, got cfg=%+v", cfg)
	}
}

func TestMigrateFromIPTxt(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "ip.txt"), []byte("192.168.1.42\n"), 0o644); err != nil {
		t.Fatalf("WriteFile ip.txt: %v", err)
	}
	resolve := func(ip string) (PersistedInterface, error) {
		if ip != "192.168.1.42" {
			t.Errorf("resolve called with %q, want 192.168.1.42", ip)
		}
		return PersistedInterface{Name: `\Device\NPF_{X}`, Description: "Wi-Fi"}, nil
	}
	migrated, err := MigrateIPTxt(dir, resolve)
	if err != nil {
		t.Fatalf("MigrateIPTxt: %v", err)
	}
	if !migrated {
		t.Fatal("expected migrated=true")
	}
	cfg, _ := ReadConfig(dir)
	if len(cfg.CaptureInterfaces) != 1 || cfg.CaptureInterfaces[0].Description != "Wi-Fi" {
		t.Errorf("migrated config wrong: %+v", cfg)
	}
	if _, err := os.Stat(filepath.Join(dir, "ip.txt")); !os.IsNotExist(err) {
		t.Errorf("ip.txt should be deleted, err=%v", err)
	}
}

func TestMigrateNoIPTxt(t *testing.T) {
	dir := t.TempDir()
	migrated, err := MigrateIPTxt(dir, nil)
	if err != nil {
		t.Fatalf("MigrateIPTxt with no ip.txt: %v", err)
	}
	if migrated {
		t.Error("expected migrated=false when no ip.txt")
	}
}

func TestWriteConfigOverwritesAtomically(t *testing.T) {
	dir := t.TempDir()
	cfg1 := Config{CaptureInterfaces: []PersistedInterface{{Name: "A", Description: "First"}}}
	if err := WriteConfig(dir, cfg1); err != nil {
		t.Fatal(err)
	}
	cfg2 := Config{CaptureInterfaces: []PersistedInterface{{Name: "B", Description: "Second"}}}
	if err := WriteConfig(dir, cfg2); err != nil {
		t.Fatal(err)
	}
	got, _ := ReadConfig(dir)
	if got.CaptureInterfaces[0].Description != "Second" {
		t.Errorf("overwrite failed, got %+v", got)
	}
	// ensure no leftover .tmp
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".tmp" {
			t.Errorf("leftover tmp file: %s", e.Name())
		}
	}
	// also ensure file is valid JSON via independent decode
	data, _ := os.ReadFile(filepath.Join(dir, "network.json"))
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Errorf("network.json not valid JSON: %v", err)
	}
}
```

- [ ] **Step 2: Run test, verify it fails**

```bash
go test ./internal/capture/ -run 'TestConfig|TestRead|TestMigrate|TestWrite' -v
```

Expected: FAIL with `undefined: Config`, `undefined: WriteConfig`, etc.

- [ ] **Step 3: Implement `network_config.go`**

Create `internal/capture/network_config.go`:

```go
package capture

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const configFilename = "network.json"
const legacyIPFilename = "ip.txt"

// PersistedInterface is the on-disk record used to reopen a capture handle
// across restarts. Name is the OS device identifier (stable). Description is
// the human-readable label (preserved for UI display + fallback if Name is
// reissued by the OS).
type PersistedInterface struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Config is the on-disk shape of network.json.
type Config struct {
	CaptureInterfaces []PersistedInterface `json:"captureInterfaces"`
}

// ReadConfig loads network.json from appDir. Returns an empty Config (nil
// error) if the file does not exist. Returns an error if the file exists but
// cannot be parsed.
func ReadConfig(appDir string) (Config, error) {
	path := filepath.Join(appDir, configFilename)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Config{}, nil
		}
		return Config{}, fmt.Errorf("read %s: %w", path, err)
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("parse %s: %w", path, err)
	}
	return cfg, nil
}

// WriteConfig serializes cfg to network.json atomically (write to .tmp, rename).
// On Windows the rename across the same directory is atomic since Go 1.5+.
func WriteConfig(appDir string, cfg Config) error {
	path := filepath.Join(appDir, configFilename)
	tmp := path + ".tmp"
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write tmp: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("rename tmp: %w", err)
	}
	return nil
}

// IPResolver resolves a legacy IPv4 string to an interface record. The Manager
// supplies a real implementation via pcap.FindAllDevs at boot time. Tests
// inject a fake.
type IPResolver func(ip string) (PersistedInterface, error)

// MigrateIPTxt reads legacy ip.txt if present and writes its single entry into
// network.json (only if network.json is currently empty/missing). Returns
// migrated=true if migration happened.
func MigrateIPTxt(appDir string, resolve IPResolver) (bool, error) {
	ipPath := filepath.Join(appDir, legacyIPFilename)
	data, err := os.ReadFile(ipPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("read %s: %w", ipPath, err)
	}
	ip := strings.TrimSpace(string(data))
	if ip == "" {
		_ = os.Remove(ipPath)
		return false, nil
	}
	existing, err := ReadConfig(appDir)
	if err == nil && len(existing.CaptureInterfaces) > 0 {
		// network.json already populated, leave it alone but remove ip.txt
		_ = os.Remove(ipPath)
		return false, nil
	}
	if resolve == nil {
		return false, fmt.Errorf("no IP resolver provided for migration")
	}
	entry, err := resolve(ip)
	if err != nil {
		// Resolution failed (interface gone). Remove ip.txt to avoid retrying
		// on every boot; user will pick a fresh interface from Settings.
		_ = os.Remove(ipPath)
		return false, fmt.Errorf("resolve legacy ip %q: %w", ip, err)
	}
	cfg := Config{CaptureInterfaces: []PersistedInterface{entry}}
	if err := WriteConfig(appDir, cfg); err != nil {
		return false, err
	}
	_ = os.Remove(ipPath)
	return true, nil
}
```

- [ ] **Step 4: Run test, verify all pass**

```bash
go test ./internal/capture/ -run 'TestConfig|TestRead|TestMigrate|TestWrite' -v
```

Expected: PASS, all 6 subtests green.

- [ ] **Step 5: Commit**

```bash
git add internal/capture/network_config.go internal/capture/network_config_test.go
git commit -m "feat(91): network.json persistence + ip.txt migration"
```

---

## Task 3: Refactor Capturer to single-handle worker (drop CLI prompt)

**Files:**
- Modify: `internal/capture/pcap.go`.
- Existing tests in `internal/capture/` should still pass (no test for prompt logic exists).

- [ ] **Step 1: Read current pcap.go to confirm scope**

```bash
sed -n '1,50p' internal/capture/pcap.go
```

Note the public surface: `New`, `OnPacket`, `Start`, `Close`, `AdapterIP`, `BytesReceived`, `Stats`. The CLI prompt and `getAdapterIP` are private.

- [ ] **Step 2: Replace pcap.go with the simplified worker**

Replace the contents of `internal/capture/pcap.go` with:

```go
package capture

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
)

const (
	AlbionPort  = 5056
	SnapLen     = 65536
	Promiscuous = false
	// BlockForever deadlocks handle.Close() when idle; poll on timeout.
	ReadTimeout = 100 * time.Millisecond
)

// NetworkInterface describes a candidate interface enumerated from pcap.
type NetworkInterface struct {
	Name        string
	Description string
	Address     string
	Device      string // raw pcap device name (same as Name on Windows; aliased for clarity)
}

// PacketHandler is called for each captured UDP payload.
type PacketHandler func(payload []byte)

// Capturer owns one pcap.Handle and processes packets in its caller-provided
// goroutine via Start. Lifecycle is owned by Manager.
type Capturer struct {
	handle   *pcap.Handle
	iface    NetworkInterface
	onPacket PacketHandler
	ctx      context.Context
	cancel   context.CancelFunc

	bytesReceived uint64
}

// captureFactory is overridable in tests.
var captureFactory = openLiveCapture

func openLiveCapture(ctx context.Context, iface NetworkInterface) (*Capturer, error) {
	handle, err := pcap.OpenLive(iface.Device, SnapLen, Promiscuous, ReadTimeout)
	if err != nil {
		return nil, fmt.Errorf("open device %q: %w", iface.Device, err)
	}
	filter := fmt.Sprintf("udp and (dst port %d or src port %d)", AlbionPort, AlbionPort)
	if err := handle.SetBPFFilter(filter); err != nil {
		handle.Close()
		return nil, fmt.Errorf("set BPF filter on %q: %w", iface.Device, err)
	}
	cctx, cancel := context.WithCancel(ctx)
	return &Capturer{
		handle: handle,
		iface:  iface,
		ctx:    cctx,
		cancel: cancel,
	}, nil
}

// OnPacket registers the packet handler. Must be called before Start.
func (c *Capturer) OnPacket(h PacketHandler) { c.onPacket = h }

// Start blocks reading packets until the context is canceled or the handle
// returns an error.
func (c *Capturer) Start() error {
	source := gopacket.NewPacketSource(c.handle, c.handle.LinkType())
	for {
		select {
		case <-c.ctx.Done():
			return c.ctx.Err()
		case pkt, ok := <-source.Packets():
			if !ok {
				return nil
			}
			c.processPacket(pkt)
		}
	}
}

// Close cancels the read loop and closes the underlying handle. Must NOT be
// called while Start is still polling on a packet — Manager guarantees that.
func (c *Capturer) Close() {
	if c.cancel != nil {
		c.cancel()
	}
	if c.handle != nil {
		c.handle.Close()
	}
}

// Iface returns the interface this capturer is bound to.
func (c *Capturer) Iface() NetworkInterface { return c.iface }

// BytesReceived returns the cumulative payload byte count.
func (c *Capturer) BytesReceived() uint64 { return atomic.LoadUint64(&c.bytesReceived) }

// Stats returns libpcap stats for the underlying handle.
func (c *Capturer) Stats() (*pcap.Stats, error) {
	if c.handle == nil {
		return nil, nil
	}
	return c.handle.Stats()
}

func (c *Capturer) processPacket(p gopacket.Packet) {
	udpLayer := p.Layer(layers.LayerTypeUDP)
	if udpLayer == nil {
		return
	}
	udp, ok := udpLayer.(*layers.UDP)
	if !ok || len(udp.Payload) == 0 || c.onPacket == nil {
		return
	}
	atomic.AddUint64(&c.bytesReceived, uint64(len(udp.Payload)))
	c.onPacket(udp.Payload)
}

// EnumerateInterfaces lists candidate interfaces (those with at least one IPv4)
// suitable for capture. Wraps pcap.FindAllDevs.
func EnumerateInterfaces() ([]NetworkInterface, error) {
	devs, err := pcap.FindAllDevs()
	if err != nil {
		return nil, fmt.Errorf("list devices: %w", err)
	}
	var out []NetworkInterface
	for _, d := range devs {
		for _, addr := range d.Addresses {
			ip4 := addr.IP.To4()
			if ip4 == nil {
				continue
			}
			out = append(out, NetworkInterface{
				Name:        d.Name,
				Description: d.Description,
				Address:     ip4.String(),
				Device:      d.Name,
			})
			break // first IPv4 only, mirrors legacy behavior
		}
	}
	return out, nil
}

// ResolveByIP finds the interface name for a given IPv4 (used by ip.txt
// migration).
func ResolveByIP(ip string) (PersistedInterface, error) {
	ifaces, err := EnumerateInterfaces()
	if err != nil {
		return PersistedInterface{}, err
	}
	for _, i := range ifaces {
		if i.Address == ip {
			return PersistedInterface{Name: i.Name, Description: i.Description}, nil
		}
	}
	return PersistedInterface{}, fmt.Errorf("no interface with IP %s", ip)
}
```

- [ ] **Step 3: Confirm existing capture package tests still pass**

```bash
go test ./internal/capture/ -v
```

Expected: PASS — categorize and network_config tests from Tasks 1 and 2 still green; no other tests yet.

- [ ] **Step 4: Build the rest of the project to surface call-site breaks**

```bash
go build ./...
```

Expected: build errors in `cmd/radar/main.go` (uses removed `New`) and possibly `internal/ui/dashboard.go` (uses removed `AdapterIP`). These are addressed in Tasks 6 and 7.

- [ ] **Step 5: Stash the build break temporarily**

The build will stay broken until Task 6 wires Manager into main. That's expected. Run tests on the capture package only to verify the refactor is clean:

```bash
go test ./internal/capture/...
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add internal/capture/pcap.go
git commit -m "refactor(91): simplify Capturer to single-handle worker"
```

---

## Task 4: Manager lifecycle

**Files:**
- Create: `internal/capture/manager.go`, `internal/capture/manager_test.go`.

- [ ] **Step 1: Write failing tests**

Create `internal/capture/manager_test.go`:

```go
package capture

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// captureFactoryStub replaces openLiveCapture for the duration of a test.
type stubHandle struct {
	closed atomic.Bool
}

func newStubCapturer(iface NetworkInterface) *Capturer {
	ctx, cancel := context.WithCancel(context.Background())
	return &Capturer{
		iface:  iface,
		ctx:    ctx,
		cancel: cancel,
	}
}

func withStubFactory(t *testing.T, opens map[string]error) func() {
	t.Helper()
	prev := captureFactory
	captureFactory = func(ctx context.Context, iface NetworkInterface) (*Capturer, error) {
		if err, ok := opens[iface.Name]; ok && err != nil {
			return nil, err
		}
		c := newStubCapturer(iface)
		// Replace cancel with a parent-aware one so Close propagates.
		c.ctx, c.cancel = context.WithCancel(ctx)
		return c, nil
	}
	return func() { captureFactory = prev }
}

func TestManagerReconfigureAddsRemoves(t *testing.T) {
	defer withStubFactory(t, nil)()

	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})

	if err := m.Reconfigure([]NetworkInterface{{Name: "a", Device: "a"}, {Name: "b", Device: "b"}}); err != nil {
		t.Fatalf("Reconfigure add: %v", err)
	}
	state := m.State()
	if len(state.Active) != 2 {
		t.Fatalf("got %d active, want 2", len(state.Active))
	}

	if err := m.Reconfigure([]NetworkInterface{{Name: "b", Device: "b"}, {Name: "c", Device: "c"}}); err != nil {
		t.Fatalf("Reconfigure swap: %v", err)
	}
	state = m.State()
	names := make(map[string]bool)
	for _, i := range state.Active {
		names[i.Name] = true
	}
	if !names["b"] || !names["c"] || names["a"] {
		t.Errorf("after swap want {b,c}, got %+v", state.Active)
	}

	if err := m.Reconfigure(nil); err != nil {
		t.Fatalf("Reconfigure empty: %v", err)
	}
	state = m.State()
	if len(state.Active) != 0 {
		t.Errorf("after empty want 0 active, got %d", len(state.Active))
	}
	if state.Status != StatusAwaiting {
		t.Errorf("status %q, want %q", state.Status, StatusAwaiting)
	}

	m.Close(context.Background())
}

func TestManagerOpenFailureIsolatesOthers(t *testing.T) {
	defer withStubFactory(t, map[string]error{"bad": errors.New("boom")})()

	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})
	err := m.Reconfigure([]NetworkInterface{
		{Name: "good", Device: "good"},
		{Name: "bad", Device: "bad"},
	})
	if err == nil {
		t.Fatal("expected partial-failure error")
	}
	state := m.State()
	if len(state.Active) != 1 || state.Active[0].Name != "good" {
		t.Errorf("after partial failure want {good}, got %+v", state.Active)
	}
	if len(state.LastErrors) == 0 || state.LastErrors["bad"] == "" {
		t.Errorf("expected lastErrors[bad], got %+v", state.LastErrors)
	}

	m.Close(context.Background())
}

func TestManagerCloseTwiceSafe(t *testing.T) {
	defer withStubFactory(t, nil)()
	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})
	_ = m.Reconfigure([]NetworkInterface{{Name: "a", Device: "a"}})
	m.Close(context.Background())
	m.Close(context.Background()) // must not panic
}

func TestManagerNoGoroutineLeak(t *testing.T) {
	defer withStubFactory(t, nil)()

	var workerStarted, workerExited atomic.Int32
	prev := managerStartWorker
	managerStartWorker = func(c *Capturer, wg *sync.WaitGroup, onError func(string, error)) {
		workerStarted.Add(1)
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer workerExited.Add(1)
			<-c.ctx.Done()
		}()
	}
	defer func() { managerStartWorker = prev }()

	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})
	_ = m.Reconfigure([]NetworkInterface{{Name: "a", Device: "a"}, {Name: "b", Device: "b"}})

	closeCtx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	m.Close(closeCtx)

	if got, want := workerStarted.Load(), int32(2); got != want {
		t.Errorf("workerStarted=%d, want %d", got, want)
	}
	if got, want := workerExited.Load(), int32(2); got != want {
		t.Errorf("workerExited=%d, want %d (goroutine leak)", got, want)
	}
}
```

- [ ] **Step 2: Run, verify failing**

```bash
go test ./internal/capture/ -run TestManager -v
```

Expected: FAIL `undefined: NewManager`.

- [ ] **Step 3: Implement `manager.go`**

Create `internal/capture/manager.go`:

```go
package capture

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Status describes the manager's overall state.
type Status string

const (
	StatusRunning   Status = "running"
	StatusAwaiting  Status = "awaiting_interfaces"
)

// CaptureSummary is a snapshot row of an active or recently-failed interface.
type CaptureSummary struct {
	Name        string
	Description string
	Address     string
	Category    Category
	StartedAt   time.Time
}

// State is the externally-visible Manager snapshot.
type State struct {
	Status     Status
	Active     []CaptureSummary
	LastErrors map[string]string
}

// managerStartWorker is overridable in tests to assert lifecycle without real pcap.
var managerStartWorker = startWorker

// Manager owns multiple Capturers. Open/close ordering is strict; see comments
// at each method.
type Manager struct {
	parentCtx context.Context

	mu         sync.Mutex
	active     map[string]*managedCapturer
	wg         sync.WaitGroup
	onPacket   PacketHandler
	lastErrors map[string]string
	closed     bool
}

type managedCapturer struct {
	cap       *Capturer
	startedAt time.Time
	cancel    context.CancelFunc
}

// NewManager creates an empty manager bound to parent ctx.
func NewManager(parentCtx context.Context) *Manager {
	return &Manager{
		parentCtx:  parentCtx,
		active:     make(map[string]*managedCapturer),
		lastErrors: make(map[string]string),
	}
}

// OnPacket registers the shared packet handler. Must be called before
// Reconfigure. Concurrent calls from multiple goroutines hit the same handler
// (Photon parser is idempotent on retransmits so duplicates are tolerated).
func (m *Manager) OnPacket(h PacketHandler) {
	m.mu.Lock()
	m.onPacket = h
	m.mu.Unlock()
}

// Reconfigure aligns the active set to target. Additions happen before
// removals so a swap of one interface does not leave us with zero captures
// momentarily.
//
// Returns a non-nil error if at least one open failed. The active set still
// reflects all successful opens; per-interface errors are exposed via State().
func (m *Manager) Reconfigure(target []NetworkInterface) error {
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return fmt.Errorf("manager closed")
	}
	if m.onPacket == nil {
		m.mu.Unlock()
		return fmt.Errorf("OnPacket must be called before Reconfigure")
	}

	desired := make(map[string]NetworkInterface, len(target))
	for _, i := range target {
		desired[i.Name] = i
	}

	// 1. Open new ones first.
	var openErrs []string
	for name, iface := range desired {
		if _, exists := m.active[name]; exists {
			continue
		}
		cap, err := captureFactory(m.parentCtx, iface)
		if err != nil {
			m.lastErrors[name] = err.Error()
			openErrs = append(openErrs, fmt.Sprintf("%s: %v", name, err))
			continue
		}
		cap.OnPacket(m.onPacket)
		mc := &managedCapturer{cap: cap, startedAt: time.Now(), cancel: cap.cancel}
		m.active[name] = mc
		delete(m.lastErrors, name)
		managerStartWorker(cap, &m.wg, func(n string, e error) {
			m.mu.Lock()
			m.lastErrors[n] = e.Error()
			delete(m.active, n)
			m.mu.Unlock()
		})
	}

	// 2. Stop removed ones.
	for name, mc := range m.active {
		if _, keep := desired[name]; keep {
			continue
		}
		mc.cancel()
		mc.cap.Close()
		delete(m.active, name)
		delete(m.lastErrors, name)
	}

	m.mu.Unlock()

	if len(openErrs) > 0 {
		return fmt.Errorf("partial open failures: %v", openErrs)
	}
	return nil
}

// State snapshots the current active set + last-known per-interface errors.
func (m *Manager) State() State {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := State{
		LastErrors: make(map[string]string, len(m.lastErrors)),
	}
	for k, v := range m.lastErrors {
		out.LastErrors[k] = v
	}
	for _, mc := range m.active {
		i := mc.cap.iface
		out.Active = append(out.Active, CaptureSummary{
			Name:        i.Name,
			Description: i.Description,
			Address:     i.Address,
			Category:    Categorize(i.Name, i.Description),
			StartedAt:   mc.startedAt,
		})
	}
	if len(out.Active) == 0 {
		out.Status = StatusAwaiting
	} else {
		out.Status = StatusRunning
	}
	return out
}

// Close cancels every worker context, then closes handles. Waits up to
// closeCtx.Deadline for goroutines to drain. Idempotent.
func (m *Manager) Close(closeCtx context.Context) {
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return
	}
	m.closed = true
	for _, mc := range m.active {
		mc.cancel()
	}
	captures := make([]*Capturer, 0, len(m.active))
	for _, mc := range m.active {
		captures = append(captures, mc.cap)
	}
	m.active = nil
	m.mu.Unlock()

	// Wait for workers to exit before closing handles. libpcap is unsafe to
	// close while Read is still polling.
	done := make(chan struct{})
	go func() {
		m.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-closeCtx.Done():
	}
	for _, c := range captures {
		c.Close()
	}
}

// startWorker runs Capturer.Start in a goroutine and reports errors via onError.
func startWorker(c *Capturer, wg *sync.WaitGroup, onError func(string, error)) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := c.Start(); err != nil && err != context.Canceled {
			onError(c.iface.Name, err)
		}
	}()
}
```

- [ ] **Step 4: Run tests, verify passing**

```bash
go test ./internal/capture/ -run TestManager -v
```

Expected: PASS, all 4 subtests green.

- [ ] **Step 5: Run full capture package tests**

```bash
go test ./internal/capture/ -v
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add internal/capture/manager.go internal/capture/manager_test.go
git commit -m "feat(91): Manager owns multi-handle capture lifecycle"
```

---

## Task 5: HTTP API endpoints

**Files:**
- Create: `internal/server/network_api.go`, `internal/server/network_api_test.go`.
- Modify: `internal/server/http.go` to register the new routes.

- [ ] **Step 1: Write failing test**

Create `internal/server/network_api_test.go`:

```go
package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nospy/albion-openradar/internal/capture"
)

type fakeManager struct {
	state         capture.State
	reconfArgs    []capture.NetworkInterface
	reconfErr     error
	allInterfaces []capture.NetworkInterface
}

func (f *fakeManager) State() capture.State { return f.state }
func (f *fakeManager) Reconfigure(t []capture.NetworkInterface) error {
	f.reconfArgs = append([]capture.NetworkInterface(nil), t...)
	return f.reconfErr
}

func TestNetworkAPI_ListReturnsCategorized(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{
			{Name: "n1", Description: "Wi-Fi", Address: "192.168.1.1"},
			{Name: "n2", Description: "Realtek PCIe GbE Family Controller", Address: "192.168.1.2"},
		},
		state: capture.State{
			Active: []capture.CaptureSummary{{Name: "n1"}},
		},
	}
	api := NewNetworkAPI(fm, fm.allInterfaces, "/tmp/notused", func() []string { return []string{"192.168.1.5"} })
	req := httptest.NewRequest("GET", "/api/network/interfaces", nil)
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("status %d", rec.Code)
	}
	var got []map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len=%d", len(got))
	}
	for _, row := range got {
		if row["category"] == "" {
			t.Errorf("missing category in %+v", row)
		}
	}
}

func TestNetworkAPI_PostFromLoopback(t *testing.T) {
	fm := &fakeManager{
		allInterfaces: []capture.NetworkInterface{
			{Name: "x", Description: "Wi-Fi", Address: "10.0.0.1"},
		},
	}
	dir := t.TempDir()
	api := NewNetworkAPI(fm, fm.allInterfaces, dir, func() []string { return nil })

	body, _ := json.Marshal(map[string]any{"names": []string{"x"}})
	req := httptest.NewRequest("POST", "/api/network/interfaces", bytes.NewReader(body))
	req.RemoteAddr = "127.0.0.1:1234"
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("loopback POST got %d, body=%s", rec.Code, rec.Body.String())
	}
	if len(fm.reconfArgs) != 1 || fm.reconfArgs[0].Name != "x" {
		t.Errorf("Reconfigure called with %+v", fm.reconfArgs)
	}
	cfg, _ := capture.ReadConfig(dir)
	if len(cfg.CaptureInterfaces) != 1 || cfg.CaptureInterfaces[0].Name != "x" {
		t.Errorf("config not persisted: %+v", cfg)
	}
}

func TestNetworkAPI_PostFromLanRejected(t *testing.T) {
	fm := &fakeManager{}
	dir := t.TempDir()
	api := NewNetworkAPI(fm, nil, dir, func() []string { return nil })

	body, _ := json.Marshal(map[string]any{"names": []string{"x"}})
	req := httptest.NewRequest("POST", "/api/network/interfaces", bytes.NewReader(body))
	req.RemoteAddr = "192.168.1.42:5555"
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("status %d, want 403", rec.Code)
	}
	if len(fm.reconfArgs) != 0 {
		t.Errorf("Reconfigure should not have been called from non-loopback")
	}
}

func TestNetworkAPI_StateShape(t *testing.T) {
	fm := &fakeManager{
		state: capture.State{
			Status: capture.StatusRunning,
			Active: []capture.CaptureSummary{{Name: "x", Description: "Wi-Fi", Address: "10.0.0.1"}},
		},
	}
	api := NewNetworkAPI(fm, nil, "/tmp", func() []string { return []string{"192.168.1.1"} })
	req := httptest.NewRequest("GET", "/api/network/state", nil)
	rec := httptest.NewRecorder()
	api.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("status %d", rec.Code)
	}
	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["isCapturing"] != true {
		t.Errorf("isCapturing=%v", body["isCapturing"])
	}
	if body["lanAddresses"] == nil {
		t.Error("lanAddresses missing")
	}
}
```

- [ ] **Step 2: Run, verify failing**

```bash
go test ./internal/server/ -run TestNetworkAPI -v
```

Expected: FAIL `undefined: NewNetworkAPI`.

- [ ] **Step 3: Implement `network_api.go`**

Create `internal/server/network_api.go`:

```go
package server

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"

	"github.com/nospy/albion-openradar/internal/capture"
)

// NetworkManager is the subset of capture.Manager the API needs.
type NetworkManager interface {
	State() capture.State
	Reconfigure([]capture.NetworkInterface) error
}

// LANAddrFn returns the IP addresses (without port) reachable from devices on
// the same LAN as the host. Computed independently of the capture interfaces.
type LANAddrFn func() []string

// NetworkAPI mounts /api/network/* routes.
type NetworkAPI struct {
	mgr        NetworkManager
	all        []capture.NetworkInterface // refreshed via /refresh
	appDir     string
	lanAddrs   LANAddrFn
}

func NewNetworkAPI(mgr NetworkManager, all []capture.NetworkInterface, appDir string, lan LANAddrFn) *NetworkAPI {
	return &NetworkAPI{mgr: mgr, all: all, appDir: appDir, lanAddrs: lan}
}

// Register attaches the routes to a mux.
func (a *NetworkAPI) Register(mux *http.ServeMux) {
	mux.Handle("/api/network/interfaces", a)
	mux.Handle("/api/network/state", a)
	mux.Handle("/api/network/refresh", a)
}

func (a *NetworkAPI) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/network/interfaces":
		switch r.Method {
		case http.MethodGet:
			a.handleList(w, r)
		case http.MethodPost:
			a.handleSelect(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case "/api/network/state":
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		a.handleState(w, r)
	case "/api/network/refresh":
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		a.handleRefresh(w, r)
	default:
		http.NotFound(w, r)
	}
}

type ifaceRow struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Address     string `json:"address"`
	Category    string `json:"category"`
	IsPersisted bool   `json:"isPersisted"`
	IsAvailable bool   `json:"isAvailable"`
}

func (a *NetworkAPI) handleList(w http.ResponseWriter, _ *http.Request) {
	persisted := make(map[string]bool)
	cfg, _ := capture.ReadConfig(a.appDir)
	for _, p := range cfg.CaptureInterfaces {
		persisted[p.Name] = true
	}
	available := make(map[string]bool)
	for _, i := range a.all {
		available[i.Name] = true
	}
	rows := make([]ifaceRow, 0, len(a.all))
	for _, i := range capture.RankCandidates(a.all) {
		rows = append(rows, ifaceRow{
			Name:        i.Name,
			Description: i.Description,
			Address:     i.Address,
			Category:    string(capture.Categorize(i.Name, i.Description)),
			IsPersisted: persisted[i.Name],
			IsAvailable: available[i.Name],
		})
	}
	writeJSON(w, http.StatusOK, rows)
}

type stateBody struct {
	CaptureInterfaces []capture.CaptureSummary `json:"captureInterfaces"`
	IsCapturing       bool                     `json:"isCapturing"`
	LanAddresses      []string                 `json:"lanAddresses"`
	LastErrors        map[string]string        `json:"lastErrors"`
	Status            string                   `json:"status"`
}

func (a *NetworkAPI) handleState(w http.ResponseWriter, _ *http.Request) {
	s := a.mgr.State()
	body := stateBody{
		CaptureInterfaces: s.Active,
		IsCapturing:       len(s.Active) > 0,
		LanAddresses:      a.lanAddrs(),
		LastErrors:        s.LastErrors,
		Status:            string(s.Status),
	}
	writeJSON(w, http.StatusOK, body)
}

type selectBody struct {
	Names []string `json:"names"`
}

func (a *NetworkAPI) handleSelect(w http.ResponseWriter, r *http.Request) {
	if !isLoopback(r.RemoteAddr) {
		http.Error(w, "capture interfaces can only be changed from the host PC", http.StatusForbidden)
		return
	}
	var body selectBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}
	desired := make([]capture.NetworkInterface, 0, len(body.Names))
	for _, name := range body.Names {
		for _, i := range a.all {
			if i.Name == name {
				desired = append(desired, i)
				break
			}
		}
	}
	if err := a.mgr.Reconfigure(desired); err != nil {
		http.Error(w, "reconfigure: "+err.Error(), http.StatusInternalServerError)
		return
	}
	persisted := make([]capture.PersistedInterface, 0, len(desired))
	for _, i := range desired {
		persisted = append(persisted, capture.PersistedInterface{Name: i.Name, Description: i.Description})
	}
	if err := capture.WriteConfig(a.appDir, capture.Config{CaptureInterfaces: persisted}); err != nil {
		http.Error(w, "persist: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *NetworkAPI) handleRefresh(w http.ResponseWriter, _ *http.Request) {
	fresh, err := capture.EnumerateInterfaces()
	if err != nil {
		http.Error(w, "enumerate: "+err.Error(), http.StatusInternalServerError)
		return
	}
	a.all = fresh
	a.handleList(w, nil)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func isLoopback(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	host = strings.TrimSpace(host)
	if host == "" {
		return false
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback()
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
go test ./internal/server/ -run TestNetworkAPI -v
```

Expected: PASS, 4 subtests green.

- [ ] **Step 5: Commit**

```bash
git add internal/server/network_api.go internal/server/network_api_test.go
git commit -m "feat(91): /api/network/* endpoints (loopback-only POST)"
```

---

## Task 6: Wire Manager + API into main.go and HTTP server

**Files:**
- Modify: `cmd/radar/main.go`, `internal/server/http.go`.

- [ ] **Step 1: Read current main.go capture init flow**

```bash
grep -n 'capture\.\|adapterIP\|ipAddr' cmd/radar/main.go
```

Identify the `New(...)` call site and the `--ip` flag binding.

- [ ] **Step 2: Replace single Capturer with Manager bootstrap**

In `cmd/radar/main.go`, locate the block initializing the capturer (around line 83-99). Replace with:

```go
// Enumerate first so we can pre-resolve the persisted set.
allIfaces, err := capture.EnumerateInterfaces()
if err != nil {
    return fmt.Errorf("enumerate interfaces: %w", err)
}

// Migrate legacy ip.txt if present (one-shot, idempotent).
_, _ = capture.MigrateIPTxt(appDir, capture.ResolveByIP)

// Read persisted choice; if empty, auto-pick top-ranked physicals.
cfg, _ := capture.ReadConfig(appDir)
target := resolvePersisted(cfg, allIfaces, cliIPOverride)
if len(target) == 0 {
    target = autoPickDefaults(allIfaces)
    if len(target) > 0 {
        var persisted []capture.PersistedInterface
        for _, i := range target {
            persisted = append(persisted, capture.PersistedInterface{Name: i.Name, Description: i.Description})
        }
        _ = capture.WriteConfig(appDir, capture.Config{CaptureInterfaces: persisted})
        logger.PrintInfo("NET", "Auto-selected %d interface(s). Change in /settings if needed.", len(target))
    }
}

manager := capture.NewManager(ctx)
manager.OnPacket(app.handlePacket)
if err := manager.Reconfigure(target); err != nil {
    logger.PrintWarn("NET", "Some interfaces failed to open: %v", err)
}
defer manager.Close(context.Background())
app.captureManager = manager
```

Add helpers in the same file (or a sibling `cmd/radar/capture_init.go`):

```go
func resolvePersisted(cfg capture.Config, all []capture.NetworkInterface, ipOverride string) []capture.NetworkInterface {
    if ipOverride != "" {
        for _, i := range all {
            if i.Address == ipOverride {
                return []capture.NetworkInterface{i}
            }
        }
        return nil
    }
    available := make(map[string]capture.NetworkInterface, len(all))
    for _, i := range all {
        available[i.Name] = i
    }
    var out []capture.NetworkInterface
    for _, p := range cfg.CaptureInterfaces {
        if i, ok := available[p.Name]; ok {
            out = append(out, i)
        }
    }
    return out
}

func autoPickDefaults(all []capture.NetworkInterface) []capture.NetworkInterface {
    var out []capture.NetworkInterface
    for _, i := range capture.RankCandidates(all) {
        c := capture.Categorize(i.Name, i.Description)
        if c == capture.CategoryEthernet || c == capture.CategoryWiFi || c == capture.CategoryExitLag {
            if isRFC1918(i.Address) {
                out = append(out, i)
            }
        }
    }
    return out
}

func isRFC1918(addr string) bool {
    ip := net.ParseIP(addr)
    if ip == nil {
        return false
    }
    for _, cidr := range []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"} {
        _, n, _ := net.ParseCIDR(cidr)
        if n.Contains(ip) {
            return true
        }
    }
    return false
}
```

Replace the field on the app struct:

```go
type radarApp struct {
    // ...
    captureManager *capture.Manager
    // remove: adapterIP string
}
```

Adjust the dashboard call to pull state from the manager (Task 7 covers the full TUI rewire).

Add the type stub at the top of `internal/ui/dashboard.go` so the build stays green at the end of this task:

```go
type CaptureSummary struct {
    Description string
    Address     string
}
```

Then update the existing `NewDashboard` signature in `dashboard.go` to accept the new parameters and the construction call in `main.go` to:

```go
dashboard := ui.NewDashboard(Version, serverPort, cfg.devMode, []string{}, []ui.CaptureSummary{})
```

Task 7 will populate the actual rendering logic and the `SetCaptureState` method.

- [ ] **Step 3: Wire NetworkAPI into the HTTP server**

In `internal/server/http.go`, modify `NewHTTPServer` (and `NewHTTPServerDev`) to accept a `NetworkManager`, and register the API in `setupRoutes`:

```go
type HTTPServer struct {
    // ... existing fields ...
    networkAPI *NetworkAPI
}

func NewHTTPServer(..., mgr NetworkManager, appDir string) (*HTTPServer, error) {
    // ... existing init ...
    s.networkAPI = NewNetworkAPI(mgr, nil, appDir, computeLANAddresses)
    s.setupRoutes()
    return s, nil
}

func (s *HTTPServer) setupRoutes() {
    // ... existing routes ...
    s.networkAPI.Register(s.mux)
}

func computeLANAddresses() []string {
    addrs, err := net.InterfaceAddrs()
    if err != nil {
        return nil
    }
    var out []string
    for _, a := range addrs {
        if ipnet, ok := a.(*net.IPNet); ok {
            ip4 := ipnet.IP.To4()
            if ip4 == nil {
                continue
            }
            for _, cidr := range []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"} {
                _, n, _ := net.ParseCIDR(cidr)
                if n.Contains(ip4) {
                    out = append(out, ip4.String())
                    break
                }
            }
        }
    }
    return out
}
```

Update `cmd/radar/main.go` to pass `manager` and `appDir` into the HTTP server constructor.

- [ ] **Step 4: Build the project**

```bash
go build ./...
```

Expected: success.

- [ ] **Step 5: Run all Go tests**

```bash
go test ./...
```

Expected: PASS across capture and server packages.

- [ ] **Step 6: Commit**

```bash
git add cmd/radar/main.go internal/server/http.go
git commit -m "feat(91): wire Manager + network API into bootstrap"
```

---

## Task 7: TUI dashboard multi-interface display

**Files:**
- Modify: `internal/ui/dashboard.go`.

- [ ] **Step 1: Define `CaptureSummary` type and update Dashboard signature**

In `internal/ui/dashboard.go`, replace `adapterIP string` with:

```go
type CaptureSummary struct {
    Description string
    Address     string
}

type Dashboard struct {
    // ... existing fields ...
    captureInterfaces []CaptureSummary
    lanAddresses      []string
    // remove: adapterIP string
}

func NewDashboard(version string, port int, devMode bool, lanAddresses []string, captures []CaptureSummary) Dashboard {
    d := Dashboard{
        // ... existing init ...
        captureInterfaces: captures,
        lanAddresses:      lanAddresses,
        serverURL:         fmt.Sprintf("http://localhost:%d", port),
    }
    if len(lanAddresses) > 0 {
        d.lanServerURL = fmt.Sprintf("http://%s:%d", lanAddresses[0], port)
        d.lanWsURL = fmt.Sprintf("ws://%s:%d/ws", lanAddresses[0], port)
    }
    return d
}

// SetCaptureState updates the live capture state from the manager.
func (d *Dashboard) SetCaptureState(captures []CaptureSummary, lan []string) {
    d.captureInterfaces = captures
    d.lanAddresses = lan
    if len(lan) > 0 {
        d.lanServerURL = fmt.Sprintf("http://%s:%d", lan[0], d.port)
    }
}
```

- [ ] **Step 2: Update display lines**

Replace any line in `dashboard.go` that built the "Adapter:" string with multi-line output:

```go
captureLine := "Capture: (awaiting)"
if len(d.captureInterfaces) > 0 {
    parts := make([]string, 0, len(d.captureInterfaces))
    for _, c := range d.captureInterfaces {
        parts = append(parts, fmt.Sprintf("%s (%s)", c.Description, c.Address))
    }
    captureLine = "Capture: " + strings.Join(parts, ", ")
}
lanLine := "LAN: (none)"
if len(d.lanAddresses) > 0 {
    urls := make([]string, 0, len(d.lanAddresses))
    for _, ip := range d.lanAddresses {
        urls = append(urls, fmt.Sprintf("http://%s:%d", ip, d.port))
    }
    lanLine = "LAN: " + strings.Join(urls, "  |  ")
}
// Use captureLine and lanLine where adapter was previously rendered.
```

- [ ] **Step 3: Periodic state refresh**

In `cmd/radar/main.go`, after dashboard construction, start a goroutine that polls `manager.State()` every 2 seconds and feeds it back via `dashboard.SetCaptureState`:

```go
go func() {
    t := time.NewTicker(2 * time.Second)
    defer t.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-t.C:
            s := manager.State()
            summaries := make([]ui.CaptureSummary, 0, len(s.Active))
            for _, a := range s.Active {
                summaries = append(summaries, ui.CaptureSummary{Description: a.Description, Address: a.Address})
            }
            dashboard.SetCaptureState(summaries, computeLANAddresses())
        }
    }
}()
```

- [ ] **Step 4: Build and run**

```bash
go build ./...
go run ./cmd/radar -dev
```

Visually confirm the TUI now shows separate "Capture:" and "LAN:" lines. Quit with Ctrl+C and verify clean shutdown (no goroutine panic).

- [ ] **Step 5: Commit**

```bash
git add internal/ui/dashboard.go cmd/radar/main.go
git commit -m "feat(91): TUI shows multi-interface capture and LAN URLs"
```

---

## Task 8: Settings page UI + JS handler

**Files:**
- Create: `web/scripts/handlers/NetworkSettingsHandler.js`, `web/scripts/handlers/_NetworkSettingsHandler.test.js`.
- Modify: `internal/templates/pages/settings.gohtml`.

- [ ] **Step 1: Write failing test**

Create `web/scripts/handlers/_NetworkSettingsHandler.test.js`:

```javascript
import {describe, test, expect, beforeEach, vi, afterEach} from 'vitest';

const {NetworkSettingsHandler} = await import('./NetworkSettingsHandler.js');

describe('NetworkSettingsHandler', () => {
    let container;
    beforeEach(() => {
        document.body.innerHTML = '<div id="network-section"></div>';
        container = document.getElementById('network-section');
        global.fetch = vi.fn();
    });
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    test('renders one row per interface with badge', async () => {
        global.fetch
            .mockResolvedValueOnce({ok: true, json: async () => ([
                {name: 'a', description: 'Wi-Fi', address: '192.168.1.1', category: 'wifi', isPersisted: true, isAvailable: true},
                {name: 'b', description: 'TAP-Windows', address: '10.8.0.1', category: 'vpn', isPersisted: false, isAvailable: true},
            ])})
            .mockResolvedValueOnce({ok: true, json: async () => ({captureInterfaces: [{name: 'a'}], lanAddresses: ['192.168.1.5'], status: 'running'})});

        const h = new NetworkSettingsHandler(container);
        await h.load();

        const rows = container.querySelectorAll('[data-iface]');
        expect(rows.length).toBe(2);
        const wifiRow = container.querySelector('[data-iface="a"]');
        expect(wifiRow.textContent).toContain('Wi-Fi');
        expect(wifiRow.querySelector('input[type="checkbox"]').checked).toBe(true);
    });

    test('apply submits diff to backend', async () => {
        global.fetch
            .mockResolvedValueOnce({ok: true, json: async () => ([
                {name: 'a', description: 'Wi-Fi', address: '1', category: 'wifi', isPersisted: true, isAvailable: true},
                {name: 'b', description: 'Eth', address: '2', category: 'ethernet', isPersisted: false, isAvailable: true},
            ])})
            .mockResolvedValueOnce({ok: true, json: async () => ({captureInterfaces: [{name: 'a'}], lanAddresses: [], status: 'running'})})
            .mockResolvedValueOnce({ok: true, json: async () => ({status: 'ok'})});

        const h = new NetworkSettingsHandler(container);
        await h.load();
        // Tick the second checkbox
        container.querySelector('[data-iface="b"] input').click();
        await h.apply();

        const post = global.fetch.mock.calls.find(c => c[0] === '/api/network/interfaces' && c[1]?.method === 'POST');
        expect(post).toBeDefined();
        const body = JSON.parse(post[1].body);
        expect(body.names.sort()).toEqual(['a', 'b']);
    });

    test('renders LAN addresses as clickable URLs', async () => {
        global.fetch
            .mockResolvedValueOnce({ok: true, json: async () => []})
            .mockResolvedValueOnce({ok: true, json: async () => ({captureInterfaces: [], lanAddresses: ['192.168.1.5', '10.0.0.3'], status: 'awaiting_interfaces'})});

        const h = new NetworkSettingsHandler(container);
        await h.load();
        const links = container.querySelectorAll('[data-lan-url]');
        expect(links.length).toBe(2);
        expect(links[0].href).toContain('192.168.1.5');
    });
});
```

- [ ] **Step 2: Run, verify failing**

```bash
npx vitest run web/scripts/handlers/_NetworkSettingsHandler.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `NetworkSettingsHandler.js`**

Create `web/scripts/handlers/NetworkSettingsHandler.js`:

```javascript
const BADGES = {
    wifi: '🛜', ethernet: '🔌', exitlag: '🚀', vpn: '🔒', virtual: '🧪', other: '•',
};
const BADGE_LABEL = {
    wifi: 'WiFi', ethernet: 'Ethernet', exitlag: 'ExitLag', vpn: 'VPN', virtual: 'Virtual', other: 'Other',
};

export class NetworkSettingsHandler {
    constructor(container) {
        this.container = container;
        this.interfaces = [];
        this.state = null;
    }

    async load() {
        const [ifaces, state] = await Promise.all([
            fetch('/api/network/interfaces').then(r => r.json()),
            fetch('/api/network/state').then(r => r.json()),
        ]);
        this.interfaces = ifaces;
        this.state = state;
        this.render();
    }

    render() {
        const activeNames = new Set((this.state?.captureInterfaces || []).map(c => c.name));
        const banner = this.renderBanner();
        const rows = this.interfaces.map(i => this.renderRow(i, activeNames.has(i.name))).join('');
        const lan = (this.state?.lanAddresses || []).map(a =>
            `<li><a data-lan-url href="http://${a}:5001/" target="_blank">http://${a}:5001/</a></li>`
        ).join('');
        this.container.innerHTML = `
            ${banner}
            <h3 class="text-base font-semibold mt-2">Capture interfaces</h3>
            <p class="text-sm opacity-70 mb-2">Captured packets are merged across all checked interfaces. Tick at least one to start capture.</p>
            <div class="flex flex-col gap-1">${rows}</div>
            <div class="flex gap-2 mt-3">
                <button class="btn btn-sm" data-action="refresh">Refresh list</button>
                <button class="btn btn-sm btn-primary" data-action="apply" disabled>Apply changes</button>
            </div>
            <h3 class="text-base font-semibold mt-6">LAN access</h3>
            <p class="text-sm opacity-70">Reachable from devices on the same local network. Independent of the capture interfaces above.</p>
            <ul class="list-disc pl-5">${lan || '<li class="opacity-60">No LAN address detected.</li>'}</ul>
        `;
        this.bindEvents();
    }

    renderBanner() {
        if (this.state?.status === 'awaiting_interfaces') {
            return `<div class="alert alert-warning mb-2">⚠ Capture not running. Pick at least one interface below to start.</div>`;
        }
        const n = (this.state?.captureInterfaces || []).length;
        return `<div class="alert alert-success mb-2">✓ Capturing on ${n} interface${n > 1 ? 's' : ''}.</div>`;
    }

    renderRow(iface, checked) {
        const badge = BADGES[iface.category] || BADGES.other;
        const label = BADGE_LABEL[iface.category] || BADGE_LABEL.other;
        const unavail = iface.isAvailable ? '' : ' <span class="opacity-60">(unavailable)</span>';
        return `
            <label class="flex items-center gap-3 cursor-pointer" data-iface="${iface.name}">
                <input type="checkbox" class="checkbox checkbox-sm" ${checked ? 'checked' : ''} ${iface.isAvailable ? '' : 'disabled'}>
                <span class="badge badge-outline">${badge} ${label}</span>
                <span class="flex-1">${escapeHTML(iface.description || iface.name)}${unavail}</span>
                <span class="opacity-60 text-sm">${iface.address || ''}</span>
            </label>
        `;
    }

    bindEvents() {
        this.container.querySelectorAll('[data-iface] input').forEach(cb => {
            cb.addEventListener('change', () => this.updateApplyState());
        });
        const applyBtn = this.container.querySelector('[data-action="apply"]');
        applyBtn?.addEventListener('click', () => this.apply());
        const refreshBtn = this.container.querySelector('[data-action="refresh"]');
        refreshBtn?.addEventListener('click', () => this.refresh());
    }

    updateApplyState() {
        const selected = this.selectedNames();
        const current = (this.state?.captureInterfaces || []).map(c => c.name).sort();
        const same = JSON.stringify(selected.sort()) === JSON.stringify(current);
        const btn = this.container.querySelector('[data-action="apply"]');
        if (btn) btn.disabled = same;
    }

    selectedNames() {
        return Array.from(this.container.querySelectorAll('[data-iface] input:checked'))
            .map(cb => cb.closest('[data-iface]').dataset.iface);
    }

    async apply() {
        const names = this.selectedNames();
        const res = await fetch('/api/network/interfaces', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({names}),
        });
        if (!res.ok) {
            const txt = await res.text();
            window.toaster?.error?.(`Apply failed: ${txt}`);
            return;
        }
        window.toaster?.success?.('Capture interfaces updated.');
        await this.load();
    }

    async refresh() {
        const r = await fetch('/api/network/refresh', {method: 'POST'});
        if (r.ok) {
            this.interfaces = await r.json();
            this.render();
        }
    }
}

function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}
```

- [ ] **Step 4: Add the Network section to settings.gohtml**

Modify `internal/templates/pages/settings.gohtml` to add a new section:

```html
<div class="card bg-base-200 shadow mt-4">
    <div class="card-body">
        <h2 class="card-title">Network</h2>
        <div id="network-section">Loading network configuration…</div>
    </div>
</div>
```

And inside the existing `{{define "scripts/settings"}}` block, append:

```javascript
import('/scripts/handlers/NetworkSettingsHandler.js').then(({NetworkSettingsHandler}) => {
    const container = document.getElementById('network-section');
    if (container) {
        const h = new NetworkSettingsHandler(container);
        h.load();
        // Poll every 5s while the page is visible
        setInterval(() => { if (!document.hidden) h.load(); }, 5000);
    }
});
```

- [ ] **Step 5: Run vitest**

```bash
npx vitest run web/scripts/handlers/_NetworkSettingsHandler.test.js
```

Expected: PASS, 3 subtests green.

- [ ] **Step 6: Run full vitest suite to confirm no regression**

```bash
npx vitest run
```

Expected: PASS — all previous tests + the 3 new ones.

- [ ] **Step 7: Live-smoke the settings page**

```bash
go run ./cmd/radar -dev
```

Open `http://localhost:5001/settings`, scroll to the Network card. Verify:
- Interface checkboxes appear with badges.
- LAN access section lists at least one URL.
- Apply button enables only after a checkbox change.
- Toggling a checkbox + Apply shows a success toast.

Quit with Ctrl+C and verify clean shutdown.

- [ ] **Step 8: Commit**

```bash
git add web/scripts/handlers/NetworkSettingsHandler.js \
        web/scripts/handlers/_NetworkSettingsHandler.test.js \
        internal/templates/pages/settings.gohtml
git commit -m "feat(91): Network section on Settings page (multi-select capture)"
```

---

## Task 9: Final integration + lint + PR

- [ ] **Step 1: Run full test suite + lint**

```bash
npx vitest run
go test ./...
npm run lint
golangci-lint run ./...
```

Expected: all green.

- [ ] **Step 2: Manual smoke checklist**

Run the radar in dev mode and verify in order:

1. Cold start with no `network.json` and no `ip.txt`: auto-pick logs "Auto-selected N interface(s)…", radar captures.
2. Stop the radar, drop a `network.json` referencing a deliberately-wrong name (`{"captureInterfaces":[{"name":"\\Device\\NPF_{nope}","description":"x"}]}`), restart: TUI shows "Capture: (awaiting)", `/settings` Network section shows orange banner "⚠ Capture not running…".
3. Tick a real interface in `/settings`, Apply: toast success, TUI updates within 2s to show the interface, banner turns green.
4. From a phone on the LAN, open `http://<host-ip>:5001/settings`: Network section visible, checkboxes are interactable but the Apply button is hidden (replace by a yellow "Capture interfaces can only be changed from the host PC" notice).
5. POST to `/api/network/interfaces` from the phone via curl: 403.

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feat/91-dynamic-capture-interface
gh pr create --title "feat(#91): dynamic capture interface selection" --body "$(cat <<'EOF'
## Summary

Closes #91.

Replaces the IP-keyed `ip.txt` persistence + single-handle pcap with a multi-interface `Manager` keyed by stable `{name, description}`. Adds a "Network" section on `/settings` for runtime add/remove. Decouples capture interfaces from LAN serving addresses in the TUI/UI.

## Changes

- `MobsDatabase`-style migration of `ip.txt` to `network.json` on first boot.
- New `internal/capture/categorize.go` (regex-based, cross-platform Win/Linux).
- New `internal/capture/manager.go` (multi-handle lifecycle, strict open/close ordering).
- New `/api/network/{interfaces,state,refresh}` endpoints; POST is loopback-only.
- New `web/scripts/handlers/NetworkSettingsHandler.js` rendering checkboxes + LAN URLs.
- TUI displays "Capture:" and "LAN:" as separate lines.

## Known limitation: ExitLag NDIS LWF

ExitLag is an NDIS Lightweight Filter, not a virtual adapter. Multi-interface capture covers the cases where ExitLag re-routes traffic between physical interfaces (most common). If ExitLag's filter strips packets entirely from NPF's view (Case D in the spec), a follow-up issue at the WFP layer will be needed. The owner's 3-day free trial post-merge will validate which case applies; tracked in `docs/project/TODO.md`.

## Test plan

- [x] `go test ./...` green
- [x] `npx vitest run` green
- [x] `golangci-lint run ./...` clean
- [x] `npm run lint` clean
- [ ] Manual smoke (5 scenarios listed in the implementation plan)
- [ ] ExitLag free-trial smoke (post-merge)

EOF
)" --label bug --label enhancement
```

- [ ] **Step 4: Final verification**

```bash
gh pr view --web
```

Confirm the PR description is well-formed, labels applied, files-changed tab matches the spec.

---

## Out of scope (deferred)

- Header/topbar selector (option B from brainstorm).
- N3 auto-detect via traffic sniff at boot.
- QR code for LAN URL.
- Authentication on the API.
- WFP-level capture for ExitLag Case D.
