# Dynamic capture interface selection (#91)

Date: 2026-04-26.

Closes #91 ("Exit Lag, switch interface support").

## Goals

1. Replace IP-keyed persistence (`ip.txt`) with stable interface identifier `{name, description}`.
2. Capture on **multiple interfaces simultaneously** so the radar keeps working when traffic is re-routed by ExitLag, VPN toggles, or wifi/ethernet switches.
3. Allow runtime add/remove of capture interfaces from the front-end Settings page (source of truth backend).
4. Decouple **capture interfaces** from **LAN serving addresses** in the TUI/UI display.
5. Tag interfaces by category (WiFi, Ethernet, ExitLag, VPN, Virtual) to help selection.
6. Survive interface unavailability (cable unplugged, VPN service stopped) without crashing.
7. Cross-platform: Windows + Linux. macOS not officially supported but should not regress.

## Non-goals

- Header/topbar selector (deferred v2).
- Auto-detect by traffic sniff at boot (`N3` from brainstorm, deferred).
- QR code for LAN URL.
- Capture at NDIS LWF / WFP / kernel layer to bypass ExitLag's filter (different threat model, out of scope hobby).
- Authentication on the API (LAN trust + localhost-only edit covers).

## Architecture

### Backend (Go)

#### Storage : `network.json`

```json
{
  "captureInterfaces": [
    {"name": "\\Device\\NPF_{ABC...}", "description": "Wi-Fi"},
    {"name": "\\Device\\NPF_{DEF...}", "description": "Realtek PCIe GbE Family Controller"}
  ]
}
```

Located at `appDir` root, replaces `ip.txt`. Saved on every change via `POST /api/network/interfaces`.

Migration: if `ip.txt` exists and `network.json` does not, on first boot resolve the IP via `pcap.FindAllDevs()` to one `{name, description}`, write `network.json`, delete `ip.txt`. Logged once.

#### Capturer lifecycle: `Manager`

The current `capture.New()` factory returns a single `Capturer` keyed by IP. Replace with:

- `capture.NewManager(ctx, appDir)` — owns a map `activeCaptures map[string]*Capturer` keyed by `device.Name`, plus a `mu sync.RWMutex`.
- `Manager.Reconfigure(targetNames []string) error` — diff against current set:
  - For names in target but not active: open a new `pcap.Handle` + start goroutine.
  - For names active but not in target: cancel goroutine, close handle.
  - For names in both: leave untouched.
- `Manager.OnPacket(handler PacketHandler)` — single shared handler called by every active goroutine. Photon parser handles duplicate ENet sequence numbers as retransmissions, so concurrent calls are idempotent at the application layer.
- `Manager.Close(ctx)` — cancel all goroutines, close all handles, wait `ctx.Deadline()` for clean shutdown. Done in a single pass under the write lock.
- `Manager.State()` — snapshot for HTTP API (lists active interfaces, last-seen-packet timestamp per handle for diagnostic).

State machine:
- `running` — at least one handle active.
- `awaiting_interfaces` — zero handles active (no persisted choice or all persisted unavailable). HTTP server keeps running, capture loop is idle.

Open/close ordering rules (the prudence the user explicitly requested):
- **Open**: load config → enumerate available interfaces → resolve persisted names against currently-available set → open handles for the resolved subset → for each handle, install BPF filter BEFORE starting the read goroutine → only then start packet processing.
- **Close**: cancel context first → close handles after the goroutines have observed the cancellation (drain via wait group with timeout) → only then return. Never close a handle while its goroutine is still polling — risks a `Read` on a freed pcap struct (libpcap is not always safe under that race).
- **Reconfigure**: take the write lock once, compute the diff, perform additions before removals (so the radar never has 0 captures during a swap if the user is just adding/removing one).

#### Categorization

`internal/capture/categorize.go`:

