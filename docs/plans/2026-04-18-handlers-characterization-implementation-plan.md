# Handlers Characterization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a retroactive safety net of Vitest tests covering the 7 detection handlers plus `EventRouter`, driven by fixtures extracted from a real 25-minute Photon capture, so that subsequent bug-fix plans can land on a green regression base.

**Architecture:** Two new Go tools (`tools/anonymize-pcap` extension, `tools/photon-dump` binary) turn a local `capture.pcap` into two committed corpora: per-scenario `.pcap` fragments under `internal/photon/testdata/` and per-scenario WS-level JSON under `web/scripts/__fixtures__/ws/`. Handler tests consume the JSON corpus, assert observable state via inline `vi.fn()` stubs, and carry explicit confidence labels (`@verified` / `@characterization` / `@suspect`) per Rule 10 of `CLAUDE.md`.

**Tech Stack:** Go 1.26 with `gopacket/pcapgo`, `testify/require`. Vitest 4.x with happy-dom 20.x, co-located `.test.js`. Branch `feat/handlers-characterization` cut from up-to-date `main`.

**Source of truth:** `docs/plans/2026-04-18-handlers-characterization-design.md` (the design this plan implements).

---

## File Structure

| File / directory | Responsibility |
|---|---|
| `.gitignore` | Add `capture.pcap`, `capture.anon.pcap` to protect raw and anonymized full-session captures. |
| `tools/anonymize-pcap/main.go` | Extended with `--scrub-string` flag (repeatable). |
| `tools/anonymize-pcap/main_test.go` | New. Byte-replacement + pcap integrity unit tests. |
| `tools/photon-dump/main.go` | New. CLI entry, flag parsing, pipeline orchestration. |
| `tools/photon-dump/scenarios.go` | New. `Scenario` type and the declarative scenario list. |
| `tools/photon-dump/extract.go` | New. Matching and extraction logic. |
| `tools/photon-dump/inventory.go` | New. `--inventory` mode decoding plus census writer. |
| `tools/photon-dump/writer_pcap.go` | New. Per-scenario pcap fragment writer using `pcapgo`. |
| `tools/photon-dump/writer_json.go` | New. WS-level JSON writer aligned with `EventRouter.test.js` format. |
| `tools/photon-dump/*_test.go` | New. Unit tests on synthetic mini-pcaps for match + extract + write. |
| `internal/photon/testdata/<handler>/<scenario>.pcap` | New. Small anonymized pcap fragments, one per scenario. Committed. |
| `web/scripts/__fixtures__/ws/<handler>/<scenario>.json` | New. WS-level JSON consumed by Vitest tests. Committed. |
| `web/scripts/__fixtures__/ws/README.md` | New. Fixture format reference for contributors. |
| `web/scripts/handlers/<Handler>.test.js` | New. One Vitest file per handler, co-located. |
| `web/scripts/core/EventRouter.test.js` | Extended. Added dispatch cases from the design scope. |
| `docs/technical/PROTOCOL18_OBSERVED_CODES.md` | New. `--inventory` census output, contributes to closing issue #54. |
| `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` | New. Living progress doc (scenario counter, decisions). |
| `docs/project/IMPROVEMENTS.md` | Appended. Every `@suspect` gets a cross-link entry. |
| `docs/plans/notes/2026-04-18-handlers-characterization-completion.md` | New at the end. Completion note: counts, surprises, handoff cross-links. |

---

## Execution Workflow

Every code change follows RED, GREEN, REFACTOR (Rule 8). Every handler test carries a confidence label (Rule 10). Every commit has a single intent (Rule 4). Hot-spot files (`HarvestablesHandler.js`, `MobsHandler.js`, `PlayersHandler.js`, `EventRouter.js`) are read in full before editing (Rule 3). No `Co-Authored-By: Claude` trailer in any commit, ever.

On any failing characterization test, apply the stop-and-discuss protocol: present three hypotheses (H1 intent wrong, H2 fixture wrong, H3 code bug) with evidence, wait for user decision, then label `@verified` / `@characterization` / `@suspect` and proceed. If `@suspect`, append an entry to `docs/project/IMPROVEMENTS.md` with cross-link.

Checkpoints (user go/no-go): CP1 after Task 7, CP2 after Task 9, CP3 after Task 10, CP4 after Task 11, CP5 after Task 13, CP6 after Task 15, CP7 after Task 16.

---

## Task 1: Protect local full-session captures

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append pcap rules to .gitignore**

Add at the end of `.gitignore`:

```
# Local full-session Photon captures (never committed, always anonymized then split)
capture.pcap
capture.anon.pcap
```

- [ ] **Step 2: Verify status**

Run: `git status --short`
Expected: `capture.pcap` no longer shown under untracked; only `mise.toml` remains in untracked.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore(gitignore): ignore full-session capture.pcap and anonymized twin"
```

---

## Task 2: anonymize-pcap scrub-string flag, red

**Files:**
- Create: `tools/anonymize-pcap/main_test.go`

- [ ] **Step 1: Write the failing test**

```go
package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/stretchr/testify/require"
)

func writeFixturePcap(t *testing.T, path string, payloads [][]byte) {
	t.Helper()
	f, err := os.Create(path)
	require.NoError(t, err)
	defer f.Close()
	w := pcapgo.NewWriter(f)
	require.NoError(t, w.WriteFileHeader(1600, layers.LinkTypeEthernet))

	for i, payload := range payloads {
		eth := &layers.Ethernet{
			SrcMAC:       []byte{0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0x01},
			DstMAC:       []byte{0xbb, 0xbb, 0xbb, 0xbb, 0xbb, 0x02},
			EthernetType: layers.EthernetTypeIPv4,
		}
		ip := &layers.IPv4{
			Version: 4, IHL: 5, TTL: 64, Protocol: layers.IPProtocolUDP,
			SrcIP: []byte{192, 168, 0, 10}, DstIP: []byte{5, 188, 125, 1},
		}
		udp := &layers.UDP{SrcPort: 50000, DstPort: 5056}
		require.NoError(t, udp.SetNetworkLayerForChecksum(ip))

		buf := gopacket.NewSerializeBuffer()
		opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: true}
		require.NoError(t, gopacket.SerializeLayers(buf, opts, eth, ip, udp, gopacket.Payload(payload)))

		require.NoError(t, w.WritePacket(gopacket.CaptureInfo{
			Timestamp:     time.Unix(int64(i), 0),
			CaptureLength: len(buf.Bytes()),
			Length:        len(buf.Bytes()),
		}, buf.Bytes()))
	}
}

func readPayloads(t *testing.T, path string) [][]byte {
	t.Helper()
	f, err := os.Open(path)
	require.NoError(t, err)
	defer f.Close()
	r, err := pcapgo.NewReader(f)
	require.NoError(t, err)

	var out [][]byte
	for {
		data, _, err := r.ReadPacketData()
		if err != nil {
			break
		}
		pkt := gopacket.NewPacket(data, r.LinkType(), gopacket.Default)
		udp, _ := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP)
		require.NotNil(t, udp)
		out = append(out, append([]byte(nil), udp.Payload...))
	}
	return out
}

func TestScrubString_ReplacesAsciiNameWithSameLengthPadding(t *testing.T) {
	dir := t.TempDir()
	in := filepath.Join(dir, "in.pcap")
	out := filepath.Join(dir, "out.pcap")

	writeFixturePcap(t, in, [][]byte{
		[]byte("hello Bob goodbye"),
		[]byte("unrelated"),
	})

	err := runWithOptions(in, out, []string{"Bob"})
	require.NoError(t, err)

	payloads := readPayloads(t, out)
	require.Len(t, payloads, 2)
	require.True(t, bytes.Contains(payloads[0], []byte("hello XXX goodbye")))
	require.False(t, bytes.Contains(payloads[0], []byte("Bob")))
	require.Equal(t, []byte("unrelated"), payloads[1])
}

