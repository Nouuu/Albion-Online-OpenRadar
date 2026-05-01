# Multi-interface capture

How OpenRadar selects, opens, and switches network interfaces for packet capture.

*Last verified against code: 2026-05-01.*

## Why multi-interface

Albion traffic can change route while the game runs. Toggling ExitLag, switching between WiFi and Ethernet, starting a VPN, or simply unplugging the cable all redirect UDP 5056 to a different host interface. Capturing on a single handle keyed by IP loses the stream every time. The radar holds a manager that can listen on several handles at once, each with its own goroutine, and add or remove handles at runtime.

## Storage

`network.json` at `appDir` is the source of truth.

```json
{
  "captureInterfaces": [
    {"name": "\\Device\\NPF_{ABC}", "description": "Wi-Fi"},
    {"name": "\\Device\\NPF_{DEF}", "description": "Realtek PCIe GbE Family Controller"}
  ],
  "logging": {...}
}
```

Stable identifier is `{name, description}`, not IP. Migration from the legacy `ip.txt` happens once on first boot if the file exists: the IP is resolved to a `{name, description}` via `pcap.FindAllDevs()`, written to `network.json`, then `ip.txt` is deleted.

## Manager

`internal/capture/manager.go` owns the active capturer set.

- `NewManager(parentCtx)` creates the manager with no active capturers.
- `OnPacket(handler)` registers the single shared callback. Photon parser handles duplicate ENet sequence numbers as retransmissions, so the same packet observed twice on different interfaces is idempotent.
- `Reconfigure(target []NetworkInterface)` diffs against the current set:
  - For names in target but not active: open a new `pcap.Handle`, install BPF, start a goroutine.
  - For names active but not in target: cancel the goroutine, close the handle.
  - For names in both: leave untouched.
  Additions happen before removals so the radar never has zero capturers during a swap.
- `StartRecording(dir)`, `StopRecording()`, `IsRecording()` propagate to every active capturer and persist the recording-enabled flag so future capturers added by `Reconfigure` start recording too.
- `State()` returns a snapshot for the HTTP API: list of active interfaces with their category and last error string.
- `Close(ctx)` cancels every goroutine, waits up to `ctx.Deadline()`, then closes the handles. libpcap is unsafe to close while a `Read` poll is in flight, so handles are closed only after the wait group drains.

## Open and close ordering

The user-facing prudence is encoded in the lifecycle:

- **Open**: load config, enumerate available interfaces, resolve persisted names against the available set, open handles for the resolved subset, install BPF before starting the read goroutine, only then start packet processing.
- **Close**: cancel the context first, drain the wait group, only then close the handles.
- **Reconfigure**: take the write lock once, compute the diff, perform additions before removals.

## Categorization

`internal/capture/categorize.go` tags every interface with one of six categories:

| Category | Match (case-insensitive on `name + " " + description`) |
|---|---|
| `virtual` | virtualbox, vmware, hyper-v, virtual switch, vethernet, teredo, loopback pseudo, wi-fi direct, mobile hotspot, docker, br-, virbr, vmnet, veth, lo |
| `exitlag` | exit lag |
| `vpn` | vpn, wireguard, wintun, tap-windows, openvpn, tun, tap, wg, ppp |
| `wifi` | wi-fi, wireless, 802.11, wlan, wlp, wifi |
| `ethernet` | ethernet, gigabit, family controller, eth, enp, eno, ens |
| `other` | fallback |

Order matters and first match wins:

- `virtual` first so "Microsoft Wi-Fi Direct Virtual Adapter" does not tag as wifi.
- `exitlag` before `vpn` so the user sees a distinct badge for ExitLag.
- `vpn` before `wifi`/`ethernet` so a VPN over WiFi does not tag as the underlying transport.

`RankCandidates` sorts a list by category priority `ethernet > wifi > exitlag > vpn > virtual > other`. The settings page uses this order; the LAN-candidate rank order has virtual NICs last so a host with multiple physical adapters announces a real LAN URL first.

## Default selection on first boot

When neither `network.json` nor `ip.txt` exist, the boot path auto-selects every interface that satisfies all three conditions:

- Category in `{ethernet, wifi, exitlag}`.
- IPv4 in RFC1918 (`10/8`, `172.16/12`, `192.168/16`).
- Status UP (`pcap.FindAllDevs()` returns it with at least one IPv4).

The selected subset is written to `network.json` and the radar logs `Auto-selected interfaces: [...]`. If zero candidates match, the manager enters the `awaiting_interfaces` state and waits for the user to pick from the settings page. The HTTP server keeps running in either case.

## HTTP API

| Method | Path | Purpose | Restriction |
|---|---|---|---|
| GET | `/api/network/interfaces` | list available interfaces with `{name, description, address, category, isPersisted, isAvailable}` | none |
| GET | `/api/network/state` | `{captureInterfaces: [...], isCapturing: bool, lanAddresses: [...]}` | none |
| POST | `/api/network/interfaces` | body `{names: ["..."]}`, persists and triggers `Manager.Reconfigure` | **403 if `req.RemoteAddr` is not loopback** |
| POST | `/api/network/refresh` | re-enumerate `pcap.FindAllDevs()`, return new list | none |

POST is restricted to loopback so a phone on the LAN cannot accidentally retarget the host's capture. `X-Forwarded-For` is ignored on purpose since OpenRadar does not run behind a proxy.

`lanAddresses` returns the set of host IPv4 addresses that are RFC1918 and on a `wifi` or `ethernet` interface, independent of the active capture set.

## Failure modes

| Scenario | Behavior |
|---|---|
| Persisted name missing from `pcap.FindAllDevs()` | skipped silently, logged once. If all are skipped, state goes to `awaiting_interfaces`. |
| `pcap.OpenLive` error on a name | logged, marked as `lastError` in state, the handle is not opened, others continue. |
| Handle returns mid-session error (cable unplugged, interface down) | goroutine logs and exits, state updates, UI sees the change on next `/api/network/state` poll. |
| All handles down | state is `awaiting_interfaces`, UI banner appears. |
| `Reconfigure([])` | every handle is stopped, state goes to `awaiting_interfaces`. |

## ExitLag NDIS LWF

ExitLag installs a NDIS Lightweight Filter rather than a virtual adapter. Three cases are addressed by multi-interface capture:

- **Below NPF in the stack**: pcap sees the original game-server-bound traffic on the host's physical interface. Covered.
- **Above NPF**: pcap sees the rewritten traffic, BPF on UDP 5056 still matches. Covered.
- **Re-route between physical interfaces**: ExitLag moves traffic from WiFi to Ethernet or back. Multi-interface listens to both. Covered.

A fourth case where ExitLag swallows packets entirely from NPF's view would require capture at the WFP layer, which is out of scope for the project.
