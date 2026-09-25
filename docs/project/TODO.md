# OpenRadar Roadmap

**Last release**: 2.2.2
**Last update**: 2026-08-14

## Detection systems status

| System | Status | Notes |
|---|---|---|
| Resources | working | database-driven, T1-T8 with enchants, render-time filter gate. Family misclassification on some rich static nodes stays open (#100) |
| Mobs | working | typeIds re-anchored after the 2026-06-29 patch, 9 danger classes. Named non-portal mobs route to the hostile list since #160 |
| Players | working | faction, guild, alliance, equipment and item power. Ignore list gates the alerts since #161. Positions are never drawn, see permanent limitations |
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
- **Two owners for page arrival init**. `registerBoundPage` calls `reinitCurrentPage()` while `PageController` also
  inits on `DOMContentLoaded` and `htmx:afterSettle`. Every page now goes through `registerBoundPage`, which aborts the
  previous activation before it binds again, so listeners no longer double: the players preview button fires once per
  click after three SPA round trips. The init callback can still run twice on a full load, which only matters for init
  code with effects outside the abort signal. Radar `initRadar` is guarded by `isInitialized`. The reported "first click
  on the radar settings collapse does not stick" did not reproduce: it came from writing `localStorage` directly past
  the `settingsSync` cache, or from clicking during the HTMX swap before the binder ran. Fix is still one owner for
  the arrival init.
- **`/api/settings/server-logs`**. Replaced by `/api/settings/logging` in 2.2. The old path returns 404 with no
  compatibility shim. Noted in case an old bug report mentions it.
- **`npm run lint` crashes on every `.gohtml` file**. ESLint 10.11 with `eslint-plugin-html` 8.2 throws
  `Cannot read private member #ruleDefinitions` while linting any template, unrelated to file content. Reproduces on
  an untouched file. `npx eslint web/scripts/` alone still works.
- **Hidden PiP video adds 1 px to every page's scroll height**. `document.documentElement.scrollHeight` is
  `innerHeight + 1` on every viewport tested. Cause: the PictureInPictureManager appends a `<video
  style="position: absolute; ... width: 1px; height: 1px;">` directly to `<body>` with no `top` set, so its
  static position (and therefore its layout box) lands one line below the `.flex.h-dvh` wrapper, contributing
  1 px of overflow. Cosmetic, but it fails a byte-exact `scrollHeight <= innerHeight` check.

- **`enableCoalescing` reads `undefined` without `window.settingsSync`**. `WebSocketEventQueue.js` reads the global
  instead of importing `settingsSync`, so a failed module load turns coalescing off. Import it like every other
  consumer.
- **Sidebar init depends on the SettingsSync module graph**. `window.sidebar.init()` in `base.gohtml` reads
  `window.settingsSync`. If that module fails to load, init throws and `lucide.createIcons()` never runs, so the
  layout loses its icons.
- **Dead PiP resize listener**. `PictureInPictureManager.js` listens for `canvasSizeChanged` on `document`, while
  `RadarSettingsPanel.js` dispatches it on `window`. Harmless because `compositeFrame` resyncs the size every frame.
  Delete the listener.
- **`NetworkSettingsHandler.load()` has no try/catch**. Its two fetches are not guarded, so an unreachable backend
  throws an unhandled `TypeError` on every 5 s poll tick. `apply()` and `refresh()` already wrap their fetch in
  try/catch, `load()` does not.
- **Settings section collapse checkboxes have no accessible name**. The `<input type="checkbox"
  data-setting="settingUiSettings*Open">` toggles on the Logging, Debug and Network collapses on `/settings` carry no
  `aria-label` or `aria-labelledby`, and are not wrapped in a `<label>`. Same on `main`.

## Permanent limitations

- **Player live positions**. Encrypted by XOR with a KeySync `XorCode` that is itself wrapped in Photon AES. Out of
  scope without a MITM proxy. See [PLAYER_POSITIONS_MITM.md](../technical/PLAYER_POSITIONS_MITM.md).
- **Event 46 timing**. `HarvestableChangeState` can skip sizes or arrive late depending on server batching. The radar
  shows what the wire delivers. See [HARVEST_EVENTS.md](../technical/HARVEST_EVENTS.md).
- **Missing Black Zone map tiles**. Zone IDs 4000+ have no background art in the shipped set. Turn the map background
  off in settings. Extraction is on the backlog above.