```go
type Category string

const (
    CategoryWiFi     Category = "wifi"
    CategoryEthernet Category = "ethernet"
    CategoryExitLag  Category = "exitlag"
    CategoryVPN      Category = "vpn"
    CategoryVirtual  Category = "virtual"
    CategoryOther    Category = "other"
)

func Categorize(name, description string) Category
```

Tested against `lowercase(name + " " + description)` so it works on Windows (where description is human-readable, name is `\Device\NPF_{GUID}`) and Linux (where description is often empty, name is `eth0`/`wlan0`/`tun0`).

Patterns (case-insensitive on the concatenation), evaluated in order — first match wins:

| Order | Category | Regex |
|---|---|---|
| 1 | virtual | `virtualbox\|vmware\|hyper-v\|virtual switch\|vethernet\|teredo\|loopback pseudo\|wi-fi direct\|mobile hotspot\|\bdocker\d\|\bbr-\|\bvirbr\d\|\bvmnet\d\|\bveth\|^lo$` |
| 2 | exitlag | `exit\s*lag` |
| 3 | vpn | `vpn\|wireguard\|wintun\|tap-windows\|openvpn\|\btun\d\|\btap\d\|\bwg\d\|\bppp\d` |
| 4 | wifi | `wi-?fi\|wireless\|802\.11\|\bwlan\d\|\bwlp\d\|\bwifi\d` |
| 5 | ethernet | `ethernet\|gigabit\|family controller\|\beth\d\|\benp\d\|\beno\d\|\bens\d` |
| 6 | other | (fallback) |

Order rationale:
- `virtual` first so "Microsoft Wi-Fi Direct Virtual Adapter" doesn't tag as wifi.
- `exitlag` before `vpn` so user gets a distinct badge.
- `vpn` before wifi/ethernet so a VPN over wifi/ethernet doesn't tag as the underlying transport.

Patterns dropped from the brainstorm draft after web fact-check: `tunnel` (false positive on Teredo), `nordvpn`/`expressvpn` (never literal in descriptions, they use TAP/WireGuard sub-drivers), `realtek` standalone (Realtek makes wifi cards too), `intel.*pro` (deprecated branding, risky `.*pro` matches anything).

`RankCandidates(interfaces []NetworkInterface) []NetworkInterface` sorts by category priority: ethernet > wifi > exitlag > vpn > virtual > other. Used to display in the UI dropdown and to pick auto-select defaults.

#### Default selection on first boot

When `network.json` is absent and `ip.txt` is absent: auto-select all interfaces matching:
- Category in `{ethernet, wifi, exitlag}`
- IPv4 in RFC1918 (`10/8`, `172.16/12`, `192.168/16`)
- Status UP (`pcap.FindAllDevs()` lists with at least one IPv4)

Persist that subset to `network.json`, log "Auto-selected interfaces: [...]. Change in Settings if needed."

If zero candidates match, enter `awaiting_interfaces` state and let the user pick from Settings. Don't crash the binary.

#### HTTP API

| Method | Path | Body / Response | Restriction |
|---|---|---|---|
| GET | `/api/network/interfaces` | `[{name, description, address, category, isPersisted, isAvailable}, ...]` | none |
| GET | `/api/network/state` | `{captureInterfaces: [...], isCapturing: bool, lanAddresses: [...]}` | none |
| POST | `/api/network/interfaces` | body `{names: ["..."]}`, persists + `Manager.Reconfigure()`. 200 ok, 4xx with error message on failure. | **403 if `req.RemoteAddr` is not loopback** (prevents accidental modification by a phone on the LAN, since the host PC is the only place capture should be reconfigured from) |
| POST | `/api/network/refresh` | re-enumerates `pcap.FindAllDevs()`, no body. Returns the new list. | none |

`lanAddresses` computation: enumerate all host IPv4s via `net.InterfaceAddrs()`, filter those in RFC1918 with category in `{ethernet, wifi}`, return as strings. Independent of the active capture set.

