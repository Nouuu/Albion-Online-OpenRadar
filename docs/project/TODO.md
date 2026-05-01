# OpenRadar Roadmap

**Version**: 2.2.0
**Last update**: 2026-05-01

## Detection systems status

| System | Status | Notes |
|---|---|---|
| Resources | working | database-driven, cleanup, filtering, T1-T8 with enchantments, render-time gate (#82) |
| Mobs | working | OFFSET=16 confirmed (#93), 9 classifications, color-coded threat |
| Players | working | faction detection, zone-aware alerts, ignore list, Mist instance pvpType inherits parent (#103) |
| Zones | working | PvP type detection, threat logic |
| Mists | working | portals, feu follets, wisp cages (see `docs/technical/MISTS_DETECTION.md`) |
| Dungeons | working | per-enchant filters working across every family. Solo, Group, Corrupted, Hellgate plus the five group families unblocked by #78 (T6_MORGANA, T6_KEEPER, T6_UNDEAD, T5_PORTAL_ROYAL_SOLO, T6_PORTAL). Per-type filter and a dungeons database stay open. |
| Chests | basic | rarity persisted on entity (#75); drawing-layer color resolution and rarity source slot still open |
| Fishing | working | issue #25 closed via #73 + #85. Event 61 (end-of-fishing) logged but not visualized. |

## v2.3 backlog

### Detection completion

- [ ] **Dungeons**: create `DungeonsDatabase.js` (types, tiers, difficulties), per-type filtering in settings, stale entity cleanup.
- [ ] **Chests**: rarity drawing-layer wiring (CHEST-2 stored the value at #75, drawing still does substring matches on `chestName`). Plus identify the real rarity source slot (CHEST-1): current `Parameters[5]` is 4 for Mists treasure, 8 for FactionWarfare, never lands in 0-3. Pcap capture across the four rarity levels needed before fixing.
- [ ] **Fishing**: end-of-fishing state, fishing zones on the radar.
- [ ] **Mists routing**: cases for events 518 (NewMistsImmediateReturnExit), 519 (MistsPlayerJoinedInfo), 520 (NewMistsStaticEntrance), 529 (MistsEntranceDataChanged) reach the frontend but no handler consumes them.

### Maps

- [ ] Black Zone map tiles extraction from the Albion client (zone IDs 4000+, 5000+).
- [ ] Map tile size normalization (fix stretching on small zones).
- [ ] Map centering optimization.

### Stability and performance

- [ ] Memory usage optimization for very long sessions.
- [ ] Black Zone portal transitions sometimes drop the cluster id.

### Other improvements

- [ ] Quality metrics dashboard.
- [ ] Configuration file support beyond `network.json`.

## Open observations from PR cycles

- **CHEST-1** (#29): rarity parameter source unidentified. `Parameters[5]` does not match the upstream 0-3 range across families: 4 for Mists treasure, 8 for FactionWarfare. Needs a multi-rarity pcap capture to find the real index.
- **MIST-2** (feu follet rarity location): every pcap fixture sample is Common (`Parameters[33]=0`). Live evidence on a "Peu commun" portal showed the rarity is actually carried; we still need a multi-rarity capture to find the slot.
- **MIST-4** (Mists cluster rarity): zone-level rarity lives in the `ChangeCluster` operation response `Parameters[3]` byte array, last byte. Plumbing it requires a Mists capture with opcode 41 response and a cluster-rarity store.
- **MIST-7** (cluster id routing): events 518, 519, 520, 529 carry the Mists cluster id but no handler consumes them. Follow-up PR to plumb a Mists state surface readable by drawings.
- **HARV-2** (living spawn with E0 off plus event 46 enchant update): #82 moved the gate to render-time, which fixes the user-visible toggle latency, but the underlying recovery from a depleted-then-regenerated state is not addressed. Pinned by `test.fails`.
- **PLAY-1** (#65): hostile in unknown zone does not fire the alert because `zonesDatabase.getPvpType(unknown)` falls back to `safe` and `isPlayerThreat(255, 'safe')` returns `false`. Pinned by `test.fails` in `PlayersHandler.test.js`.
- **PLAY-2** (#36): ignored player still triggers the alert when their faction changes to 255 in a red zone. Pinned by `test.fails`.
- **ROUTER-1** (#57): direct hashtable parse of `Parameters[103]` is a follow-up. The user-visible BZ alert symptom was resolved by deriving `map.isBZ` from `zonesDatabase.getPvpType(mapId)` (#87), which is the correct long-term path; the direct parse stays pinned in case a future change needs the raw value.
- **OPS-1..4**: four call sites in `EventRouter.js` hardcode opcodes whose upstream name does not match the local handler semantics (event 590 logs as `key_sync`, request 21 is the pre-Protocol18 Move opcode kept as legacy fallback, response 35 treated as map-change with debounce, response 137 is a probably-dead character-stats branch). Each carries a `FIXME ops-drift` comment. Resolution requires pcap-backed investigation.

## Tech debt

- **`NewHTTPServer` config struct**: signature is at 10 parameters after #91. Refactor to `NewHTTPServer(cfg HTTPServerConfig)` to keep the call site readable as more wiring lands. Estimate: 1h.
- **Aggregate `pcap.Stats` across handles**: the per-30s kernel-drop log line was removed when the multi-interface manager replaced the single capturer (commit `fedb2c4e`, replaced by `// TODO(#91)` in `cmd/radar/main.go:updateStats`). Restore by adding `Manager.Stats() map[string]*pcap.Stats` and logging deltas. Helps in-prod debugging of capture loss. Estimate: 2h.
- **TUI awaiting-state banner**: when all opens fail at boot, the warn-log is the only signal. The settings page banner shows the state, the TUI does not. Estimate: 30m.
- **`window.EnemyType` ESM cleanup**: `RadarRenderer._collectClusterCandidates` and `MobsDrawing.invalidate` still read from `window.EnemyType` instead of the ESM `import {EnemyType}` already in scope. Pre-ESM-migration artefact, low risk. Estimate: 30m.
- **`/api/settings/server-logs` removal**: replaced by `/api/settings/logging` in v2.2 (#107). Old endpoint returns 404. No clients in the wild known to use the old path; no compatibility shim shipped. Note in case of future bug reports.

## Permanent limitations

- **Player live positions**: encrypted via XOR with a KeySync `XorCode` itself wrapped by Photon AES. Out of scope without a MITM proxy. See `docs/technical/PLAYER_POSITIONS_MITM.md`.
- **Event 46 unreliability**: `HarvestableChangeState` occasionally skips size values or fires late depending on server batching. The radar reflects what the wire delivers; intermediate states the server skips are unrecoverable. Detail in `docs/technical/HARVEST_EVENTS.md`.
- **Some Black Zone maps**: tiles missing for zone IDs 4000+. Workaround: disable the map background in settings.
