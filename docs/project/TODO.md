# OpenRadar Roadmap

**Version**: 2.2.0
**Last update**: 2026-05-01

## Detection systems status

| System | Status | Notes |
|---|---|---|
| Resources | working | database-driven, cleanup, filtering, T1-T8 with enchantments |
| Mobs | working | database-driven, 9 classifications, color-coded threat |
| Players | working | faction detection, zone-aware alerts, ignore list |
| Zones | working | PvP type detection, threat logic |
| Mists | working | portals, feu follets, wisp cages (see `docs/technical/MISTS_DETECTION.md`) |
| Dungeons | basic | shows on radar, no database, no per-rarity filter |
| Chests | basic | shows on radar, rarity slot under investigation (CHEST-1) |
| Fishing | partial | spots detected, end-of-fishing event not in current corpus |

## v2.3 backlog

### Detection completion

- [ ] Dungeons: create `DungeonsDatabase.js` (types, tiers, difficulties), per-type filtering in settings, stale entity cleanup.
- [ ] Chests: create `ChestsDatabase.js`, fix the rarity parameter source (currently `Parameters[5]` does not match the upstream 0-3 range across families: Mists treasure carries 4, FactionWarfare carries 8). Pcap capture across the four rarity levels needed before fixing.
- [ ] Fishing: complete `FishingHandler.js`, add fishing zones on the radar, end-of-fishing state.
- [ ] Mists routing: cases for events 518 (NewMistsImmediateReturnExit), 519 (MistsPlayerJoinedInfo), 520 (NewMistsStaticEntrance), 529 (MistsEntranceDataChanged) reach the frontend but no handler consumes them.

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

- **CHEST-1** (#29): rarity parameter source needs a multi-rarity pcap to identify the real index. Current `Parameters[5]` is 4 for Mists treasure, 8 for FactionWarfare, and never lands in 0-3. Out of scope for prior PRs.
- **MIST-7**: events 518/519/520/529 carry the Mists cluster id but no handler consumes them. Follow-up PR to plumb a Mists state surface.
- **PLAY-1** (#65): hostile in unknown zone does not fire the alert because `zonesDatabase.getPvpType(unknown)` falls back to `safe` and `isPlayerThreat(255, 'safe')` returns `false`. Pinned by `test.fails` in `PlayersHandler.test.js`.
- **PLAY-2** (#36): ignored player still triggers the alert when their faction changes to 255 in a red zone. Pinned by `test.fails`.
- **OPS-1..4**: four call sites in `EventRouter.js` hardcode opcodes whose upstream name does not match the local handler semantics (590, 21, 35, 137). Each carries a `FIXME ops-drift` comment. Resolution requires pcap-backed investigation.

## Tech debt

- **`NewHTTPServer` config struct**: signature is at 10 parameters after #91. Refactor to `NewHTTPServer(cfg HTTPServerConfig)` to keep the call site readable as more wiring lands. Estimate: 1h.
- **Aggregate `pcap.Stats` across handles**: the per-30s kernel-drop log line was removed when the multi-interface manager replaced the single capturer (commit `fedb2c4e`, replaced by `// TODO(#91)` in `cmd/radar/main.go:updateStats`). Restore by adding `Manager.Stats() map[string]*pcap.Stats` and logging deltas. Helps in-prod debugging of capture loss. Estimate: 2h.
- **TUI awaiting-state banner**: when all opens fail at boot, the warn-log is the only signal. The settings page banner shows the state, the TUI does not. Estimate: 30m.
- **`window.EnemyType` ESM cleanup**: `RadarRenderer._collectClusterCandidates` and `MobsDrawing.invalidate` still read from `window.EnemyType` instead of the ESM `import {EnemyType}` already in scope. Pre-ESM-migration artefact, low risk. Estimate: 30m.

## Live validation pending

- **#91 ExitLag smoke**: activate ExitLag's free trial and verify radar continuity in the four cases A/B/C/D documented in `docs/technical/CAPTURE_INTERFACES.md`. If Case D (NDIS LWF swallows packets) materializes, open a follow-up issue for WFP-level capture investigation.

## Permanent limitations

- **Player live positions**: encrypted via XOR with a KeySync XorCode itself wrapped by Photon AES. Out of scope without a MITM proxy. See `docs/technical/PLAYER_POSITIONS_MITM.md`.
- **Resource charges**: server applies harvest bonuses that are not on the wire. Display can drift by a charge.
- **Some Black Zone maps**: tiles missing for zone IDs 4000+. Workaround: disable map background in settings.
