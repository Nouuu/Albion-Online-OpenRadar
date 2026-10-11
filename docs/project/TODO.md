# OpenRadar Roadmap

**Last release**: 2.2.2
**Last update**: 2026-09-25

## Detection systems status

| System | Status | Notes |
|---|---|---|
| Resources | working | database-driven, T1-T8 with enchants, render-time filter gate. Family misclassification on some rich static nodes stays open (#100) |
| Mobs | working | typeIds re-anchored after the 2026-06-29 patch, 9 danger classes. Named non-portal mobs route to the hostile list since #160 |
| Players | working | faction, guild, alliance, equipment and item power. Ignore list gates the alerts since #161. Live positions are never drawn, see permanent limitations. Action markers show for 10 seconds where a player cast, mounted, teleported, respawned or was pushed |
| Zones | working | PvP type drives the alert gate. Roads of Avalon and the Mists forced to black |
| Mists | working | Solo and Duo portals with rarity, feu follets, wisp cages, Knightfall Abbey |
| Dungeons | working | per-type filters (Solo, Group, Corrupted, Hellgate) and per-enchant E0-E4. Avalonian families and per-difficulty filters still missing |
| Chests | basic | rarity is stored on the entity, the drawing layer does not colour by it yet (#29) |
| Fishing | working | spawns detected and drawn. The end-of-fishing event reaches the radar but is not visualized |

## Backlog

### Detection

- [ ] **Dungeons database** (`DungeonsDatabase.js`) for Avalonian families and per-difficulty filters.
- [ ] **Chest rarity on the radar** (#29). Two parts: find the real rarity slot, then wire it into the drawing.
      `Parameters[5]` is 4 for Mists treasure and 8 for FactionWarfare, never the upstream 0-3 range. Needs a capture
      across the four rarity levels.
- [ ] **Spell icons by id** (#166). `SpellsDatabase` resolves by array position, which drifts on every patch that
      inserts a spell. Same class of bug as the item catalog, fixed there by #162.
- [ ] **Mist closing timer** (#170).
- [ ] **Mist bosses and lairs** (#125, #127).
- [ ] **End-of-fishing state** and fishing zones on the radar.
- [ ] **Mists event routing**. Codes 520 `NewMistsImmediateReturnExit`, 522 `NewMistsStaticEntrance`,
      525 `NewMistsWispSpawn` and 531 `MistsEntranceDataChanged` reach the frontend and no handler consumes them. They
      carry the Mists cluster id.

### Maps

- [ ] Black Zone map tiles for zone IDs 4000+ and 5000+, extracted from the client.

### Platforms

- [ ] **macOS** (#151) and **Android** (#126). Both are open questions, not commitments. libpcap availability and
      permission models differ enough that neither is a port of the Windows path.

### Testing and stability

- [ ] **End-to-end suite**. Boot the binary, drive a browser, assert the WebSocket connects and an injected entity
      renders. Documented for a long time, never written. The SPA lifecycle regressions it would catch are currently
      covered only by unit tests and a manual pass.
- [ ] Memory profile over very long sessions.
- [ ] Black Zone portal transitions sometimes drop the cluster id.

## Open observations

Findings from PR cycles that need pcap-backed investigation before anyone can fix them.

- **Chest rarity slot** (#29). See backlog above.
- **Feu follet rarity slot**. Every fixture sample is Common (`Parameters[33]=0`). Live play shows an Uncommon portal
  labelled as such in game, so the rarity is carried somewhere. Needs a multi-rarity capture.
- **Mists cluster rarity**. Zone-level rarity lives in the `ChangeCluster` operation response `Parameters[3]` byte
  array, last byte. Plumbing it needs a Mists capture with the opcode 41 response and a cluster-rarity store.
- **Alert gate on unknown zones** (#65, closed but the behaviour stands). `zonesDatabase.getPvpType` falls back to
  `safe` for a zone it does not know, and `isPlayerThreat` returns false for `safe`, so a hostile in an unmapped zone
  fires nothing. Asserted as current behaviour in `_PlayersHandler.test.js`.
- **Depleted then regenerated harvestables**. Moving the enchant gate to render time (#82) fixed the visible toggle
  latency. Recovering the state of a node that was depleted and grew back is a separate problem, still untouched.
- **Opcode semantics drift**. Four call sites in `EventRouter.js` treat an upstream opcode differently from its
  upstream name: event 590 logged as `key_sync`, request 21 kept as a pre-Protocol18 Move fallback, response 35 handled
  as a map change with debounce, response 137 a probably-dead character-stats branch. Each needs a capture to settle.
- **`Parameters[103]` hashtable parse** (#57, closed). `map.isBZ` now derives from `zonesDatabase`, which is the right
  long-term path. The raw hashtable at `Parameters[103]` is still not parsed, in case something later needs the value.
- **`getAverageItemPower` slot filter**. It keeps `index <= 4 || index === 8`. Slot 8 is the potion slot, verified
  against 10390 equipment arrays. Potions carry no item power so the average is unaffected, but the renderer draws a
  potion icon in the equipment strip because of it.
- **Player health on a lethal hit**. `UpdatePlayerLooseHealth` copies HealthUpdate (event 6) `Parameters[3]`, the
  health after the hit, into `currentHealth`. The server omits a key whose value is 0, so a lethal hit carries no
  `Parameters[3]` and the player is left with `currentHealth` undefined. Measured on 21 captures across three eras.
- **HealthUpdates (event 7) never reaches players**. The router sends event 7 to `MobsHandler` only. It carries one
  target and parallel arrays with the event 6 layout, its entries never repeat in event 6, and it holds 195 of the
  839 damage entries on players in the same 21 captures, so the player health bar misses them.
- **Join response after the spawn snapshot**. In every city flow of the 2026-05-12 and 2026-09-03 captures the Join
  response arrives after the NewCharacter snapshot of its own flow (40 to 60 events), and the router clears the
  players on it. Live, `WebSocketEventQueue` runs responses at once and defers events to the next animation frame, so
  the snapshot survives when it shares the frame of the Join; a replay in wire order loses it.
- **Anonymizer blind spots**. `GvgSeasonUpdate` (352) carries guild names at `[3]` and `[5]` that `anonymize-pcap`
  keeps. The identity fields at codes 277, 294, 329 and 350 follow the current event table; in captures of May 2026
  and older those events sit two codes lower and are not scrubbed.
- **Players page info alert**. It says the radar detects who enters the zone but cannot display them on the map. With
  Show Player Actions on, the radar shows where a player just acted. The rewording needs a decision.
- **Buff-only support in a black zone**. The zone rule makes every player dangerous there, and the heal memory only
  learns from heals. A support that only buffs the local player raises `Attacking you` until spell target types
  resolve (#166).
- **Hits on a mounted local player**. In the 2026-10-10 mist fight, the attacker's first 3 hits on the mounted local
  player arrived as `MountHealthUpdate` (313), not as `HealthUpdate`, so damage alone does not flag an attacker while
  the local player rides. Its targeted casts and `Attack` still do.

## Tech debt

- **`NewHTTPServer` parameter list**. Ten parameters. Move to `NewHTTPServer(cfg HTTPServerConfig)` before the next
  piece of wiring lands.
- **Aggregate `pcap.Stats` across handles**. The per-30s kernel-drop log line went away when the multi-interface
  manager replaced the single capturer. Restoring it needs `Manager.Stats() map[string]*pcap.Stats`. Marked in
  `cmd/radar/main.go` as `TODO(#91)`. Useful for diagnosing capture loss in the field.
- **TUI banner for the awaiting state**. When every interface fails to open at boot, a warn log is the only signal.
  The settings page shows the state, the terminal dashboard does not.
- **`alreadyIgnoredPlayers`**. Dead field on `PlayersHandler`, nothing populates it. The ignore gate reads the setting
  the page actually writes (#161). Remove the field.
- **Page init runs twice on SPA arrival**. Every page script ends with
  `window.onGlobalsReady(() => reinitCurrentPage())` while `PageController` also inits on `htmx:afterSettle`. Both
  fire on arrival, and the second init resets the page `cleanup` array while the first set of listeners stays
  attached. Measured on the players page: after one round trip, a single click on the preview button fires the
  handler twice. Affects all seven pages, predates 2.2.3. Fix is one owner for the arrival init, not two.
- **`/api/settings/server-logs`**. Replaced by `/api/settings/logging` in 2.2. The old path returns 404 with no
  compatibility shim. Noted in case an old bug report mentions it.
- **`?? true` after `getBool` in `WebSocketEventQueue.js`**. `enableCoalescing` and `enableThrottling` read
  `window.settingsSync?.getBool(key, true) ?? true`. `getBool` already returns its `true` default for an unset key, so
  the trailing `?? true` acts only when `window.settingsSync` is missing, and `base.gohtml` sets it on every page.

## Permanent limitations

- **Player live positions**. Encrypted by XOR with a KeySync `XorCode` that is itself wrapped in Photon AES. Out of
  scope without a MITM proxy. See [PLAYER_POSITIONS_MITM.md](../technical/PLAYER_POSITIONS_MITM.md).
- **Event 46 timing**. `HarvestableChangeState` can skip sizes or arrive late depending on server batching. The radar
  shows what the wire delivers. See [HARVEST_EVENTS.md](../technical/HARVEST_EVENTS.md).
- **Missing Black Zone map tiles**. Zone IDs 4000+ have no background art in the shipped set. Turn the map background
  off in settings. Extraction is on the backlog above.
