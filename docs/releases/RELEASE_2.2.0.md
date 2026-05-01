# Release 2.2.0, Protocol18 + Mists + Multi-interface

This release closes the stabilization phase that started in April 2026. The big rocks: a full Protocol18 port with pcap-fixture-backed tests, Mists detection restored end to end, multi-interface capture (ExitLag, VPN, WiFi-to-Ethernet handoff), a coherent logging system with in-process pcap recording, LAN access from any device on the network, and a real test harness across 14 handler suites.

## Highlights

### Protocol18 port

The deserializer was rewritten for Protocol18. Every Photon event type the radar consumes ships with a pcap fixture in `internal/photon/testdata/` and a Go test that reads the fixture via `gopacket` and asserts on the decoded payload. The router contract is pinned by a table-driven test (#64) on real codes: `Move (22)`, `JoinFinished (2)`, `ChangeCluster (41)`, with expected parameter keys.

### Single source of truth for Albion codes (#70)

JS event codes and operation codes live in `web/scripts/utils/EventCodes.js` and `OperationCodes.js`; Go mirrors regenerate via `make refresh-codes`. The sync pass surfaced 452 stale event-code values in the local copy versus upstream `StatisticsAnalysisTool`: 61 new names added, 15 legacy names dropped (Carriable, Journal, AntiCheat, RedZoneCluster, DebugMobInfo families). 540 operation codes imported with their own Go mirror. Eight `test.fails` (`ROUTER-2..9`) flipped to `@verified` after the sync. Four `OPS-1..4` literals retained in `EventRouter.js` with `FIXME ops-drift` comments because the upstream name does not match the local handler semantics; resolution requires pcap-backed investigation.

### Mists detection (#78, closes #24, #66, #69, #80)

Three Mists-side bugs fixed in the same PR:

1. The `MobsDrawing` mist enchant filter was inverted: checking E0 hid mists instead of showing them. With every E0..E4 box ticked by default, every mist was hidden.
2. `WispCageHandler` read the wrong parameter slots and rejected real events with a wrong `undefined` gate. Capture-70 corpus pinned the correct layout.
3. Photon hashtable marshal failure silently dropped Join responses (`Parameters[103]` shape changed in Protocol18 from scalar to `hashtable{5,7}`). A custom `MarshalJSON` fix on the hashtable type unblocks Mists instance map render.

Architecture write-up: `docs/technical/MISTS_DETECTION.md`.

### Dungeons restored across every family (#78)

The enchant source for dungeons moved from `Parameters[6]` (a dungeon type id with values 2, 37-39, 229, 276, 310, 327, never in the 0-4 enchant range) to `Parameters[8]` (the real 0-4 enchant). The drawing-layer gate `settingDungeonE<n>` could never match the wrong values, so every group dungeon family was silently filtered out. After the fix, `T6_MORGANA`, `T6_KEEPER`, `T6_UNDEAD`, `T5_PORTAL_ROYAL_SOLO`, and `T6_PORTAL` are back on the radar with their correct enchant level.

Live evidence covered both sides: a "Peu commun" `MISTS_SOLO_YELLOW` portal with `Parameters[8]=1` matches the in-game tooltip, a `T6_MORGANA` with `Parameters[8]=2` correctly maps to an E2 dungeon. The MISTS-specific branch in `addDungeon` is preserved so MISTS portals route through the Mists settings (`settingMistSolo/Duo` plus `settingMistE<enchant>`) instead of the Dungeon settings.

Per-type filter (Solo, Group, Corrupted, Hellgate, Avalonian) and a dungeons database stay on the v2.3 backlog.

### Fishing closed (#73, #85, closes #25)

Two complementary fixes:

- `FishingHandler.newFishEvent` rejected every spawn with an empty-string `type` because the guard was `if (!type) return`. Three of five fishpool spawns in the live corpus carry `type=""`. The guard is now `if (type === null || type === undefined) return`, which preserves the original intent (drop missing data) without silently discarding valid data (#73, FISH-1).
- The `settingFishing` gate moved from spawn time to render time, so toggling fishing visibility takes effect on the next frame instead of waiting for new spawns (#85).

Spawns are now detected, interpolated, and visualized. End-of-fishing (event 61) is logged but not yet drawn on the radar; that is the only remaining gap.

### Multi-interface capture (#94)

Albion traffic can change route while the game runs: ExitLag toggle, VPN start, WiFi-to-Ethernet handoff. The radar listens on every selected interface in parallel. The single-handle keyed by IP is gone.

`internal/capture/manager.go` owns the active capturer set, diffs against the target on `Reconfigure`, opens new handles before closing old ones so the radar never has zero capturers during a swap. Persistence moved from `ip.txt` to `network.json` with stable `{name, description}` identifiers; the legacy file migrates once on first boot and is then deleted. Interfaces are categorized (WiFi, Ethernet, ExitLag, VPN, Virtual, Other) with a regex order that puts virtual NICs last (#106 recovers this ordering after it was lost in a squash and adds three unit tests). The settings UI exposes the categorization with badges. `POST /api/network/interfaces` is loopback-only: a phone on the LAN can read the state but cannot retarget the host's capture.

Architecture write-up: `docs/technical/CAPTURE_INTERFACES.md`.

### ExitLag support (#99)

Capture survives ExitLag's NDIS Lightweight Filter in cases A, B, and C documented in `CAPTURE_INTERFACES.md`. The README explains how to switch ExitLag's packet redirection to "NDIS (Legacy)" so Npcap (and Wireshark) can see the traffic. Case D (LWF swallows packets entirely) would need WFP-level capture and is out of scope.

### Logging coherence and pcap recording (#107)

Backend and frontend logs no longer mix. Each output channel has a clear meaning:

| Source | Level | Directory |
|---|---|---|
| Backend Go | DEBUG/INFO/WARN | `logs/sessions/` (gated) |
| Backend Go | ERROR/CRITICAL | `logs/sessions/` (gated) plus `logs/errors/` (always-on) |
| Frontend | DEBUG/INFO/WARN | `logs/debug/` |
| Frontend | ERROR/CRITICAL | `logs/debug/` plus `logs/errors/` |

Configuration moved from `localStorage` to `network.json` so the backend boots with the correct gate state without waiting for the frontend to push a value. A unified `/api/settings/logging` GET/POST endpoint replaces the old `/api/settings/server-logs`; the change is breaking for any client that still calls the old path (none in the wild).

In-process pcap recording is gated by a UI toggle. `Capturer.StartRecording(dir)` writes a `capture_<timestamp>_<sanitized-iface>.pcap` per active interface. `pcapgo.Writer` keeps frame metadata so the output is replayable through `pcap.OpenOffline`. No more external `tcpdump` to debug a parser issue. The PR also fixes a latent bug where `POST /api/network/interfaces` was wiping the `Logging` section of `network.json` because it wrote a fresh `Config{CaptureInterfaces: ...}` instead of merging via `MutateConfig`.

Architecture write-up: `docs/technical/LOGGING.md`.

### Settings coherence (#85, closes #81, #65, #25)

Audit of the settings page surface that uncovered several phantom toggles and out-of-sync gates:

- Orphan keys aligned (`settingShowFish` -> `settingFishing`, etc.) so a checkbox actually controls the gate it claims to.
- Screen Flash now mirrors on the radar canvas. Picture-in-Picture viewers see the alert too.
- Pulsating Border is zone-aware. It fires on faction-flagged players in Black Zones, not just on hostile flag.
- Fishing and Enemy spawn gates moved from spawn-time drop to render-time filter, matching the resource path. Toggling a category mid-session no longer requires a teleport to refresh the radar.
- Logger default is `enabled: false`. The frontend POSTs the persisted state on settings page load, so the gate is correct from the first event.

User test 2026-04-24 confirmed the four observable symptoms.

### Living harvest tier (#77, closes #52)

Living mob tiers on the radar match the in-game tooltip. The `getLivingHarvestTier` rule resolves the live tier as `max(min_tier(loot_type), combat_tier - 1)` for non-DYNAMIC, non-DEAD mobs; DYNAMIC and DEAD variants keep the combat tier. Validated against 9 pcap-derived examples and 4 user screenshots across the Hide and Fiber-critter families.

### TypeID OFFSET fix (#93, closes #92)

The earlier `t-1` shift on living non-DYNAMIC critters was a compensation for a TypeID OFFSET drift, not a game-tier rule. Validation against 6469 pcap NewMob events plus 5889 session-log events at OFFSET=16 returned zero outliers; the previous OFFSET=15 was a never-HP-verified deduction. The shift was retired, `MobsDatabase.OFFSET` is 16, and `getLivingHarvestTier` reduces to `mob.t`. The PR also ships diagnostic plumbing: `Show DB Name` overlay (`settingLivingResourcesName`), `CritterCorpseTierAudit` log, and the `tools/offset-validate` Go binary so the next DB refresh can re-anchor the offset in one command.

### Render-time filter for living and DEAD (#82, closes #32, #30)

The spawn-time filter that dropped living resources when a setting was off has been replaced by a per-frame render gate. Toggling a setting now affects display without waiting for new spawns. DEAD carcasses are explicitly routed through the Living filter (verified by user test 2026-04-24): a corpse is part of the same critter family as the alive variant, not a static node. `LivingResourceFilter.js` exports `shouldRenderLivingResource` and `shouldRenderStaticResource` via a shared `resolveSettingsCell`.

### Static and edge fixes

- `mobileTypeId === -1` treated as static, since `-1` is the int16 decode of `0xFFFF` sentinel (#71, HARV-1).
- `Parameters[3]` type guard in `addChestEvent`: undefined or non-string values fall through cleanly (#72).
- Re-gate reads the stored `mobileTypeId` instead of hardcoding `isLiving=false`. Living Fiber critters no longer drop when static Hide settings are disabled (#74, HARV-3).
- Chest rarity persisted from `Parameters[5]` on the entity (#75, CHEST-2). The drawing layer does not yet consume it: rarity badge wiring is a follow-up. The source identification of the rarity slot itself stays open (CHEST-1).
- `map.isBZ` derived from `zonesDatabase.getPvpType(mapId)` instead of attempting to parse the (now hashtable-shaped) `Parameters[103]` directly (#87, closes #57). `ROUTER-1` `test.fails` for direct hashtable parse remains as a follow-up.
- Mists instance pvpType inherits from the parent cluster: a Mist clone keyed by `@MISTS@<guid>` carries the BZ/YZ classification of the cluster the player came from. Faction or hostile alarms fire correctly in BZ Mists; Yellow Royal Mists no longer trip the alarm (#103, closes #90). Override persisted to `sessionStorage`.

### LAN access (#88)

The frontend builds the WebSocket URL from `window.location` instead of `ws://localhost:5001/ws`. A phone or second laptop loading `http://<server-ip>:5001` gets a working radar without configuration. The startup banner prints the LAN URL alongside `localhost` when the host adapter has a routable RFC1918 IP. A `_WebSocketManager.test.js` covers the four URL shapes (localhost, RFC1918, https, no port).

A minimal mobile responsive pass made every page usable at 375x667 portrait: no horizontal scrollbars, canvas readable, settings forms collapse correctly. Not a redesign, just a sanity baseline.

### UI polish (#105, closes #98)

- **Icon Size slider** (0.5x to 2.0x) scales markers and circles, not text or healthbars.
- **Resource Color Badges** toggle replaces the single-dot indicator with a colored tier square per resource family (Fiber green, Hide tan, Wood brown, Ore blue, Rock purple), plus a gold border on living variants.
- **Hostile NPC circle radius** tightened from 7 to 6 to match the visual weight of the new badges.
- **Collapsible Network card** in the radar overlay; state persists across navigation.

### Stability and shutdown (#63)

- `pcap.BlockForever` swapped for a 500 ms timeout so an idle close unblocks instead of hanging on a goroutine still polling.
- Handle close ordering: cancel context, wait, only then close. libpcap is unsafe to close while `Read` is in flight.
- TUI dashboard panic on first `LogMsg` arriving before `WindowSizeMsg` guarded: drop the log instead of calling `SetContent` on an unsized viewport.
- Reproduced the original deadlock on 2.1.1 and confirmed clean exit on the fix.

### Test harness (#68)

351 frontend tests across 14 suites. The discipline is `@verified`, `@characterization`, `test.fails`: 252 verified, 10 characterization, 1 test.fails at the close of the cycle. 16 pcap-derived scenarios shipped, all PII-scrubbed. Tools added in the same PR:

- `tools/anonymize-pcap`: scrubs MAC, IP, timestamps, optional `--scrub-string` for the local player name.
- `tools/photon-dump`: extracts per-scenario fixtures from a live pcap, both as `.pcap` fragments and as WS-level JSON matching the EventRouter dispatch format.
- `tools/gen-eventcodes`: regenerates Go mirrors from the JS source files.
- `tools/offset-validate`: anchors the TypeID OFFSET against a fresh DB.

Bugs pinned by `test.fails` at the start of the cycle: HARV-1/2/3, PLAY-1/2, CHEST-1/2, FISH-1, ROUTER-1..9. By release time, only PLAY-1, PLAY-2, ROUTER-1, and CHEST-1 remain open.

### Embed safety (#86)

17 test files renamed to `_*.test.js`. Go embed's default rule excludes `_*` so the production binary cannot ship test artifacts. Production binary trimmed by 347 KB. `embed_prod_test.go` walks the embed FS at test time and asserts no fixture or test file landed. CI guard rejects unprefixed `*.test.js`.

## Detection details

| System | Status | Notes |
|---|---|---|
| Resources | working | static and living, T1-T8, enchantments, render-time filter post #82 |
| Mobs | working | OFFSET=16 confirmed, color-coded threat |
| Players | working | faction detection, zone-aware alerts (Mist instances inherit parent pvpType post #103), ignore list |
| Mists | working | portals, feu follets, wisp cages |
| Dungeons | working | per-enchant filters working again across every family. Solo, Group, Corrupted, Hellgate plus the five group families that #78 unblocked: T6_MORGANA, T6_KEEPER, T6_UNDEAD, T5_PORTAL_ROYAL_SOLO, T6_PORTAL. Per-type filter and a dungeon database stay on the v2.3 backlog. |
| Chests | basic | rarity persisted on the entity (#75); drawing-layer color resolution and the rarity source slot itself are follow-ups |
| Fishing | working | issue #25 closed via #73 (empty-string spawn type accepted) and #85 (render-time gate). Spawns detected and interpolated. Event 61 (end-of-fishing) is logged but not yet visualized; that is the only remaining gap. |

## Migration notes

- `ip.txt` is replaced by `network.json`. Migration runs once on first boot if `ip.txt` exists; the file is deleted afterwards.
- `localStorage.settingServerLogsEnabled` is overwritten by the value from `network.json` on the first settings page load. The toggle state carries over without user action.
- The `/api/settings/server-logs` endpoint is replaced by `/api/settings/logging` (GET and POST). Old single-toggle clients break; none are in the wild.
- `protocol16.go` is gone. The deserializer is now a cluster: `deserializer.go`, `packet.go`, `events.go`, `readers.go`, `types.go`, `typecodes.go`.

## Known limitations

- Player live positions stay encrypted (XOR with a KeySync `XorCode` itself wrapped by Photon AES). Out of scope without a MITM proxy. See `docs/technical/PLAYER_POSITIONS_MITM.md`.
- Some Black Zone map tiles missing for zone IDs 4000+. Workaround: disable the map background in settings.
- Event 46 (`HarvestableChangeState`) occasionally skips size values (e.g. 3 -> 1) or fires late, depending on server batching and network conditions. The radar reflects whatever the wire delivers; intermediate states that the server skipped are unrecoverable. See `docs/technical/HARVEST_EVENTS.md`.

## What's next

`docs/project/TODO.md` carries the v2.3 backlog. Priority: a dungeons database with per-type filter (Solo, Group, Corrupted, Hellgate, Avalonian), Chests rarity source identification (CHEST-1) plus drawing-layer wiring, end-of-fishing visualization (event 61), Mists cluster id routing (events 518/519/520/529 reach the frontend but no handler consumes them).
