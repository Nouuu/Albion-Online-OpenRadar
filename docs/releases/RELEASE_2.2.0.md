# Release 2.2.0, Protocol18 + Mists + Multi-interface

This release closes the stabilization phase that started in April 2026. The big rocks: a full Protocol18 port backed by pcap fixtures, Mists detection restored end to end, multi-interface capture (ExitLag, VPN, WiFi-to-Ethernet handoff), a coherent logging system with in-process pcap recording, LAN access, and a real test harness across 14 handler suites.

## Highlights

### Protocol18 port

The deserializer was rewritten for Protocol18. Every Photon event type the radar consumes now ships with a pcap fixture in `internal/photon/testdata/` and a Go test that reads the fixture via `gopacket` and asserts on the decoded payload. The router contract is pinned: `EventRouter.onEvent` switches on `Parameters[252]`, `onRequest`/`onResponse` on `Parameters[253]`. JS event codes and operation codes live in `web/scripts/utils/EventCodes.js` and `OperationCodes.js`; Go mirrors regenerate via `make refresh-codes`.

Drift hunting paid off: 452 value mismatches against upstream `StatisticsAnalysisTool` were collapsed in a single sync pass (#70). The positional enum (`Unused=0` then auto-incremented) is impossible to spot-check; we now diff the whole file every refresh.

### Mists detection

Portals, feu follets, and wisp cages are back on the radar. Three fixes shipped together:

- The `MobsDrawing` mist enchant filter was inverted: checking E0 hid mists instead of showing them. With every E0..E4 box ticked by default, every mist was hidden. One-line fix.
- `WispCageHandler` was reading the wrong parameter slots (`[1]/[2]/[4]` vs the real layout) and rejecting every real event with a wrong `undefined` gate. Capture-70 corpus pinned the correct layout.
- Dungeon enchant source moved from `Parameters[6]` (a dungeon type/variant id outside the 0-4 range) to `Parameters[8]`. Side benefit: every group dungeon family that had been silently filtered out is back on the radar (Morgana, Keeper, Undead, Royal Solo).

Architecture write-up: `docs/technical/MISTS_DETECTION.md`.

### Multi-interface capture

Albion traffic can change route while the game runs: ExitLag toggle, VPN start, WiFi-to-Ethernet handoff. The radar now listens on every selected interface in parallel. The single-handle keyed by IP is gone.

`internal/capture/manager.go` owns the active capturer set, diffs against the target on `Reconfigure`, opens new handles before closing old ones so the radar never has zero capturers during a swap. Persistence moved from `ip.txt` to `network.json` with stable `{name, description}` identifiers; the legacy file migrates once on first boot and is then deleted.

Interfaces are categorized (WiFi, Ethernet, ExitLag, VPN, Virtual, Other) with a regex order that puts virtual NICs last. The settings UI surfaces the categorization with badges. `POST /api/network/interfaces` is loopback-only, so a phone on the LAN can read the state but cannot retarget the host's capture.

Architecture write-up: `docs/technical/CAPTURE_INTERFACES.md`.

### Logging coherence and pcap recording

Backend and frontend logs no longer mix. Each output channel has a clear meaning:

| Source | Level | Directory |
|---|---|---|
| Backend Go | DEBUG/INFO/WARN | `logs/sessions/` (gated) |
| Backend Go | ERROR/CRITICAL | `logs/sessions/` (gated) plus `logs/errors/` (always-on) |
| Frontend | DEBUG/INFO/WARN | `logs/debug/` |
| Frontend | ERROR/CRITICAL | `logs/debug/` plus `logs/errors/` |

Configuration moved from `localStorage` to `network.json` so the backend boots with the correct gate state without waiting for the frontend to push a value. The unified `/api/settings/logging` endpoint handles both the server logs toggle and the new pcap recording toggle.

In-process pcap recording is gated by a UI toggle. `Capturer.StartRecording(dir)` writes a `capture_<timestamp>_<sanitized-iface>.pcap` per active interface. `pcapgo.Writer` keeps frame metadata so the output is replayable through `pcap.OpenOffline`. No more external `tcpdump` to debug a parser issue.

Architecture write-up: `docs/technical/LOGGING.md`.

### LAN access and mobile

The frontend builds the WebSocket URL from `window.location` instead of `ws://localhost:5001/ws`. A phone or second laptop loading `http://<server-ip>:5001` gets a working radar without configuration. The startup banner prints the LAN URL alongside localhost when the host adapter has a routable IP.

A minimal mobile responsive pass made every page usable at 375x667 portrait: no horizontal scrollbars, canvas readable, settings forms collapse correctly. Not a redesign, just a sanity baseline.

### Living harvestable tier

Living mob tiers on the radar match the in-game tooltip. The previous `t-1` shift was a compensation for a TypeID OFFSET drift; once OFFSET=16 was confirmed against 6469 pcap NewMob events plus 5889 session-log events with zero outliers, the shift was retired. The tier rule is now `mob.t` directly. Math write-up in `docs/technical/HARVEST_EVENTS.md`.

### Icon visibility

Resource icons now have a size slider, per-rarity color badges instead of a single dot, and a collapsible network panel in the radar overlay. Helps when the screen is dense.

## Detection details

| System | Status | Notes |
|---|---|---|
| Resources | working | static and living, T1-T8, enchantments, render-time filter post #82 |
| Mobs | working | OFFSET=16 confirmed, color-coded threat |
| Players | working | faction detection, zone-aware alerts (PvP type inherited in Mist instances post #103), ignore list |
| Mists | working | portals plus feu follets plus wisp cages |
| Dungeons | basic | shows on radar, per-rarity filter unblocked by Parameters[8] fix |
| Chests | basic | shows on radar, rarity slot still under investigation (CHEST-1) |
| Fishing | partial | spots detected, end-of-fishing event not in current corpus |

## Stability

- Shutdown reliability: pcap close path no longer blocks on a goroutine still polling a freed handle (#63). Manager ordering: cancel context, drain the wait group, only then close handles.
- Settings page: live filtering at render time replaced spawn-time filters that dropped data the user might want to see later (#85).
- Embed safety: `embed_prod.go` excludes test files and fixtures from the production binary; a CI guard rejects unprefixed `*.test.js` (#86).
- Real-DB tests: handler test suites load `web/ao-bin-dumps/*.min.json` instead of mocked database answers. Mocks that lie in sync with a wrong assertion no longer hide bugs (#68).

## Tooling

- `tools/anonymize-pcap`: scrubs MAC, IP, timestamps, optional `--scrub-string` for the local player name.
- `tools/photon-dump`: extracts per-scenario fixtures from a live pcap, both as `.pcap` fragments and as WS-level JSON matching the EventRouter dispatch format.
- `tools/gen-eventcodes`: regenerates Go mirrors from the JS source files.
- `make refresh-codes`: fetches upstream, regenerates JS and Go.

## Tests

351 frontend tests across 14 suites (`@verified`, `@characterization`, `test.fails` pattern documented in CLAUDE.md). Go tests cover the deserializer, the multi-interface manager, the network and settings APIs, and the embed FS. End-to-end flow lives in `e2e/` (Playwright).

## Migration notes

- `ip.txt` is replaced by `network.json`. Migration runs once on first boot if `ip.txt` exists; the file is deleted afterwards.
- `localStorage.settingServerLogsEnabled` is overwritten by the value from `network.json` on the first settings page load. The toggle state carries over without user action.
- The `/api/settings/server-logs` endpoint is replaced by `/api/settings/logging`. Old single-toggle clients break; they are not in the wild.
- `protocol16.go` is gone. The deserializer is a cluster of `deserializer.go`, `packet.go`, `events.go`, `readers.go`, `types.go`, `typecodes.go`.

## Known limitations

- Player live positions stay encrypted (XOR with a KeySync XorCode wrapped by Photon AES). Out of scope without a MITM proxy. See `docs/technical/PLAYER_POSITIONS_MITM.md`.
- Some Black Zone map tiles missing for zone IDs 4000+. Workaround: disable the map background in settings.
- Resource charges may differ from the actual count because the server applies harvest bonuses that are not on the wire.

## What's next

`docs/project/TODO.md` carries the v2.3 backlog. Priority: Dungeons database, Chests rarity source identification, Fishing completion, Mists cluster id routing (events 518/519/520/529 reach the frontend but no handler consumes them).