func TestScrubString_EmptyListIsNoOpOnPayload(t *testing.T) {
	dir := t.TempDir()
	in := filepath.Join(dir, "in.pcap")
	out := filepath.Join(dir, "out.pcap")

	writeFixturePcap(t, in, [][]byte{[]byte("hello Bob goodbye")})

	err := runWithOptions(in, out, nil)
	require.NoError(t, err)

	payloads := readPayloads(t, out)
	require.Len(t, payloads, 1)
	require.Equal(t, []byte("hello Bob goodbye"), payloads[0])
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./tools/anonymize-pcap/... -run TestScrubString -v`
Expected: FAIL with `undefined: runWithOptions`.

---

## Task 3: anonymize-pcap scrub-string flag, green

**Files:**
- Modify: `tools/anonymize-pcap/main.go`

- [ ] **Step 1: Refactor main.go to expose runWithOptions and parse --scrub-string**

Replace the top of the file with:

```go
// Rewrite MACs/IPs/timestamps in a pcap, preserve UDP payloads.
// Optional --scrub-string <value> (repeatable): ASCII byte-level replacement
// with same-length 'X' padding inside UDP payloads. Use to remove the local
// player name before committing anonymized fragments.
//
// Usage:
//   go run ./tools/anonymize-pcap <input.pcap> <output.pcap> [--scrub-string name]...
package main

import (
	"bytes"
	"flag"
	"fmt"
	"net"
	"os"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
)

type stringList []string

func (s *stringList) String() string     { return fmt.Sprintf("%v", []string(*s)) }
func (s *stringList) Set(v string) error { *s = append(*s, v); return nil }

func main() {
	var scrub stringList
	fs := flag.NewFlagSet("anonymize-pcap", flag.ExitOnError)
	fs.Var(&scrub, "scrub-string", "ASCII string to replace in UDP payloads with same-length 'X' padding (repeatable)")
	if err := fs.Parse(os.Args[1:]); err != nil {
		os.Exit(2)
	}
	if fs.NArg() != 2 {
		fmt.Fprintln(os.Stderr, "usage: anonymize-pcap <input.pcap> <output.pcap> [--scrub-string name]...")
		os.Exit(2)
	}
	if err := runWithOptions(fs.Arg(0), fs.Arg(1), scrub); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
```

Rename the existing `run(in, out string)` to `runWithOptions(in, out string, scrubs []string) error` and, inside the per-packet loop right after `udp.SetNetworkLayerForChecksum`, apply:

```go
		if len(scrubs) > 0 {
			newPayload := scrubPayload(udp.Payload, scrubs)
			udp.Payload = newPayload
		}
```

Add at the bottom of the file:

```go
func scrubPayload(payload []byte, needles []string) []byte {
	if len(needles) == 0 {
		return payload
	}
	out := append([]byte(nil), payload...)
	for _, n := range needles {
		if n == "" {
			continue
		}
		pad := bytes.Repeat([]byte{'X'}, len(n))
		out = bytes.ReplaceAll(out, []byte(n), pad)
	}
	return out
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `go test ./tools/anonymize-pcap/... -v`
Expected: `PASS` on both `TestScrubString_ReplacesAsciiNameWithSameLengthPadding` and `TestScrubString_EmptyListIsNoOpOnPayload`.

- [ ] **Step 3: Commit**

```bash
git add tools/anonymize-pcap/
git commit -m "feat(anonymize-pcap): add --scrub-string flag for local player name scrubbing"
```

---

## Task 4: photon-dump scaffolding

**Files:**
- Create: `tools/photon-dump/main.go`
- Create: `tools/photon-dump/scenarios.go`

- [ ] **Step 1: Write a minimal scaffold that compiles and exposes the flag surface**

`tools/photon-dump/main.go`:

```go
// photon-dump extracts per-scenario fixtures from an anonymized Photon pcap.
//
// Produces two corpora:
//   internal/photon/testdata/<handler>/<scenario>.pcap  (small anonymized pcap fragments)
//   web/scripts/__fixtures__/ws/<handler>/<scenario>.json  (WS-level JSON for Vitest)
//
// Usage:
//   photon-dump -in capture.anon.pcap -out-go internal/photon/testdata -out-js web/scripts/__fixtures__/ws
//   photon-dump -in capture.anon.pcap -inventory docs/technical/PROTOCOL18_OBSERVED_CODES.md
package main

import (
	"flag"
	"fmt"
	"os"
)

func main() {
	var (
		in        = flag.String("in", "", "input anonymized pcap")
		outGo     = flag.String("out-go", "", "output dir for .pcap fragments")
		outJS     = flag.String("out-js", "", "output dir for .json WS-level fixtures")
		inventory = flag.String("inventory", "", "if set, write census markdown to this path and skip extraction")
	)
	flag.Parse()

	if *in == "" {
		fmt.Fprintln(os.Stderr, "photon-dump: -in is required")
		os.Exit(2)
	}

	if *inventory != "" {
		if err := runInventory(*in, *inventory); err != nil {
			fmt.Fprintln(os.Stderr, "inventory:", err)
			os.Exit(1)
		}
		return
	}

	if *outGo == "" || *outJS == "" {
		fmt.Fprintln(os.Stderr, "photon-dump: -out-go and -out-js are required when not running -inventory")
		os.Exit(2)
	}

	if err := runExtract(*in, *outGo, *outJS, scenarios); err != nil {
		fmt.Fprintln(os.Stderr, "extract:", err)
		os.Exit(1)
	}
}
```

`tools/photon-dump/scenarios.go`:

```go
package main

// MatchCriteria selects a decoded Photon message by kind, opcode, and optional
// parameter predicates. All fields are AND-ed. nil map = wildcard.
type MatchCriteria struct {
	Kind     string                       // "event" | "request" | "response"
	Code     int                          // event code (252) / op code (253)
	Where    map[byte]func(v any) bool    // optional per-parameter filter
}

// Scenario declares a single fixture extraction target.
type Scenario struct {
	Name        string          // "players/passive-player-spawn"
	Handler     string          // "players"
	Match       MatchCriteria   // primary trigger
	FollowUps   []MatchCriteria // optional, in order, on the same correlation key
	CorrelateBy byte            // parameter key to follow entity across packets (e.g. 0 for id)
	Limit       int             // max matches for this scenario (0 = 1)
}

// scenarios is populated progressively during Task 8 (extraction wiring);
// Task 4 only needs the declaration to compile.
var scenarios []Scenario
```

- [ ] **Step 2: Add stubs for the two run functions so main compiles**

Create `tools/photon-dump/extract.go`:

```go
package main

import "errors"

func runExtract(in, outGo, outJS string, scenarios []Scenario) error {
	return errors.New("runExtract: not implemented yet (see Task 7)")
}
```

Create `tools/photon-dump/inventory.go`:

```go
package main

import "errors"

func runInventory(in, outPath string) error {
	return errors.New("runInventory: not implemented yet (see Task 6)")
}
```

- [ ] **Step 3: Verify it compiles**

Run: `go build ./tools/photon-dump/...`
Expected: exit 0, no output.

- [ ] **Step 4: Verify help surface**

Run: `go run ./tools/photon-dump -h`
Expected: exit 2 (flag default for unknown `-h`), or the usage banner. Either is acceptable, we only check the binary launches.

- [ ] **Step 5: Commit**

```bash
git add tools/photon-dump/
git commit -m "feat(tools/photon-dump): scaffold binary, flag surface, scenario type"
```

---

## Task 5: photon-dump pcap iteration, red

**Files:**
- Create: `tools/photon-dump/extract_test.go`

- [ ] **Step 1: Write a failing test that exercises pcap iteration**

```go
package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/stretchr/testify/require"
)

// writeMiniPcap emits N UDP packets with given payloads (port 5056 both ways).
func writeMiniPcap(t *testing.T, path string, payloads [][]byte) {
	t.Helper()
	f, err := os.Create(path)
	require.NoError(t, err)
	defer f.Close()
	w := pcapgo.NewWriter(f)
	require.NoError(t, w.WriteFileHeader(1600, layers.LinkTypeEthernet))
	for i, payload := range payloads {
		eth := &layers.Ethernet{
			SrcMAC: []byte{0xaa, 0, 0, 0, 0, 1}, DstMAC: []byte{0xbb, 0, 0, 0, 0, 2},
			EthernetType: layers.EthernetTypeIPv4,
		}
		ip := &layers.IPv4{Version: 4, IHL: 5, TTL: 64, Protocol: layers.IPProtocolUDP,
			SrcIP: []byte{10, 0, 0, 1}, DstIP: []byte{10, 0, 0, 2}}
		udp := &layers.UDP{SrcPort: 5056, DstPort: 50000}
		require.NoError(t, udp.SetNetworkLayerForChecksum(ip))
		buf := gopacket.NewSerializeBuffer()
		opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: true}
		require.NoError(t, gopacket.SerializeLayers(buf, opts, eth, ip, udp, gopacket.Payload(payload)))
		require.NoError(t, w.WritePacket(gopacket.CaptureInfo{
			Timestamp: time.Unix(int64(i), 0), CaptureLength: len(buf.Bytes()), Length: len(buf.Bytes()),
		}, buf.Bytes()))
	}
}

func TestIteratePcap_CountsUdpPayloads(t *testing.T) {
	dir := t.TempDir()
	in := filepath.Join(dir, "mini.pcap")
	writeMiniPcap(t, in, [][]byte{
		{0x01, 0x02},
		{0x03, 0x04, 0x05},
	})
	var got int
	err := iteratePcap(in, func(payload []byte) error { got++; return nil })
	require.NoError(t, err)
	require.Equal(t, 2, got)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./tools/photon-dump/... -run TestIteratePcap -v`
Expected: FAIL with `undefined: iteratePcap`.

---

## Task 6: photon-dump pcap iteration, green

**Files:**
- Modify: `tools/photon-dump/extract.go`

- [ ] **Step 1: Implement iteratePcap**

Replace the contents of `tools/photon-dump/extract.go` with:

```go
package main

import (
	"errors"
	"fmt"
	"os"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
)

// iteratePcap reads every packet in the pcap and invokes fn with the UDP payload.
// Non-UDP packets are skipped silently.
func iteratePcap(path string, fn func(payload []byte) error) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()
	r, err := pcapgo.NewReader(f)
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	for {
		data, _, err := r.ReadPacketData()
		if err != nil {
			break
		}
		pkt := gopacket.NewPacket(data, r.LinkType(), gopacket.Default)
		udp, _ := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP)
		if udp == nil {
			continue
		}
		if err := fn(udp.Payload); err != nil {
			return err
		}
	}
	return nil
}

func runExtract(in, outGo, outJS string, scenarios []Scenario) error {
	return errors.New("runExtract: scenario matching not implemented yet (see Task 8)")
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `go test ./tools/photon-dump/... -run TestIteratePcap -v`
Expected: `PASS: TestIteratePcap_CountsUdpPayloads`.

- [ ] **Step 3: Commit**

```bash
git add tools/photon-dump/
git commit -m "feat(tools/photon-dump): pcap UDP iteration helper"
```

---

## Task 7: photon-dump inventory mode

**Files:**
- Modify: `tools/photon-dump/inventory.go`
- Create: `tools/photon-dump/inventory_test.go`

- [ ] **Step 1: Write a failing test for the census decoder**

```go
package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nospy/albion-openradar/internal/photon"
	"github.com/stretchr/testify/require"
)

// encodeEventPacketForTest produces a single Photon reliable-command "event"
// with the given event code. Uses the existing internal/photon encoder if
// present; otherwise the helper stays close to the wire format shipped in
// PR #51. Test is skipped when encoder is unavailable.
func TestInventory_WritesCensusMarkdown(t *testing.T) {
	if _, err := os.Stat(filepath.Join("..", "..", "internal", "photon", "testdata", "generic_events.pcap")); err != nil {
		t.Skip("generic_events.pcap missing, run from repo root")
	}

	outDir := t.TempDir()
	outPath := filepath.Join(outDir, "census.md")

	err := runInventory(filepath.Join("..", "..", "internal", "photon", "testdata", "generic_events.pcap"), outPath)
	require.NoError(t, err)

	body, err := os.ReadFile(outPath)
	require.NoError(t, err)
	s := string(body)
	require.True(t, strings.Contains(s, "# Protocol18 Observed Codes"), "missing title")
	require.True(t, strings.Contains(s, "## Event codes"), "missing events section")
	require.True(t, strings.Contains(s, "## Operation requests"), "missing requests section")
	require.True(t, strings.Contains(s, "## Operation responses"), "missing responses section")

	// Ensure parser symbol is actually linked (guards against unused import if test is skipped via build tag)
	_ = photon.NewPhotonParser
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./tools/photon-dump/... -run TestInventory -v`
Expected: FAIL with `runInventory: not implemented yet`.

- [ ] **Step 3: Implement runInventory**

Replace `tools/photon-dump/inventory.go` with:

```go
package main

import (
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/nospy/albion-openradar/internal/photon"
)

func runInventory(in, outPath string) error {
	events := map[byte]int{}
	requests := map[byte]int{}
	responses := map[byte]int{}

	parser := photon.NewPhotonParser(
		func(e *photon.EventData) { events[e.Code]++ },
		func(r *photon.OperationRequest) { requests[r.OperationCode]++ },
		func(r *photon.OperationResponse) { responses[r.OperationCode]++ },
	)

	f, err := os.Open(in)
	if err != nil {
		return fmt.Errorf("open %s: %w", in, err)
	}
	defer f.Close()
	r, err := pcapgo.NewReader(f)
	if err != nil {
		return fmt.Errorf("read %s: %w", in, err)
	}
	for {
		data, _, err := r.ReadPacketData()
		if err != nil {
			break
		}
		pkt := gopacket.NewPacket(data, r.LinkType(), gopacket.Default)
		udp, _ := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP)
		if udp == nil {
			continue
		}
		_ = parser.Parse(udp.Payload)
	}

	var sb strings.Builder
	sb.WriteString("# Protocol18 Observed Codes\n\n")
	sb.WriteString("Generated by `tools/photon-dump --inventory`. One row per code, with count.\n\n")
	writeSection(&sb, "Event codes", events)
	writeSection(&sb, "Operation requests", requests)
	writeSection(&sb, "Operation responses", responses)

	return os.WriteFile(outPath, []byte(sb.String()), 0o644)
}

func writeSection(sb *strings.Builder, title string, m map[byte]int) {
	sb.WriteString("## " + title + "\n\n")
	sb.WriteString("| Code | Count |\n|---:|---:|\n")
	keys := make([]int, 0, len(m))
	for k := range m {
		keys = append(keys, int(k))
	}
	sort.Ints(keys)
	for _, k := range keys {
		sb.WriteString(fmt.Sprintf("| %d | %d |\n", k, m[byte(k)]))
	}
	sb.WriteString("\n")
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./tools/photon-dump/... -run TestInventory -v`
Expected: `PASS: TestInventory_WritesCensusMarkdown`.

- [ ] **Step 5: Commit**

```bash
git add tools/photon-dump/
git commit -m "feat(tools/photon-dump): --inventory mode, census markdown output"
```

---

## Task 8: Scenario matching core, red

**Files:**
- Create: `tools/photon-dump/matcher_test.go`

- [ ] **Step 1: Write a failing test for scenario matching on decoded events**

```go
package main

import (
	"testing"

	"github.com/nospy/albion-openradar/internal/photon"
	"github.com/stretchr/testify/require"
)

func TestMatchEvent_CodeOnly(t *testing.T) {
	s := Scenario{
		Name:    "x/y",
		Handler: "x",
		Match:   MatchCriteria{Kind: "event", Code: 27},
	}
	ev := &photon.EventData{Code: 27, Parameters: map[byte]any{0: int64(42)}}
	require.True(t, matchesEvent(s.Match, ev))
	require.False(t, matchesEvent(MatchCriteria{Kind: "event", Code: 99}, ev))
}

func TestMatchEvent_WithPredicate(t *testing.T) {
	m := MatchCriteria{
		Kind:  "event",
		Code:  27,
		Where: map[byte]func(v any) bool{
			0: func(v any) bool { return v == int64(42) },
		},
	}
	ok := &photon.EventData{Code: 27, Parameters: map[byte]any{0: int64(42)}}
	ko := &photon.EventData{Code: 27, Parameters: map[byte]any{0: int64(7)}}
	require.True(t, matchesEvent(m, ok))
	require.False(t, matchesEvent(m, ko))
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./tools/photon-dump/... -run TestMatchEvent -v`
Expected: FAIL with `undefined: matchesEvent`.

---

## Task 9: Scenario matching core, green

**Files:**
- Create: `tools/photon-dump/matcher.go`

- [ ] **Step 1: Implement matchesEvent, matchesRequest, matchesResponse**

```go
package main

import "github.com/nospy/albion-openradar/internal/photon"

func matchesEvent(m MatchCriteria, e *photon.EventData) bool {
	if m.Kind != "event" || int(e.Code) != m.Code {
		return false
	}
	return matchesWhere(m.Where, e.Parameters)
}

func matchesRequest(m MatchCriteria, r *photon.OperationRequest) bool {
	if m.Kind != "request" || int(r.OperationCode) != m.Code {
		return false
	}
	return matchesWhere(m.Where, r.Parameters)
}

func matchesResponse(m MatchCriteria, r *photon.OperationResponse) bool {
	if m.Kind != "response" || int(r.OperationCode) != m.Code {
		return false
	}
	return matchesWhere(m.Where, r.Parameters)
}

func matchesWhere(where map[byte]func(v any) bool, params map[byte]any) bool {
	for k, pred := range where {
		v, ok := params[k]
		if !ok || !pred(v) {
			return false
		}
	}
	return true
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `go test ./tools/photon-dump/... -run TestMatchEvent -v`
Expected: both tests `PASS`.

- [ ] **Step 3: Commit**

```bash
git add tools/photon-dump/
git commit -m "feat(tools/photon-dump): scenario matcher for events, requests, responses"
```

---

## Task 10: Per-scenario pcap fragment writer, red

**Files:**
- Create: `tools/photon-dump/writer_pcap_test.go`

- [ ] **Step 1: Write a failing test**

```go
package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/stretchr/testify/require"
)

func TestWritePcapFragment_RoundTrip(t *testing.T) {
	dir := t.TempDir()
	out := filepath.Join(dir, "sub", "frag.pcap")

	packets := [][]byte{
		append([]byte("hdr1-"), make([]byte, 40)...),
		append([]byte("hdr2-"), make([]byte, 40)...),
	}

	require.NoError(t, writePcapFragment(out, packets))

	f, err := os.Open(out)
	require.NoError(t, err)
	defer f.Close()
	r, err := pcapgo.NewReader(f)
	require.NoError(t, err)
	require.Equal(t, layers.LinkTypeEthernet, r.LinkType())

	var got int
	for {
		data, _, err := r.ReadPacketData()
		if err != nil {
			break
		}
		require.NotEmpty(t, data)
		_ = gopacket.NewPacket(data, r.LinkType(), gopacket.Default)
		got++
	}
	require.Equal(t, 2, got)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./tools/photon-dump/... -run TestWritePcapFragment -v`
Expected: FAIL with `undefined: writePcapFragment`.

---

## Task 11: Per-scenario pcap fragment writer, green

**Files:**
- Create: `tools/photon-dump/writer_pcap.go`

- [ ] **Step 1: Implement writePcapFragment**

```go
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
)

// writePcapFragment writes an isolated pcap containing the given raw packet
// bytes, each wrapped in a minimal Ethernet/IPv4/UDP frame. Creates parent dirs.
func writePcapFragment(path string, packets [][]byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create: %w", err)
	}
	defer f.Close()

	w := pcapgo.NewWriter(f)
	if err := w.WriteFileHeader(1600, layers.LinkTypeEthernet); err != nil {
		return err
	}
	for i, pkt := range packets {
		eth := &layers.Ethernet{
			SrcMAC: []byte{0x02, 0, 0, 0, 0, 0x01}, DstMAC: []byte{0x02, 0, 0, 0, 0, 0x02},
			EthernetType: layers.EthernetTypeIPv4,
		}
		ip := &layers.IPv4{Version: 4, IHL: 5, TTL: 64, Protocol: layers.IPProtocolUDP,
			SrcIP: []byte{10, 0, 0, 1}, DstIP: []byte{10, 0, 0, 2}}
		udp := &layers.UDP{SrcPort: 5056, DstPort: 50000}
		if err := udp.SetNetworkLayerForChecksum(ip); err != nil {
			return err
		}
		buf := gopacket.NewSerializeBuffer()
		opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: true}
		if err := gopacket.SerializeLayers(buf, opts, eth, ip, udp, gopacket.Payload(pkt)); err != nil {
			return err
		}
		if err := w.WritePacket(gopacket.CaptureInfo{
			Timestamp: time.Unix(int64(i), 0), CaptureLength: len(buf.Bytes()), Length: len(buf.Bytes()),
		}, buf.Bytes()); err != nil {
			return err
		}
	}
	return nil
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `go test ./tools/photon-dump/... -run TestWritePcapFragment -v`
Expected: `PASS: TestWritePcapFragment_RoundTrip`.

- [ ] **Step 3: Commit**

```bash
git add tools/photon-dump/
git commit -m "feat(tools/photon-dump): pcap fragment writer"
```

---

## Task 12: WS-level JSON fixture writer, red

**Files:**
- Create: `tools/photon-dump/writer_json_test.go`

- [ ] **Step 1: Write a failing test that asserts the format consumed by EventRouter.test.js**

The JSON schema matches what `EventRouter.js` dispatches (see `EventRouter.test.js`): an object with a top-level kind (`event`, `request`, `response`) and numeric-keyed parameters. We emit one file per scenario with an ordered array of messages.

```go
package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWriteJSONFixture_Shape(t *testing.T) {
	dir := t.TempDir()
	out := filepath.Join(dir, "sub", "fixture.json")

	messages := []FixtureMessage{
		{Kind: "event", Parameters: map[string]any{"0": float64(42), "252": float64(27)}},
		{Kind: "response", Parameters: map[string]any{"253": float64(2), "8": float64(1337)}},
	}
	require.NoError(t, writeJSONFixture(out, messages))

	body, err := os.ReadFile(out)
	require.NoError(t, err)

	var decoded struct {
		Messages []FixtureMessage `json:"messages"`
	}
	require.NoError(t, json.Unmarshal(body, &decoded))
	require.Len(t, decoded.Messages, 2)
	require.Equal(t, "event", decoded.Messages[0].Kind)
	require.Equal(t, float64(27), decoded.Messages[0].Parameters["252"])
	require.Equal(t, "response", decoded.Messages[1].Kind)
	require.Equal(t, float64(2), decoded.Messages[1].Parameters["253"])
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./tools/photon-dump/... -run TestWriteJSONFixture -v`
Expected: FAIL with `undefined: FixtureMessage` and `undefined: writeJSONFixture`.

---

## Task 13: WS-level JSON fixture writer, green

**Files:**
- Create: `tools/photon-dump/writer_json.go`
- Create: `web/scripts/__fixtures__/ws/README.md`

- [ ] **Step 1: Implement writeJSONFixture**

```go
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// FixtureMessage is one WS-level Photon message as consumed by EventRouter.
// Kind maps directly to EventRouter.onEvent/onRequest/onResponse dispatch.
// Parameters uses string keys for JSON stability; tests convert as needed.
type FixtureMessage struct {
	Kind       string         `json:"kind"`
	Parameters map[string]any `json:"parameters"`
	ReturnCode int16          `json:"returnCode,omitempty"`
}

type fixtureFile struct {
	Scenario string           `json:"scenario"`
	Handler  string           `json:"handler"`
	Messages []FixtureMessage `json:"messages"`
}

func writeJSONFixture(path string, messages []FixtureMessage) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}
	body, err := json.MarshalIndent(fixtureFile{
		Scenario: filepath.Base(path),
		Handler:  filepath.Base(filepath.Dir(path)),
		Messages: messages,
	}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, body, 0o644)
}
```

- [ ] **Step 2: Document the fixture format**

Create `web/scripts/__fixtures__/ws/README.md`:

```markdown
# WS-level Photon fixtures

One JSON file per handler scenario, consumed by Vitest tests under
`web/scripts/handlers/*.test.js`.

## Schema

```json
{
  "scenario": "<file name>",
  "handler": "<handler key>",
  "messages": [
    { "kind": "event",    "parameters": { "252": 27, "0": 12345, ... } },
    { "kind": "request",  "parameters": { "253": 22, "1": [10.5, 20.5] } },
    { "kind": "response", "parameters": { "253": 2, "8": 1337 }, "returnCode": 0 }
  ]
}
```

- `kind` maps to `EventRouter.onEvent | onRequest | onResponse` dispatch.
- `parameters` keys are decimal strings to survive JSON; tests coerce keys to
  numeric before feeding the router / handler.
- `returnCode` is optional and only meaningful for responses.

## Generation

Fixtures are produced by `tools/photon-dump`. Hand-written fixtures carry a
`synthetic` marker in the consuming test header comment; extracted fixtures
carry `pcap-derived <fragment-path>`.
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `go test ./tools/photon-dump/... -run TestWriteJSONFixture -v`
Expected: `PASS: TestWriteJSONFixture_Shape`.

- [ ] **Step 4: Commit**

```bash
git add tools/photon-dump/ web/scripts/__fixtures__/
git commit -m "feat(tools/photon-dump): WS-level JSON fixture writer and schema doc"
```

---

## Task 14: runExtract wiring, red

**Files:**
- Create: `tools/photon-dump/extract_wiring_test.go`

- [ ] **Step 1: Write a failing integration test on a mini-pcap**

This test declares a synthetic scenario, hands a small fabricated pcap to `runExtract`, and asserts both a pcap fragment and a JSON fixture are written.

```go
package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// This test uses the existing internal/photon/testdata/generic_events.pcap
// to exercise the full pipeline on real decoded messages rather than
// hand-crafting Photon packet bytes. Scenario: "events/generic-probe" matches
// whichever event code appears first in that fixture.
func TestRunExtract_ProducesBothArtifacts(t *testing.T) {
	root := filepath.Join("..", "..")
	in := filepath.Join(root, "internal", "photon", "testdata", "generic_events.pcap")
	if _, err := os.Stat(in); err != nil {
		t.Skip("generic_events.pcap missing, run from repo root")
	}

	outGo := t.TempDir()
	outJS := t.TempDir()

	local := []Scenario{{
		Name:    "events/generic-probe",
		Handler: "events",
		Match:   MatchCriteria{Kind: "event", Code: -1},
	}}

	err := runExtract(in, outGo, outJS, local)
	require.NoError(t, err)

	_, err = os.Stat(filepath.Join(outGo, "events", "generic-probe.pcap"))
	require.NoError(t, err, "pcap fragment not written")
	_, err = os.Stat(filepath.Join(outJS, "events", "generic-probe.json"))
	require.NoError(t, err, "json fixture not written")
}
```

Note: `Code: -1` is a sentinel meaning "first event of any code". The wiring in Task 15 handles that semantics.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./tools/photon-dump/... -run TestRunExtract -v`
Expected: FAIL with `runExtract: scenario matching not implemented yet`.

---

## Task 15: runExtract wiring, green

**Files:**
- Modify: `tools/photon-dump/extract.go`

- [ ] **Step 1: Replace runExtract with the real pipeline**

```go
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/nospy/albion-openradar/internal/photon"
)

// runExtract iterates the anonymized pcap, matches each decoded message
// against the scenario list, and writes per-scenario pcap + JSON artifacts.
// A scenario matches at most once unless Scenario.Limit > 1.
func runExtract(in, outGo, outJS string, scenarios []Scenario) error {
	type hit struct {
		raw     []byte
		message FixtureMessage
	}

	captured := make(map[string][]hit)
	counts := make(map[string]int)

	limitFor := func(s Scenario) int {
		if s.Limit > 0 {
			return s.Limit
		}
		return 1
	}

	// Buffer raw packet bytes so we can write the exact payload that produced
	// each match. We keep a single shared trailing slice indexed by a running
	// sequence.
	var rawStream [][]byte

	parser := photon.NewPhotonParser(
		func(e *photon.EventData) {
			idx := len(rawStream) - 1
			if idx < 0 {
				return
			}
			for _, s := range scenarios {
				if s.Match.Kind != "event" {
					continue
				}
				if s.Match.Code != -1 && int(e.Code) != s.Match.Code {
					continue
				}
				if s.Match.Code != -1 && !matchesEvent(s.Match, e) {
					continue
				}
				if counts[s.Name] >= limitFor(s) {
					continue
				}
				captured[s.Name] = append(captured[s.Name], hit{
					raw:     rawStream[idx],
					message: FixtureMessage{Kind: "event", Parameters: stringifyParams(e.Parameters)},
				})
				counts[s.Name]++
			}
		},
		func(r *photon.OperationRequest) {
			idx := len(rawStream) - 1
			if idx < 0 {
				return
			}
			for _, s := range scenarios {
				if s.Match.Kind != "request" || !matchesRequest(s.Match, r) {
					continue
				}
				if counts[s.Name] >= limitFor(s) {
					continue
				}
				captured[s.Name] = append(captured[s.Name], hit{
					raw:     rawStream[idx],
					message: FixtureMessage{Kind: "request", Parameters: stringifyParams(r.Parameters)},
				})
				counts[s.Name]++
			}
		},
		func(r *photon.OperationResponse) {
			idx := len(rawStream) - 1
			if idx < 0 {
				return
			}
			for _, s := range scenarios {
				if s.Match.Kind != "response" || !matchesResponse(s.Match, r) {
					continue
				}
				if counts[s.Name] >= limitFor(s) {
					continue
				}
				captured[s.Name] = append(captured[s.Name], hit{
					raw:     rawStream[idx],
					message: FixtureMessage{Kind: "response", Parameters: stringifyParams(r.Parameters), ReturnCode: r.ReturnCode},
				})
				counts[s.Name]++
			}
		},
	)

	f, err := os.Open(in)
	if err != nil {
		return fmt.Errorf("open %s: %w", in, err)
	}
	defer f.Close()
	r, err := pcapgo.NewReader(f)
	if err != nil {
		return fmt.Errorf("read %s: %w", in, err)
	}
	for {
		data, _, err := r.ReadPacketData()
		if err != nil {
			break
		}
		pkt := gopacket.NewPacket(data, r.LinkType(), gopacket.Default)
		udp, _ := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP)
		if udp == nil {
			continue
		}
		rawStream = append(rawStream, append([]byte(nil), udp.Payload...))
		_ = parser.Parse(udp.Payload)
	}

	for _, s := range scenarios {
		hits := captured[s.Name]
		if len(hits) == 0 {
			continue
		}
		pcapPath := filepath.Join(outGo, s.Handler, filepath.Base(s.Name)+".pcap")
		jsonPath := filepath.Join(outJS, s.Handler, filepath.Base(s.Name)+".json")

		rawPackets := make([][]byte, len(hits))
		msgs := make([]FixtureMessage, len(hits))
		for i, h := range hits {
			rawPackets[i] = h.raw
			msgs[i] = h.message
		}
		if err := writePcapFragment(pcapPath, rawPackets); err != nil {
			return fmt.Errorf("%s: %w", s.Name, err)
		}
		if err := writeJSONFixture(jsonPath, msgs); err != nil {
			return fmt.Errorf("%s: %w", s.Name, err)
		}
	}

	return nil
}

func stringifyParams(params map[byte]any) map[string]any {
	out := make(map[string]any, len(params))
	for k, v := range params {
		out[fmt.Sprintf("%d", k)] = v
	}
	return out
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `go test ./tools/photon-dump/... -v`
Expected: every test in the package `PASS`, including `TestRunExtract_ProducesBothArtifacts`.

- [ ] **Step 3: Commit**

```bash
git add tools/photon-dump/
git commit -m "feat(tools/photon-dump): runExtract pipeline, pcap + JSON per scenario"
```

---

## Task 16: Declare the scenario catalog

**Files:**
- Modify: `tools/photon-dump/scenarios.go`

- [ ] **Step 1: Populate the scenarios slice with the design targets**

Replace the tail of `scenarios.go` with (keep the type definitions from Task 4):

```go
// EventCodes copied here as literals with justification (Rule 11). Every
// literal below is grounded in web/scripts/utils/EventCodes.js, PR #51
// decoded fixtures, and the cross-reference in docs/claude-resources/data-flow-details.md.
const (
	evtNewCharacter        = 27  // web/scripts/utils/EventCodes.js : NewCharacter
	evtCharacterEquipment  = 76  // PlayersHandler.updateItems
	evtMoveRequest         = 22  // opRequest opMove post Protocol18 (was 21)
	evtNewHarvestableList  = 38  // batch harvestables
	evtNewHarvestable      = 40  // single harvestable
	evtHarvestUpdate       = 46  // size/enchant update
	evtHarvestFinished     = 61  // single finished
	evtNewMob              = 25  // mob spawn
	evtMobChangeState      = 95  // mob faction/hostility transition (pending #53 enum)
	evtNewDungeon          = 51  // dungeon spawn (@suspect code, verify at CP1)
	evtNewChest            = 86  // chest spawn (@suspect code, verify at CP1)
	evtNewFishing          = 217 // fishing spawn (@suspect code, verify at CP1)
	evtNewWispCage         = 268 // wisp cage spawn (@suspect code, verify at CP1)
	opJoinMap              = 2   // opResponse JoinMap
	opChangeCluster        = 41  // opResponse ChangeCluster
	opJoinFinished         = 39  // opResponse JoinFinished (contains isBZ hashtable)
)

var scenarios = []Scenario{
	// Players
	{Name: "players/passive-spawn", Handler: "players", Match: MatchCriteria{Kind: "event", Code: evtNewCharacter}, Limit: 5},
	{Name: "players/equipment-update", Handler: "players", Match: MatchCriteria{Kind: "event", Code: evtCharacterEquipment}, Limit: 3},

	// Harvestables
	{Name: "harvestables/batch-spawn", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtNewHarvestableList}, Limit: 3},
	{Name: "harvestables/single-spawn", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtNewHarvestable}, Limit: 20},
	{Name: "harvestables/update", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtHarvestUpdate}, Limit: 10},
	{Name: "harvestables/finished", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtHarvestFinished}, Limit: 5},

	// Mobs
	{Name: "mobs/spawn", Handler: "mobs", Match: MatchCriteria{Kind: "event", Code: evtNewMob}, Limit: 20},
	{Name: "mobs/change-state", Handler: "mobs", Match: MatchCriteria{Kind: "event", Code: evtMobChangeState}, Limit: 5},

	// Chests, Fishing, Dungeons, WispCage
	{Name: "chests/spawn", Handler: "chests", Match: MatchCriteria{Kind: "event", Code: evtNewChest}, Limit: 8},
	{Name: "fishing/spawn", Handler: "fishing", Match: MatchCriteria{Kind: "event", Code: evtNewFishing}, Limit: 5},
	{Name: "dungeons/spawn", Handler: "dungeons", Match: MatchCriteria{Kind: "event", Code: evtNewDungeon}, Limit: 10},
	{Name: "wispcage/spawn", Handler: "wispcage", Match: MatchCriteria{Kind: "event", Code: evtNewWispCage}, Limit: 3},

	// Router op-level
	{Name: "router/join-map", Handler: "router", Match: MatchCriteria{Kind: "response", Code: opJoinMap}, Limit: 2},
	{Name: "router/change-cluster", Handler: "router", Match: MatchCriteria{Kind: "response", Code: opChangeCluster}, Limit: 2},
	{Name: "router/join-finished", Handler: "router", Match: MatchCriteria{Kind: "response", Code: opJoinFinished}, Limit: 2},
	{Name: "router/move-request", Handler: "router", Match: MatchCriteria{Kind: "request", Code: evtMoveRequest}, Limit: 3},
}
```

Any code marked "verify at CP1" is an `@suspect` assumption. The inventory run at Task 17 settles those numbers before we ship extraction.

- [ ] **Step 2: Verify compile**

Run: `go build ./tools/photon-dump/...`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/photon-dump/
git commit -m "feat(tools/photon-dump): declarative scenario catalog"
```

---

## Task 17: CP1 inventory + scenario catalog ratification

**Files:**
- Create: `docs/technical/PROTOCOL18_OBSERVED_CODES.md`

- [ ] **Step 1: Anonymize the local capture**

```bash
go run ./tools/anonymize-pcap capture.pcap capture.anon.pcap --scrub-string "<local_player_name>"
```

Expected: `N packets read, N anonymized packets written to capture.anon.pcap`. Both source and output are gitignored.

- [ ] **Step 2: Run inventory**

```bash
go run ./tools/photon-dump -in capture.anon.pcap -inventory docs/technical/PROTOCOL18_OBSERVED_CODES.md
```

Expected: markdown file created, containing "## Event codes", "## Operation requests", "## Operation responses".

- [ ] **Step 3: Reconcile the catalog with the inventory**

Read `docs/technical/PROTOCOL18_OBSERVED_CODES.md`. For every `evt*` constant marked "verify at CP1" in Task 16, confirm the code appears with a non-zero count. If a code is wrong, replace it and rerun Step 2. If a code is absent from the capture, mark the corresponding scenario in `scenarios.go` with a comment `// UNOBSERVED in 2026-04-18 corpus, deferred to later capture` and remove it from the active scenario list.

- [ ] **Step 4: User checkpoint CP1**

Stop. Summarize for the user:
- Inventory counts per kind.
- Which scenario codes are verified vs unobserved.
- Any surprise code with a high count that deserves its own scenario.

Wait for user go/no-go before proceeding to Task 18.

- [ ] **Step 5: Commit**

```bash
git add docs/technical/PROTOCOL18_OBSERVED_CODES.md tools/photon-dump/scenarios.go
git commit -m "docs(technical): protocol18 observed code census; ratify scenario catalog"
```

---

## Task 18: Extract the fixture corpus

**Files:**
- New fixture files under `internal/photon/testdata/<handler>/*.pcap`
- New fixture files under `web/scripts/__fixtures__/ws/<handler>/*.json`

- [ ] **Step 1: Run extraction**

```bash
go run ./tools/photon-dump -in capture.anon.pcap -out-go internal/photon/testdata -out-js web/scripts/__fixtures__/ws
```

Expected: non-zero pcap fragments under `internal/photon/testdata/<handler>/` and JSON fixtures under `web/scripts/__fixtures__/ws/<handler>/` for every ratified scenario.

- [ ] **Step 2: Spot-check one fixture end-to-end**

Open `web/scripts/__fixtures__/ws/harvestables/single-spawn.json`. Confirm:
- Top-level keys `scenario`, `handler`, `messages`.
- `messages[0].kind === "event"`.
- `messages[0].parameters["252"] === 40`.
- Parameter payload has at least `"0"` (entity id), `"2"` (tier), `"4"` (charges).

If any of the three conditions fail, stop-and-discuss with the user before adding more fixtures.

- [ ] **Step 3: Verify Go tests still green with new testdata**

```bash
go test ./internal/photon/...
```

Expected: `ok github.com/nospy/albion-openradar/internal/photon`. If any existing test breaks on the new testdata directory layout, the fix is to scope the existing tests to the root-level fixtures only, not to descend into subdirectories.

- [ ] **Step 4: Commit**

```bash
git add internal/photon/testdata/ web/scripts/__fixtures__/ws/
git commit -m "test(fixtures): extract per-scenario pcap+json corpus from 25-min session"
```

---

## Task 19: Fixture loader helper, red

**Files:**
- Create: `web/scripts/__fixtures__/loader.js`
- Create: `web/scripts/__fixtures__/loader.test.js`

- [ ] **Step 1: Write a failing test for the loader**

```js
import {describe, test, expect} from 'vitest';
import {loadFixture, normalizeParams} from './loader.js';

describe('fixture loader', () => {
    test('loadFixture reads a JSON fixture and returns its messages', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        expect(fx.handler).toBe('harvestables');
        expect(Array.isArray(fx.messages)).toBe(true);
        expect(fx.messages.length).toBeGreaterThan(0);
    });

    test('normalizeParams coerces string keys to numeric', () => {
        const out = normalizeParams({'0': 42, '252': 40});
        expect(out[0]).toBe(42);
        expect(out[252]).toBe(40);
        expect(Object.keys(out).every(k => Number.isInteger(Number(k)))).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/scripts/__fixtures__/loader.test.js`
Expected: FAIL with module not found.

---

## Task 20: Fixture loader helper, green

**Files:**
- Create: `web/scripts/__fixtures__/loader.js`

- [ ] **Step 1: Implement the loader**

```js
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export async function loadFixture(handler, scenario) {
    const path = join(here, 'ws', handler, `${scenario}.json`);
    const body = await readFile(path, 'utf8');
    return JSON.parse(body);
}

export function normalizeParams(stringKeyed) {
    const out = {};
    for (const [k, v] of Object.entries(stringKeyed)) {
        out[Number(k)] = v;
    }
    return out;
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run web/scripts/__fixtures__/loader.test.js`
Expected: `2 passed`.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/__fixtures__/
git commit -m "test(fixtures): add JS fixture loader and normalizeParams helper"
```

---

## Task 21: Scenario counter skeleton

**Files:**
- Create: `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`

- [ ] **Step 1: Seed the living coverage document**

```markdown
# Handlers Characterization Coverage

Living counter. Updated on every test commit. Archived at plan completion.

## Distribution target

| Label | Target share |
|---|---|
| `@verified` | 70-80% |
| `@characterization` | 15-20% |
| `@suspect` | 5-10% |

## Counts per handler

| Handler | `@verified` | `@characterization` | `@suspect` | Total |
|---|---:|---:|---:|---:|
| PlayersHandler | 0 | 0 | 0 | 0 |
| HarvestablesHandler | 0 | 0 | 0 | 0 |
| MobsHandler | 0 | 0 | 0 | 0 |
| ChestsHandler | 0 | 0 | 0 | 0 |
| FishingHandler | 0 | 0 | 0 | 0 |
| DungeonsHandler | 0 | 0 | 0 | 0 |
| WispCageHandler | 0 | 0 | 0 | 0 |
| EventRouter | 11 (PR #51) | 0 | 0 | 11 |
| **Total** | **11** | **0** | **0** | **11** |

## Open `@suspect` register

None yet. See `docs/project/IMPROVEMENTS.md` for cross-links.

## Decisions log

- CP1 (Task 17): scenario catalog ratified against inventory.
```

- [ ] **Step 2: Commit**

```bash
git add docs/plans/notes/
git commit -m "docs(plans): seed handlers characterization coverage counter"
```

---

## Task 22: HarvestablesHandler characterization loop

> **Pattern:** Task 22 covers every scenario in `harvestables/`. It is structurally the template for Tasks 23-28 (one per remaining handler). Follow the inner sub-workflow once per scenario file.

**Files:**
- Create: `web/scripts/handlers/HarvestablesHandler.test.js`
- Modify: `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`
- Modify: `docs/project/IMPROVEMENTS.md` (only on `@suspect`)

- [ ] **Step 1: Read the whole handler (Rule 3 hot-spot, 639 lines)**

Read `web/scripts/handlers/HarvestablesHandler.js` in full. Note:
- Entry points: `newHarvestableObject` (line 384), `newSimpleHarvestableObject`, `HarvestUpdateEvent` (line 326), `harvestFinished`.
- Core decision: `addHarvestable` (line 158), with `isLiving = mobileTypeId !== null && mobileTypeId !== 65535`.
- State: `this.harvestableList` is an Array, entity lookup via `.find`.
- Settings gates: `shouldDisplayHarvestable` consults `settingsSync.getJSON(<key>)`.

- [ ] **Step 2: Scaffold the test file**

```js
import {describe, test, expect, beforeEach, vi} from 'vitest';
import {HarvestablesHandler} from './HarvestablesHandler.js';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

describe('HarvestablesHandler', () => {
    let handler;

    beforeEach(() => {
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        window.harvestablesDatabase = {
            isLoaded: true,
            isValidResourceByTypeNumber: vi.fn().mockReturnValue(true)
        };
        window.mobsDatabase = {
            isLoaded: true,
            getResourceInfo: vi.fn().mockReturnValue({type: 'Fiber', tier: 4})
        };

        globalThis.__settingsSyncState = {
            settingShowHarvestable: true,
            settingShowLivingHarvestable: true
        };
        vi.mock('../utils/SettingsSync.js', () => ({
            default: {
                getBool: (k) => globalThis.__settingsSyncState?.[k] ?? false,
                getJSON: () => ({e0: [true, true, true, true, true, true, true, true]})
            }
        }));

        handler = new HarvestablesHandler(null);
    });

    // Per-scenario tests are added below, one describe block per scenario file.
});
```

- [ ] **Step 3: Run scaffold to confirm suite boots**

Run: `npx vitest run web/scripts/handlers/HarvestablesHandler.test.js`
Expected: `0 passed`, no failure. The file compiles.

- [ ] **Step 4: First scenario, single static harvestable spawn, red**

Append to the test file inside the main `describe`:

```js
describe('newHarvestableObject', () => {
    // pcap-derived web/scripts/__fixtures__/ws/harvestables/single-spawn.json
    // @verified 2026-04-18: first matching spawn should land in harvestableList with static flag (mobileTypeId absent)
    test('static spawn from pcap fixture adds one entry with tier and type', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const msg = fx.messages[0];
        const Parameters = normalizeParams(msg.parameters);

        handler.newHarvestableObject(Parameters[0], Parameters);

        const list = handler.harvestableList;
        expect(list.length).toBe(1);
        expect(list[0].id).toBe(Parameters[0]);
        expect(typeof list[0].tier).toBe('number');
    });
});
```

Run: `npx vitest run web/scripts/handlers/HarvestablesHandler.test.js`

Three possible outcomes:
- PASS: label stays `@verified`, proceed to next scenario.
- FAIL assertion: apply stop-and-discuss protocol. Pick one of:
  - H1 wrong intent: rewrite the assertion, relabel `@characterization`.
  - H2 wrong fixture: look at the JSON and decide whether to regenerate or hand-adjust.
  - H3 code bug: relabel `@suspect`, append to `IMPROVEMENTS.md`, proceed.
- CRASH on import/stub: fix the stub, do not alter production code.

- [ ] **Step 5: Commit the first scenario**

```bash
git add web/scripts/handlers/HarvestablesHandler.test.js
git commit -m "test(harvestables): characterize single static spawn"
```

- [ ] **Step 6: Expand coverage by observed variant (Rule 10 coverage principle)**

For each distinct `(type, tier, charges)` combination observed in `web/scripts/__fixtures__/ws/harvestables/single-spawn.json` and `batch-spawn.json`, add one dedicated `test(...)` block under the appropriate `describe`. Use `fx.messages[i]` indexing. Target per design: 35-50 scenarios for this handler. Commit in batches of 3-5 tests with messages like:

```
test(harvestables): characterize Fiber T2-T4 enchant 0 spawns
test(harvestables): characterize Ore T4-T6 spawn under settings off
test(harvestables): characterize living spawn with mobileTypeId path
test(harvestables): characterize enchant update via HarvestUpdateEvent
test(harvestables): characterize harvest finished event removes entity
```

Every new `test()`:
- Has a 2-line header comment declaring `pcap-derived <path>` or `synthetic <reason>`.
- Carries a confidence label with date in the description.
- Asserts observable state only.
- Triggers stop-and-discuss on failure.

- [ ] **Step 7: Update the coverage counter**

Bump the HarvestablesHandler row in `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` after every batch commit.

- [ ] **Step 8: CP2 user checkpoint**

After the handler target count (35-50) is met, stop and summarize:
- Final counts by label.
- List of `@suspect` entries with IMPROVEMENTS.md cross-link.
- Any surprises (fixtures missing variants, settings gates behaving unexpectedly).

Wait for user go/no-go before moving to MobsHandler.

---

## Task 23: MobsHandler characterization loop

> Same sub-workflow as Task 22. Handler-specific guidance below.

**Files:**
- Create: `web/scripts/handlers/MobsHandler.test.js`

- [ ] **Step 1: Read the handler in full (712 lines, hot-spot)**

Entry points: `NewMobEvent`, `updateMobPosition`, `updateMobHealth*`, `updateMistPosition`, `updateEnchantEvent`. Watch for faction parameter history (Rule 11): `Parameters[53]` vs `Parameters[11]`.

- [ ] **Step 2: Scaffold test file mirroring Task 22 Step 2**

Mock `window.mobsDatabase` and `window.harvestablesDatabase` as needed, no production-code changes.

- [ ] **Step 3: First scenario, passive mob spawn, red**

```js
// pcap-derived web/scripts/__fixtures__/ws/mobs/spawn.json
// @verified 2026-04-18: first spawn adds one mob with typeId + position
test('mob spawn adds entry with typeId', async () => {
    const fx = await loadFixture('mobs', 'spawn');
    const Parameters = normalizeParams(fx.messages[0].parameters);
    handler.NewMobEvent(Parameters);
    expect(handler.mobsList.length).toBe(1);
});
```

- [ ] **Step 4: Run, commit, expand by variant**

Target: 25-40 scenarios across distinct `(typeId, faction, mist)` combinations observed in the corpus.

- [ ] **Step 5: CP3 user checkpoint**

Wait for go/no-go before PlayersHandler.

---

## Task 24: PlayersHandler characterization loop

> Same sub-workflow as Task 22.

**Files:**
- Create: `web/scripts/handlers/PlayersHandler.test.js`

- [ ] **Step 1: Read the handler in full (385 lines)**

Entry points: `handleNewPlayerEvent` (line 131, primary alert trigger at 158-175), `handleMountedPlayerEvent`, `updatePlayerFaction` (line 266), `triggerHostileAlert` (lines 271-295, secondary alert path), `UpdatePlayerHealth`, `UpdatePlayerLooseHealth`, `updateItems`, `removePlayer`. `alreadyIgnoredPlayers` cleared at line 254. Zone PvP lookup at lines 143 and 272.

- [ ] **Step 2: Scaffold test file, mock `window.settingsSync`, `window.zonesDatabase`, `window.currentMapId`**

- [ ] **Step 3: Alert gate scenarios, expected `@suspect` cluster (issues #36, #65)**

Write tests for:
- Ignored player in PvP zone does not trigger sound/flash (expected fail → `@suspect #36`).
- Non-ignored hostile triggers alert in red zone (expected pass → `@verified`).
- Non-ignored hostile in unknown zone (zone absent from DB): expected fail → `@suspect #65`.
- Faction transition via `updatePlayerFaction` triggers secondary alert path (`triggerHostileAlert`).

Every `@suspect` gets an `IMPROVEMENTS.md` entry with cross-link `#36` or `#65`.

- [ ] **Step 4: Expand by variant**

Target: 20-28 scenarios. Cover factions observed (friendly/hostile/passive/flagged), mounted vs foot, health updates, item updates.

- [ ] **Step 5: CP4 user checkpoint**

---

## Task 25: ChestsHandler characterization loop

> Same sub-workflow as Task 22.

**Files:**
- Create: `web/scripts/handlers/ChestsHandler.test.js`

- [ ] **Step 1: Read the handler in full (80 lines)**

Entry points: `addChestEvent` (line 55), `removeChest`, `cleanupStaleEntities`. Bug cluster: issue #29 (rarity vs chestName). The `addChestEvent` code reads `chestName = Parameters[3]`, falls back to `Parameters[4]` if the name contains "mist". This is the likely `@suspect` focus.

- [ ] **Step 2: Scaffold test file**

- [ ] **Step 3: Chest spawn scenarios**

Write tests:
- Spawn with non-mist name stores `Parameters[3]`.
- Spawn with "mist" in `Parameters[3]` falls back to `Parameters[4]` (expect `@suspect` depending on #29 triage).
- Same id spawned twice touches existing instead of duplicating.
- `cleanupStaleEntities` removes entries past `maxAgeMs`.

- [ ] **Step 4: Expand by variant**

Target: 5-10 scenarios across distinct chest names observed.

- [ ] **Step 5: CP5 kicks in after ChestsHandler + FishingHandler, so proceed directly to Task 26**

---

## Task 26: FishingHandler characterization loop

> Same sub-workflow as Task 22.

**Files:**
- Create: `web/scripts/handlers/FishingHandler.test.js`

- [ ] **Step 1: Read the handler in full (112 lines)**

Entry points: `newFishEvent` (line 32), `fishingEnd` (line 75), `removeFish`, `cleanupStaleEntities`. Bug cluster: issue #25 (fishpool invalid).

- [ ] **Step 2: Scaffold test file, mock `settingsSync.getBool("settingShowFish")`**

- [ ] **Step 3: Fishing scenarios**

Write tests:
- `newFishEvent` with settings off returns early without adding.
- `newFishEvent` with missing `Parameters[4]` (type) is ignored.
- `newFishEvent` with missing `Parameters[1]` (coord) is ignored.
- `newFishEvent` valid payload adds a Fish with computed `totalSize`.
- `fishingEnd` removes known id.
- `fishingEnd` on unknown id is a no-op.

- [ ] **Step 4: Expand by variant**

Target: 4-7 scenarios. Cover distinct fish types observed. Issue #25 likely surfaces as `@suspect` on one of the tests.

- [ ] **Step 5: CP5 user checkpoint**

---

## Task 27: DungeonsHandler characterization loop

> Same sub-workflow as Task 22.

**Files:**
- Create: `web/scripts/handlers/DungeonsHandler.test.js`

- [ ] **Step 1: Read the handler in full (159 lines)**

Entry points: `dungeonEvent` (line 68), `addDungeon` (line 93), `removeDungeon`, `cleanupStaleEntities`. Four dungeon types: Solo, Group, Corrupted, Hellgate. Settings gates: `settingDungeonCorrupted`, `settingDungeonSolo`, `settingDungeonE<enchant>`, `settingDungeonHellgate`, `settingDungeonDuo`.

- [ ] **Step 2: Scaffold test file, mock `settingsSync.getBool` per setting key**

- [ ] **Step 3: Dungeon scenarios**

Write tests:
- Corrupted dungeon detected when name contains "corrupted" even with "solo".
- Solo detected, E0 to E3 bands gated by `settingDungeonE<n>`.
- Hellgate detected when name contains "hellgate".
- Group fallback on any other name.
- Settings off returns early without adding.

- [ ] **Step 4: Expand by variant**

Target: 8-14 scenarios across observed name patterns and enchant bands.

- [ ] **Step 5: CP6 kicks in after DungeonsHandler + WispCageHandler, proceed to Task 28**

---

## Task 28: WispCageHandler characterization loop

> Same sub-workflow as Task 22.

**Files:**
- Create: `web/scripts/handlers/WispCageHandler.test.js`

- [ ] **Step 1: Read the handler in full (77 lines)**

Entry points: `newCageEvent` (line 29), `cageOpenedEvent` (line 44), `removeCage`, `cleanupStaleEntities`. Settings gate: `settingCage`. `newCageEvent` returns early when `settingCage` true OR when `Parameters[4]` is defined (note the inverted boolean).

- [ ] **Step 2: Scaffold test file, mock `settingsSync.getBool("settingCage")`**

- [ ] **Step 3: Cage scenarios**

Write tests:
- Cage spawn with settings off adds entry.
- Cage spawn with settings on returns early (inverted gate).
- `Parameters[4]` defined returns early (acts as exclusion flag).
- `cageOpenedEvent` removes known id.

- [ ] **Step 4: Expand by variant**

Target: 2-4 scenarios.

- [ ] **Step 5: CP6 user checkpoint**

---

## Task 29: EventRouter coverage extension

**Files:**
- Modify: `web/scripts/core/EventRouter.test.js`

- [ ] **Step 1: Read the router in full (446 lines, hot-spot)**

Target dispatch table. Extension adds:
- One test per dispatched event code in the `onEvent` switch (about 20-22 cases that invoke a handler method).
- One test per documented no-op case (HarvestStart, HarvestCancel, InventoryPutItem, NewSimpleItem, NewEquipmentItem, NewJournalItem, UpdateFame, UpdateMoney).
- Unknown event code: router does not crash.
- `onRequest` cases 21 and 22.
- `onResponse` JoinMap, ChangeCluster, JoinFinished.
- Logging-only case 590: no state mutation.

- [ ] **Step 2: First new test, Harvestables event 40 routes to newHarvestableObject**

```js
// pcap-derived web/scripts/__fixtures__/ws/harvestables/single-spawn.json
// @verified 2026-04-18: event code 40 routes to HarvestablesHandler.newHarvestableObject
test('event 40 routes to HarvestablesHandler.newHarvestableObject', async () => {
    const fx = await (await import('../__fixtures__/loader.js')).loadFixture('harvestables', 'single-spawn');
    const params = (await import('../__fixtures__/loader.js')).normalizeParams(fx.messages[0].parameters);
    EventRouter.onEvent(params);
    expect(handlers.harvestablesHandler.newHarvestableObject).toHaveBeenCalledTimes(1);
});
```

Run: `npx vitest run web/scripts/core/EventRouter.test.js`
Expected: new test passes.

- [ ] **Step 3: Expand by dispatch case**

Add one `test(...)` per item in the list above, following the Task 22 sub-workflow. Target: 25-35 new tests.

- [ ] **Step 4: JoinFinished isBZ `@suspect` (issue #57)**

Under `describe('onResponse JoinFinished')`, write a test that asserts `map.isBZ === true` when the hashtable says so. If it fails (because extraction was dropped in Protocol18), label `@suspect #57` and cross-link in `IMPROVEMENTS.md`. Do not fix here; that is the scope of `2026-04-18-protocol18-regressions-design.md`.

- [ ] **Step 5: CP7 user checkpoint**

Summarize final coverage distribution. Confirm no green-washed failures (use `npx vitest run --reporter verbose`). Wait for user go/no-go before the wrap.

---

## Task 30: Green suite verification

**Files:**
- None modified in this task.

- [ ] **Step 1: Full JS suite**

Run: `npm test`
Expected: every test passes or is explicitly labeled `@suspect`. No silent skips.

- [ ] **Step 2: Full Go suite**

Run: `go test ./...`
Expected: `ok` on every package.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exit 0.

Run: `golangci-lint run`
Expected: exit 0 (CI uses the same version via `.github/actions/setup`).

- [ ] **Step 4: Build**

Run: `go build ./...`
Expected: exit 0.

- [ ] **Step 5: Smoke test the binary**

Run: `make run` in a shell, wait for `HTTP server listening on :5001`, visit `http://localhost:5001` in a browser, confirm the page renders and the WebSocket connects (status indicator green). Kill the process.

- [ ] **Step 6: Evidence capture**

Paste the last line of each output into the completion note drafted in Task 31 (no fabricated output, Rule 5).

---

## Task 31: Completion note

**Files:**
- Create: `docs/plans/notes/2026-04-18-handlers-characterization-completion.md`

- [ ] **Step 1: Write the completion note**

```markdown
# Handlers Characterization Completion Note

Date completed: <fill>.
Branch: `feat/handlers-characterization`.

## Final counts

<paste coverage table from docs/plans/notes/2026-04-18-handlers-characterization-coverage.md>

## Verification evidence

- `npm test`: <paste final line>
- `go test ./...`: <paste final line>
- `npm run lint`: <paste final line>
- `golangci-lint run`: <paste final line>
- `go build ./...`: <paste final line>
- `make run` smoke: <describe browser verification outcome>

## Handoffs

- `docs/plans/2026-04-18-protocol18-regressions-design.md`: drops "capture safe + BZ pcaps" step. Fixtures already live. Tests for #52 and #57 already `@suspect`.
- `docs/plans/2026-04-18-alerts-and-ignore-list-design.md`: `@suspect` tests on #36 and #65 are now the regression pins. Fix flips them to `@verified`.
- `docs/plans/2026-01-15-living-harvestables-fix-design.md`: same pattern for #30 and #32.

## Open suspects at merge time

<list from IMPROVEMENTS.md>
```

- [ ] **Step 2: Commit**

```bash
git add docs/plans/notes/2026-04-18-handlers-characterization-completion.md
git commit -m "docs(plans): handlers characterization completion note"
```

---

## Task 32: Open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/handlers-characterization
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "test(handlers): retroactive characterization safety net" --body "$(cat <<'EOF'
## Summary
- New `tools/photon-dump` binary extracts per-scenario pcap fragments and WS-level JSON fixtures from a real Photon capture.
- Extended `tools/anonymize-pcap` with `--scrub-string` for local player name scrubbing.
- Vitest test files cover the 7 detection handlers plus EventRouter dispatch, with explicit `@verified` / `@characterization` / `@suspect` labels per Rule 10.
- No production handler code modified. `@suspect` tests cross-link to `docs/project/IMPROVEMENTS.md`.

## Test plan
- [ ] `npm test` green
- [ ] `go test ./...` green
- [ ] `npm run lint` green
- [ ] `golangci-lint run` green
- [ ] `make run` smoke tested in browser
EOF
)"
```

Do **not** append a `Co-Authored-By: Claude` trailer. Not in the commit, not in the PR body.

- [ ] **Step 3: Link the PR back into the coverage counter**

Add the PR URL at the top of `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`. Commit with `docs(plans): link PR on coverage counter`.

---

## Rollback Guidance

If the extraction pipeline produces fragile fixtures and we need to restart from a fresh capture:

1. Delete `internal/photon/testdata/<handler>/` subdirectories (keep root-level fragments from PR #51/#64).
2. Delete `web/scripts/__fixtures__/ws/<handler>/` subdirectories.
3. Regenerate with `go run ./tools/photon-dump ...` against the new `capture.anon.pcap`.
4. Do not delete `tools/photon-dump/` or `tools/anonymize-pcap/`; they stay.

Rule 8 applies to every retry: the extraction pipeline itself carries tests, so regeneration does not invalidate the tooling.