Localhost detection: `req.RemoteAddr` parsed, IP compared against `127.0.0.0/8` and `::1`. `X-Forwarded-For` ignored on purpose (we don't run behind a proxy).

#### Failure modes and recovery

| Scenario | Backend behavior |
|---|---|
| Persisted name not in current `pcap.FindAllDevs()` | Skip silently, log once. If all skipped: state = `awaiting_interfaces`. |
| `pcap.OpenLive` fails for a name | Log error, mark interface as `lastError` in state, do not open handle. Other handles continue. |
| Handle returns error mid-session (interface goes down) | Goroutine logs, exits. State updates. UI sees the change on next `/api/network/state` poll. |
| All handles down | State = `awaiting_interfaces`. UI banner shows. |
| Reconfigure called with empty list | Stop all handles. State = `awaiting_interfaces`. (User has to opt back in.) |

### Frontend (vanilla JS + Go templates)

#### Settings page: new "Network" section

Inserted in `internal/templates/pages/settings.gohtml`, two subsections:

**Capture interfaces** (multi-select):
- Checkbox list, one row per interface returned by `GET /api/network/interfaces`.
- Each row: badge (🔌/🛜/🚀/🔒/🧪), description, IP address, "(unavailable)" suffix if `!isAvailable`.
- Sorted by `RankCandidates` order.
- Buttons: "Refresh list" (calls `POST /api/network/refresh`), "Apply changes" (disabled until selection differs from current; spinner while POST in flight).
- Status banner at top:
  - Green: "✓ Capturing on N interfaces" with bullet list.
  - Orange: "⚠ Capture not running. Pick at least one interface to start." (when `awaiting_interfaces`).
  - Yellow read-only: "Capture interfaces can only be changed from the host PC." (when client is non-localhost; the apply button is hidden).

**LAN access** (read-only):
- Bullet list of `lanAddresses` rendered as clickable URLs `http://<addr>:5001/`.
- Subtitle: "Reachable from devices on the same local network."
- Helper text: "These are independent of the capture interfaces above."

#### Frontend handler

`web/scripts/handlers/NetworkSettingsHandler.js`:
- Fetches `/api/network/interfaces` and `/api/network/state` on settings page load.
- Polls `/api/network/state` every 5s while the settings page is visible (to reflect changes made from another client).
- Submits diff via `POST /api/network/interfaces` on Apply.
- Renders a toast on success/failure.

#### TUI changes

`internal/ui/dashboard.go`:
- Field `adapterIP string` removed.
- Fields added: `captureInterfaces []CaptureInterfaceState`, `lanAddresses []string`.
- Display:
  ```
  Capture: Wi-Fi (192.168.1.42), Ethernet (192.168.1.10)
  LAN:     http://192.168.1.42:5001  http://192.168.1.10:5001
  ```
- Updated when `Manager.State()` changes (via channel from manager to dashboard, same pattern as the existing stats updates).

#### CLI

The interactive prompt in `internal/capture/pcap.go:promptForInterface()` is removed. The `--ip` flag stays for one-shot legacy override (resolves IP to interface name in-process, doesn't write `network.json`). Headless deployments edit `network.json` directly.

## Files affected

Created:
- `internal/capture/manager.go` — `Manager` struct + lifecycle.
- `internal/capture/categorize.go` — `Categorize`, `RankCandidates`, regex constants.
- `internal/capture/network_config.go` — `network.json` read/write, `ip.txt` migration.
- `internal/capture/manager_test.go`, `categorize_test.go`, `network_config_test.go`.
- `internal/server/network_api.go` — HTTP handlers.
- `internal/server/network_api_test.go`.
- `web/scripts/handlers/NetworkSettingsHandler.js`.
- `web/scripts/handlers/_NetworkSettingsHandler.test.js`.

Modified:
- `internal/capture/pcap.go` — split: keep `Capturer` (single-handle worker), drop the IP-keyed factory and prompt logic.
- `internal/server/http.go` — register the new API routes.
- `internal/ui/dashboard.go` — replace `adapterIP` with multi-interface state.
- `internal/templates/pages/settings.gohtml` — new "Network" section.
- `cmd/radar/main.go` — wire `Manager` instead of `Capturer`, remove the prompt code path.

Deleted:
- `internal/capture/pcap.go:promptForInterface` and helpers `printInterfaces`, `selectInterface`, `saveIPToFile`.
- The `ip.txt` write path. Read path stays only for migration.

## Testing strategy

**Unit Go**:
- `Categorize` table-driven against ~30 real-world adapter names from web fact-check (Windows + Linux mix).
- `RankCandidates` ordering on mixed input.
- `network_config_test`: read/write round-trip, migration from `ip.txt`, malformed JSON tolerance.
- `Manager` lifecycle: start with stub interfaces, reconfigure (add/remove/swap), close cleanly. Verify no goroutine leaks via `goleak` if available.
- `Manager` failure: stub `pcap.OpenLive` error → state reflects, others keep running.

**HTTP API**:
- Shape of GET endpoints.
- POST 403 from non-loopback `RemoteAddr`.
- POST persistence on disk.
- POST triggers `Manager.Reconfigure`.

**Frontend Vitest**:
- `NetworkSettingsHandler` rendering function: input list → DOM markup with badges and current state.
- Apply diff calculation (selected vs current).
- Toast on success/error.

**E2E manual smoke** (post-merge checklist for the user):
- Cold start with no `ip.txt`, no `network.json` → auto-select kicks in, radar captures.
- Cold start with legacy `ip.txt` → migration → `network.json` written, `ip.txt` deleted.
- Toggle WiFi off mid-session → goroutine exits, state shows degraded, ethernet keeps capturing.
- ExitLag toggle: enable, verify radar still receives events. Disable, verify same. Document outcome (see Known limitation).
- Phone on LAN: open `/settings`, verify capture-interface checkboxes are read-only, LAN access section shows correct URLs.
- Phone tries POST: 403.
- Settings change from host: phone's view updates within 5s (polling).

## Known limitation: ExitLag NDIS LWF positioning

ExitLag installs a **NDIS Lightweight Filter** ("ExitLag LightWeight Filter" by Skowsand Tecnologia LTDA) rather than a virtual adapter. Pcap on Windows uses NPF, itself a NDIS protocol driver. Three possible cases for what pcap captures with ExitLag enabled:

- **Case A**: ExitLag-LWF below NPF in the stack → pcap sees the original game-server-bound traffic on the host's physical interface. Multi-interface capture covers this.
- **Case B**: ExitLag-LWF above NPF → pcap sees only the rewritten/relay-bound traffic. Multi-interface still captures it (BPF filter on UDP port 5056 matches as long as ExitLag preserves the port).
- **Case C**: ExitLag re-routes Albion traffic from one physical interface (WiFi) to another (Ethernet, or vice versa). The original single-interface capture missed it; **multi-interface capture resolves this**.
- **Case D** (worst case): ExitLag swallows packets entirely from NPF's view (filter strips them before they reach the protocol driver). No software solution at the pcap layer; would require WFP-level capture (different threat model).

Cases A/B/C are addressed by this PR. Case D, if it materializes, will need a follow-up issue.

## Follow-up: ExitLag free trial validation

After merge, the project owner will activate ExitLag's 3-day free trial and live-test the radar in the four scenarios above (toggle ExitLag on/off, observe radar continuity, verify which case A/B/C/D applies to their setup). Outcome will be appended to issue #91 and may trigger a follow-up issue if Case D is observed.

## Rollback plan

Single feature branch, multiple commits. If a regression surfaces post-merge:
- The `Manager` goroutine architecture is additive on top of the existing `Capturer`. Reverting the manager + the new API + the Settings UI changes restores the single-handle behavior keyed by IP.
- The `network.json` file remains on disk (harmless if `ip.txt` is restored alongside via revert; both can coexist temporarily).
- TUI changes can be reverted independently if only the display is wrong.
