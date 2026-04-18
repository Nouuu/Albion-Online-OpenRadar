# Handlers Characterization Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **PATCHED on 2026-04-18 after parallel work realignment.**
>
> Infrastructure tasks (Vitest install, config, first test) are **done** as a side effect of PR #51 (Protocol18 port):
>
> - `vitest.config.js` exists at repo root, uses `happy-dom` environment, include pattern `web/scripts/**/*.test.js`
> - `package.json` has `"test": "vitest run"`, `"test:watch"`, `"test:coverage"`
> - First frontend test already co-located at `web/scripts/core/EventRouter.test.js` (11 tests, acts as reference template)
> - Stubs pattern is inline `vi.fn()` per test, not a shared setup file
>
> Consequences for this plan:
>
> - **Delete original Tasks 1 to 7 (infrastructure).** They are already satisfied.
> - **Change test location convention.** Tests are co-located next to the source they cover (for example `HarvestablesHandler.test.js` sits next to `HarvestablesHandler.js`). Drop the `web/scripts/__tests__/handlers/` structure.
> - **Drop jsdom.** Use `happy-dom` to match project convention.
> - **Keep the scenario count and labels** (`@verified` / `@characterization` / `@suspect`).
> - **Stop-and-discuss rule** on suspected bugs still applies.
> - **Fixtures location:** create `web/scripts/__fixtures__/ws/<handler>/<scenario>.json` when needed. Do not put fixtures next to the source file.
>
> Re-number tasks below: new Task 1 is the former Task 8 (Read PlayersHandler), tasks are renumbered -7. Total tasks goes from 42 to 35.

| Field | Value |
|---|---|
| Status | Active, top of queue after realignment |
| Created | 2026-04-12 |
| Patched | 2026-04-18 |
| Priority | High (retroactive safety net) |
| Depends on | None (infrastructure already done by PR #51) |
| Blocks | `2026-01-15-living-harvestables-fix-design.md` (which builds on HarvestablesHandler tests) |
| User action required | Yes, stop-and-discuss on every suspected anomaly |
| GitHub interaction | None, user on standby |

**Goal:** Write 25 to 30 characterization tests covering the critical behaviors of `PlayersHandler`, `HarvestablesHandler`, and `MobsHandler`, so that future refactors or game updates that change handler behavior fail loudly instead of silently regressing. Infrastructure (Vitest + happy-dom) is already in place.

**Architecture:** Vitest plus happy-dom, tests co-located next to source as `<Handler>.test.js` (matching the existing `EventRouter.test.js` convention), fixtures of real Photon-derived WebSocket messages stored under `web/scripts/__fixtures__/ws/<handler>/`, inline `vi.fn()` stubs per test, tests labeled `@verified`, `@characterization`, or `@suspect` to make confidence explicit, stop-and-discuss rule on every failing assertion.

**Tech Stack:** Vitest 4.x, happy-dom, ES modules native, Node 20+, no bundler. Tests are co-located `.js` files.

---

## Context

The project has zero frontend tests. The three main handlers total 1735 lines (Players 384, Harvestables 639, Mobs 712) and have an accumulated history of regressions (issues #30, #32, #36, faction parameter misalignment, coalescing on harvest events). Forward TDD on new changes protects new code, but leaves the existing codebase vulnerable to any refactor or game update.

This plan posts a retroactive safety net: characterization tests on the three handlers, with explicit confidence labels and a stop-and-discuss rule on every anomaly so that suspected bugs never silently shape the test suite.

Non-goals:

- No new feature in any handler.
- No refactor of any handler.
- No exhaustive coverage. Budget is 30 scenarios max, first pass only.
- No test on RadarRenderer, Drawings, or Canvas internals (out of scope).
- No test on EventRouter.js routing logic (deferred to the photon event codes refresh plan).
- No fix of any bug discovered. Stop and discuss, decide later.

---

## File structure

### New files

```
vitest.config.js                                 # Vitest config, jsdom environment
web/scripts/__tests__/
├── setup.js                                     # Global stubs for window.* dependencies
├── fixtures.js                                  # Fixture loader helper
├── handlers/
│   ├── README.md                                # Counter of verified/characterization/suspect tests
│   ├── PlayersHandler/
│   │   ├── passive-player-spawn.test.js
│   │   ├── faction-player-spawn.test.js
│   │   ├── hostile-player-spawn.test.js
│   │   ├── mounted-player-spawn.test.js
│   │   ├── faction-change.test.js
│   │   ├── equipment-change.test.js
│   │   ├── health-update.test.js
│   │   ├── player-leave.test.js
│   │   ├── local-player-position.test.js
│   │   └── stale-cleanup.test.js
│   ├── HarvestablesHandler/
│   │   ├── static-spawn-batch.test.js
│   │   ├── static-spawn-individual.test.js
│   │   ├── living-spawn.test.js
│   │   ├── size-decrement.test.js
│   │   ├── size-regeneration.test.js
│   │   ├── depletion.test.js
│   │   ├── harvest-finished.test.js
│   │   ├── enchant-update-living.test.js
│   │   ├── living-vs-static-discrimination.test.js
│   │   ├── stale-cleanup.test.js
│   │   └── filtering-by-settings.test.js
│   └── MobsHandler/
│       ├── normal-mob-spawn.test.js
│       ├── enchanted-mob-spawn.test.js
│       ├── elite-mob-spawn.test.js
│       ├── boss-mob-spawn.test.js
│       ├── mob-move.test.js
│       ├── mob-health-update.test.js
│       ├── mob-health-bulk-update.test.js
│       ├── mob-enchant-update.test.js
│       ├── mob-regen-coalesced.test.js
│       └── mob-leave.test.js
└── __fixtures__/
    └── ws/
        ├── players/        # One JSON per scenario
        ├── harvestables/
        └── mobs/
```

### Files modified

```
package.json                                     # Add vitest, jsdom, test script
.gitignore                                       # Ignore coverage/ if vitest coverage is used
```

### Files untouched

- All `web/scripts/handlers/*.js` (tests read the handlers, never patch them).
- All `web/scripts/core/*.js`.
- All `internal/**/*.go`.
- All existing docs except `docs/project/IMPROVEMENTS.md` (appended when `@suspect` tests need a bug entry).

---

## Test workflow template

Every scenario task in this plan follows the same six-step loop. The loop is written out here once and referenced by task names.

**Step 1. Read the target method(s) in full.** Scope of reading is the method body plus any helper it calls in the same file. Write the intent as a 2-line comment at the top of the test file.

**Step 2. Build the fixture JSON.** First-pass fixtures are synthetic, derived from `docs/claude-resources/data-flow-details.md` and from direct reading of the Go parser in `internal/photon/protocol16.go`. Location: `web/scripts/__tests__/__fixtures__/ws/<handler>/<scenario>.json`. Format: array of objects `[{ eventCode, params }]`.

**Step 3. Write the test file.** Use the shared `loadFixture` helper, instantiate the real handler, replay the fixture through the documented entry method, assert the observable state (entity list contents, field values, presence or absence).

**Step 4. Run the test once.**

```
npm test -- <path-to-test-file>
```

Three outcomes possible:

1. **Passes immediately.** Intent matches code. Label `@verified`, proceed to Step 5.
2. **Fails on assertion.** Stop. Do not patch anything. Collect evidence on three hypotheses (wrong intent, wrong fixture, code bug). Present the three hypotheses and evidence to the user. Wait for decision. Then either fix intent, fix fixture, or commit as `@suspect` with buggy expectation and log in `IMPROVEMENTS.md`.
3. **Crashes with an error.** Investigate whether it is a missing stub, an import path issue, or a real code crash. Stop if it is a code crash.

**Step 5. Set the label.** The `it()` description starts with one of: `@verified YYYY-MM-DD: <reason>`, `@characterization YYYY-MM-DD: current code does X`, `@suspect YYYY-MM-DD: current code does X, expected Y because Z`. No exception.

**Step 6. Commit.** One scenario equals one commit. Message format: `test(handlers): characterize <HandlerName> <scenario>`.

Reference this workflow as "Standard workflow" below.

---

## Part 1. Infrastructure (Tasks 1 to 7)

### Task 1: Install Vitest and jsdom

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dev dependencies**

Run:
```
npm install --save-dev vitest@^2.1.0 jsdom@^25.0.0 @vitest/ui@^2.1.0
```
Expected: installs cleanly, no peer warning blockers. If a warning blocks, investigate before proceeding.

- [ ] **Step 2: Add test script to package.json**

Edit `package.json`, add to the `scripts` block:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 3: Verify install**

Run:
```
npx vitest --version
```
Expected: prints a version starting with `vitest/2.`.

- [ ] **Step 4: Commit**

```
git add package.json package-lock.json
git commit -m "test(infra): install vitest and jsdom"
```

### Task 2: Create vitest.config.js

**Files:**
- Create: `vitest.config.js`

- [ ] **Step 1: Write the config**

Create `vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['web/scripts/__tests__/setup.js'],
    include: ['web/scripts/__tests__/**/*.test.js'],
    reporters: ['default'],
  },
});
```

- [ ] **Step 2: Verify vitest picks up the config**

Run:
```
npx vitest run --reporter=verbose
```
Expected: reports "No test files found", not a config error. If a config error appears, fix it before proceeding.

- [ ] **Step 3: Commit**

```
git add vitest.config.js
git commit -m "test(infra): add vitest config with jsdom"
```

### Task 3: Create the shared setup file with global stubs

**Files:**
- Create: `web/scripts/__tests__/setup.js`

Handlers read from several `window.*` singletons. The setup file stubs them minimally so handlers can be instantiated without crashes. No stub is a mock, each stub is a neutral no-op that returns benign values.

- [ ] **Step 1: Write setup.js**

Create `web/scripts/__tests__/setup.js`:
```javascript
// Global stubs for handler tests. Neutral no-ops returning benign values.
// Handlers should be tested with the real implementation, only dependencies are stubbed.

globalThis.window = globalThis.window || {};

window.logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

window.settingsSync = {
  getBool: (_key, fallback = false) => fallback,
  getNumber: (_key, fallback = 0) => fallback,
  getJSON: (_key, fallback = null) => fallback,
};

// Minimal database stubs. Tests that need richer data can override.
window.itemsDatabase = {
  getItemById: () => null,
};

window.mobsDatabase = {
  getMobInfo: () => null,
  isMobLiving: () => false,
};

window.harvestablesDatabase = {
  isValidResource: () => true,
  getResourceName: (type, tier) => `${type}_${tier}`,
};

// Currency map ID used by players handler zone logic.
window.currentMapId = 'test-zone-safe';

// Toast stub used for UI notifications.
window.toast = {
  success: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
};
```

- [ ] **Step 2: Commit**

```
git add web/scripts/__tests__/setup.js
git commit -m "test(infra): add global stubs for handler tests"
```

### Task 4: Create the fixture loader helper

**Files:**
- Create: `web/scripts/__tests__/fixtures.js`

- [ ] **Step 1: Write the helper**

Create `web/scripts/__tests__/fixtures.js`:
```javascript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, '__fixtures__', 'ws');

/**
 * Load a fixture file as an array of {eventCode, params} entries.
 * Path is relative to web/scripts/__tests__/__fixtures__/ws/.
 * Example: loadFixture('players/passive-player-spawn.json')
 */
export function loadFixture(relativePath) {
  const fullPath = join(FIXTURES_ROOT, relativePath);
  const raw = readFileSync(fullPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Fixture ${relativePath} must be an array`);
  }
  return parsed;
}
```

- [ ] **Step 2: Commit**

```
git add web/scripts/__tests__/fixtures.js
git commit -m "test(infra): add fixture loader helper"
```

### Task 5: Create the sanity test

**Files:**
- Create: `web/scripts/__tests__/sanity.test.js`

This test proves the whole pipeline is alive: Vitest runs, jsdom is available, setup is loaded, fixtures can be read.

- [ ] **Step 1: Create a trivial fixture**

Create `web/scripts/__tests__/__fixtures__/ws/sanity.json`:
```json
[{"eventCode": 999, "params": {"0": 42}}]
```

- [ ] **Step 2: Write the sanity test**

Create `web/scripts/__tests__/sanity.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { loadFixture } from './fixtures.js';

describe('@verified 2026-04-12: test infrastructure sanity', () => {
  it('jsdom exposes window', () => {
    expect(typeof window).toBe('object');
  });

  it('setup stubs window.logger', () => {
    expect(typeof window.logger.debug).toBe('function');
  });

  it('fixture loader reads the sanity fixture', () => {
    const events = loadFixture('sanity.json');
    expect(events).toHaveLength(1);
    expect(events[0].eventCode).toBe(999);
    expect(events[0].params[0]).toBe(42);
  });
});
```

- [ ] **Step 3: Run it**

Run:
```
npm test -- web/scripts/__tests__/sanity.test.js
```
Expected: 3 passing, 0 failing, pipeline alive.

- [ ] **Step 4: Commit**

```
git add web/scripts/__tests__/sanity.test.js web/scripts/__tests__/__fixtures__/ws/sanity.json
git commit -m "test(infra): add sanity test proving pipeline alive"
```

### Task 6: Create the handler test counter README

**Files:**
- Create: `web/scripts/__tests__/handlers/README.md`

- [ ] **Step 1: Write the counter file**

Create `web/scripts/__tests__/handlers/README.md`:
```markdown
# Handler Tests Counter

Updated as each test lands. Rule: no commit of a handler test without also updating this counter.

| Handler | @verified | @characterization | @suspect | Total |
|---|---|---|---|---|
| PlayersHandler | 0 | 0 | 0 | 0 |
| HarvestablesHandler | 0 | 0 | 0 | 0 |
| MobsHandler | 0 | 0 | 0 | 0 |

## Suspect register

No entries yet. Each `@suspect` test gets an entry here and in `docs/project/IMPROVEMENTS.md`, cross-linked.
```

- [ ] **Step 2: Commit**

```
git add web/scripts/__tests__/handlers/README.md
git commit -m "test(handlers): add coverage counter README"
```

### Task 7: Add .gitignore entries

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append to .gitignore**

Edit `.gitignore`, append at the end:
```

# Test artifacts
/coverage/
```

- [ ] **Step 2: Commit**

```
git add .gitignore
git commit -m "chore(gitignore): ignore vitest coverage output"
```

Checkpoint: infrastructure is live. `npm test` passes the sanity test. Proceed to handler coverage.

---

## Part 2. PlayersHandler coverage (Tasks 8 to 18)

### Task 8: Read PlayersHandler in full

Rule 3 (hot-spot protection) requires reading the whole file before touching its tests.

- [ ] **Step 1: Read the handler**

Open `web/scripts/handlers/PlayersHandler.js`. Read from line 1 to 384. Identify:
- Entry points called by EventRouter: `handleNewPlayerEvent`, `handleMountedPlayerEvent`, `removePlayer`, `updatePlayerFaction`, `UpdatePlayerHealth`, `UpdatePlayerLooseHealth`, `updateItems`, `updateLocalPlayerPosition`.
- Internal state: `this.playerList` or similar Array.
- Faction detection logic: which `Parameters[X]` key is used.
- Zone-aware threat logic: how `window.currentMapId` is consulted.

Write a 10-line note at the bottom of `web/scripts/__tests__/handlers/PlayersHandler/_notes.md` (create the file) summarizing entry points and state fields. This note is pure memory aid, not a test.

- [ ] **Step 2: Commit the note**

```
git add web/scripts/__tests__/handlers/PlayersHandler/_notes.md
git commit -m "docs(tests): add PlayersHandler reading notes"
```

### Task 9: Scenario, new passive player spawn

**Files:**
- Create: `web/scripts/__tests__/__fixtures__/ws/players/passive-player-spawn.json`
- Create: `web/scripts/__tests__/handlers/PlayersHandler/passive-player-spawn.test.js`
- Modify: `web/scripts/__tests__/handlers/README.md`

Apply the Standard workflow (6 steps described earlier).

Intent: when `NewCharacter` arrives with `Parameters[53] = 0` (passive, unflagged), the handler adds the player to its list with `faction = 0` and `type = 'passive'`.

- [ ] **Step 1: Build the fixture**

Create `web/scripts/__tests__/__fixtures__/ws/players/passive-player-spawn.json`:
```json
[
  {
    "eventCode": 29,
    "params": {
      "0": 12345,
      "1": "TestPlayerName",
      "8": [100.0, 200.0],
      "53": 0,
      "252": 29
    }
  }
]
```

Note: the actual parameter positions must be verified from `handleNewPlayerEvent` source. If the code reads other indices, adjust the fixture before writing the test.

- [ ] **Step 2: Write the test**

Create `web/scripts/__tests__/handlers/PlayersHandler/passive-player-spawn.test.js`:
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { PlayersHandler } from '../../../handlers/PlayersHandler.js';
import { loadFixture } from '../../fixtures.js';

// Intent: NewCharacter with Parameters[53]=0 adds a passive player to the list.
// Source: PlayersHandler.handleNewPlayerEvent.

describe('PlayersHandler: passive player spawn', () => {
  let handler;

  beforeEach(() => {
    handler = new PlayersHandler();
  });

  it('@verified 2026-04-12: adds a player with faction=0 for passive NewCharacter', () => {
    const events = loadFixture('players/passive-player-spawn.json');
    for (const { params } of events) {
      handler.handleNewPlayerEvent(params[0], params);
    }
    const players = handler.getPlayerList ? handler.getPlayerList() : handler.playerList;
    expect(players).toHaveLength(1);
    expect(players[0].id).toBe(12345);
    expect(players[0].faction).toBe(0);
  });
});
```

- [ ] **Step 3: Run and observe**

Run:
```
npm test -- web/scripts/__tests__/handlers/PlayersHandler/passive-player-spawn.test.js
```

Three possible outcomes per Standard workflow Step 4. Follow the decision tree.

- [ ] **Step 4: Update counter**

Edit `web/scripts/__tests__/handlers/README.md`, increment the corresponding cell (`@verified`, `@characterization`, or `@suspect`) in the PlayersHandler row.

- [ ] **Step 5: Commit**

```
git add web/scripts/__tests__/__fixtures__/ws/players/passive-player-spawn.json \
        web/scripts/__tests__/handlers/PlayersHandler/passive-player-spawn.test.js \
        web/scripts/__tests__/handlers/README.md
git commit -m "test(handlers): characterize PlayersHandler passive player spawn"
```

### Task 10: Scenario, new faction-flagged player spawn

**Intent:** `NewCharacter` with `Parameters[53] = 1..6` adds a faction-flagged player with `faction` in the range 1-6.

**Files:** mirror structure of Task 9, swap names to `faction-player-spawn`.

**Fixture `__fixtures__/ws/players/faction-player-spawn.json`:**
```json
[
  {
    "eventCode": 29,
    "params": {
      "0": 12346,
      "1": "TestFactionPlayer",
      "8": [150.0, 250.0],
      "53": 3,
      "252": 29
    }
  }
]
```

**Test body (core assertion):**
```javascript
it('@verified 2026-04-12: adds a player with faction=3 for faction-flagged NewCharacter', () => {
  const events = loadFixture('players/faction-player-spawn.json');
  for (const { params } of events) {
    handler.handleNewPlayerEvent(params[0], params);
  }
  const players = handler.getPlayerList ? handler.getPlayerList() : handler.playerList;
  expect(players).toHaveLength(1);
  expect(players[0].faction).toBe(3);
});
```

- [ ] Apply Standard workflow steps 1 to 6.
- [ ] Commit: `test(handlers): characterize PlayersHandler faction player spawn`.

### Task 11: Scenario, new hostile player spawn

**Intent:** `Parameters[53] = 255` adds a hostile player, with `faction = 255`.

**Fixture `__fixtures__/ws/players/hostile-player-spawn.json`:**
```json
[
  {
    "eventCode": 29,
    "params": {
      "0": 12347,
      "1": "TestHostilePlayer",
      "8": [50.0, 75.0],
      "53": 255,
      "252": 29
    }
  }
]
```

**Test body:**
```javascript
it('@verified 2026-04-12: adds a player with faction=255 for hostile NewCharacter', () => {
  const events = loadFixture('players/hostile-player-spawn.json');
  for (const { params } of events) {
    handler.handleNewPlayerEvent(params[0], params);
  }
  const players = handler.getPlayerList ? handler.getPlayerList() : handler.playerList;
  expect(players).toHaveLength(1);
  expect(players[0].faction).toBe(255);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize PlayersHandler hostile player spawn`.

### Task 12: Scenario, mounted player spawn

**Intent:** `handleMountedPlayerEvent` spawns a player who is already mounted. Mount info is stored on the player entity.

**Fixture `__fixtures__/ws/players/mounted-player-spawn.json`:** to be built by reading `handleMountedPlayerEvent` body, identifying which params carry mount id, faction, and position.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: adds a mounted player with mount info stored', () => {
  const events = loadFixture('players/mounted-player-spawn.json');
  for (const { params } of events) {
    handler.handleMountedPlayerEvent(params[0], params);
  }
  const players = handler.getPlayerList ? handler.getPlayerList() : handler.playerList;
  expect(players).toHaveLength(1);
  expect(players[0].mount).toBeDefined();
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize PlayersHandler mounted player spawn`.

### Task 13: Scenario, faction change

**Intent:** `ChangeFlaggingFinished` updates an existing player's `faction` field. The event carries `playerId, newFaction`.

**Fixture `__fixtures__/ws/players/faction-change.json`:** two events, first a passive spawn, then a faction change to 255.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: updates player faction on ChangeFlaggingFinished', () => {
  const [spawn, change] = loadFixture('players/faction-change.json');
  handler.handleNewPlayerEvent(spawn.params[0], spawn.params);
  handler.updatePlayerFaction(change.params[0], change.params[1]);
  const players = handler.getPlayerList ? handler.getPlayerList() : handler.playerList;
  expect(players[0].faction).toBe(255);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize PlayersHandler faction change`.

### Task 14: Scenario, equipment change

**Intent:** `CharacterEquipmentChanged` updates the equipment list on an existing player.

**Fixture:** spawn + equipment change.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: updates equipment on CharacterEquipmentChanged', () => {
  const [spawn, equip] = loadFixture('players/equipment-change.json');
  handler.handleNewPlayerEvent(spawn.params[0], spawn.params);
  handler.updateItems(equip.params[0], equip.params);
  const players = handler.getPlayerList ? handler.getPlayerList() : handler.playerList;
  expect(players[0].items).toBeDefined();
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize PlayersHandler equipment change`.

### Task 15: Scenario, health update

**Intent:** `HealthUpdate` and `RegenerationHealthChanged` update an existing player's health. Test both.

**Fixture:** spawn + two health updates.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: updates player health on HealthUpdate', () => {
  const events = loadFixture('players/health-update.json');
  const [spawn, hp] = events;
  handler.handleNewPlayerEvent(spawn.params[0], spawn.params);
  handler.UpdatePlayerHealth(hp.params);
  const players = handler.getPlayerList ? handler.getPlayerList() : handler.playerList;
  expect(players[0].health).toBeDefined();
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize PlayersHandler health update`.

### Task 16: Scenario, player leave

**Intent:** `Leave` event removes a player from the list.

**Fixture:** spawn + leave.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: removes player on Leave event', () => {
  const [spawn, leave] = loadFixture('players/player-leave.json');
  handler.handleNewPlayerEvent(spawn.params[0], spawn.params);
  handler.removePlayer(leave.params[0]);
  const players = handler.getPlayerList ? handler.getPlayerList() : handler.playerList;
  expect(players).toHaveLength(0);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize PlayersHandler player leave`.

### Task 17: Scenario, local player position update

**Intent:** `updateLocalPlayerPosition(x, y)` stores the local player position on the handler, used for distance computations.

**No fixture needed** (direct method call with numeric arguments).

**Test body pattern:**
```javascript
it('@verified 2026-04-12: stores local player position', () => {
  handler.updateLocalPlayerPosition(100.5, 200.25);
  expect(handler.localPlayerX ?? handler.lpX).toBeCloseTo(100.5);
  expect(handler.localPlayerY ?? handler.lpY).toBeCloseTo(200.25);
});
```

Field names to be confirmed from PlayersHandler source. If the handler stores position in a different field, adjust the assertion after reading.

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize PlayersHandler local position`.

### Task 18: Scenario, stale cleanup

**Intent:** `cleanupStaleEntities(maxAgeMs)` removes players whose `lastUpdateTime` is older than `maxAgeMs`.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: removes players older than maxAgeMs', () => {
  const [spawn] = loadFixture('players/passive-player-spawn.json');
  handler.handleNewPlayerEvent(spawn.params[0], spawn.params);
  const players = handler.getPlayerList ? handler.getPlayerList() : handler.playerList;
  // Force stale
  players[0].lastUpdateTime = Date.now() - 999999;
  handler.cleanupStaleEntities(1000);
  const after = handler.getPlayerList ? handler.getPlayerList() : handler.playerList;
  expect(after).toHaveLength(0);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize PlayersHandler stale cleanup`.

Checkpoint: PlayersHandler coverage complete. Counter should show 10 total tests. Review counters with the user. Proceed to HarvestablesHandler only after user green light.

---

## Part 3. HarvestablesHandler coverage (Tasks 19 to 29)

### Task 19: Read HarvestablesHandler in full

- [ ] **Step 1: Read the handler**

Open `web/scripts/handlers/HarvestablesHandler.js`. Read lines 1 to 639. Identify:
- Entry points: `newSimpleHarvestableObject`, `newHarvestableObject`, `HarvestUpdateEvent`, `harvestFinished`, `removeHarvestable`, `getHarvestableList`, `cleanupStaleEntities`, `Clear`.
- State: `this.harvestablesList` or similar.
- Static vs living discrimination logic (search for `mobileTypeId` or `isLiving`).
- Size update logic in event 46 (`HarvestUpdateEvent`).
- Settings filtering (search for `settingsSync` calls).

- [ ] **Step 2: Write the notes file**

Create `web/scripts/__tests__/handlers/HarvestablesHandler/_notes.md` with a 15-line summary.

- [ ] **Step 3: Commit**

```
git add web/scripts/__tests__/handlers/HarvestablesHandler/_notes.md
git commit -m "docs(tests): add HarvestablesHandler reading notes"
```

### Task 20: Scenario, static batch spawn

**Intent:** `NewSimpleHarvestableObjectList` (event 39) adds multiple static resources at once. No enchant info at this stage. Charges undefined.

**Fixture `__fixtures__/ws/harvestables/static-spawn-batch.json`:** an array with one event 39 carrying 3 harvestables. Exact param shape to be determined by reading the method.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: adds 3 static harvestables from batch spawn', () => {
  const [batch] = loadFixture('harvestables/static-spawn-batch.json');
  handler.newSimpleHarvestableObject(batch.params);
  const list = handler.getHarvestableList();
  expect(list).toHaveLength(3);
  list.forEach(h => {
    expect(h.isLiving).toBe(false);
  });
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize HarvestablesHandler static batch spawn`.

### Task 21: Scenario, static individual spawn

**Intent:** `NewHarvestableObject` (event 40) adds a single static resource with full info (enchant, charges).

**Fixture:** one event 40 for a T6 WOOD enchant 0.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: adds a single T6 WOOD static harvestable', () => {
  const [spawn] = loadFixture('harvestables/static-spawn-individual.json');
  handler.newHarvestableObject(spawn.params[0], spawn.params);
  const list = handler.getHarvestableList();
  expect(list).toHaveLength(1);
  expect(list[0].tier).toBe(6);
  expect(list[0].isLiving).toBe(false);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize HarvestablesHandler static individual spawn`.

### Task 22: Scenario, living resource spawn

**Intent:** `NewHarvestableObject` for a living resource (HIDE, FIBER) spawns with `charges = 0` initially. The handler should mark it `isLiving = true` based on `mobileTypeId`, not `size`.

This scenario is the zone where issues #30 and #32 live. Extra attention on the expected field values.

**Fixture:** one event 40 carrying a T5 HIDE with `charges = 0` and a valid `mobileTypeId` field.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: adds a living T5 HIDE with isLiving=true even if charges=0', () => {
  const [spawn] = loadFixture('harvestables/living-spawn.json');
  handler.newHarvestableObject(spawn.params[0], spawn.params);
  const list = handler.getHarvestableList();
  expect(list).toHaveLength(1);
  expect(list[0].isLiving).toBe(true);
  expect(list[0].charges).toBe(0);
});
```

**Known risk:** this test may fail because of the bug documented in `2026-01-15-living-harvestables-fix-design.md`. In that case, stop and discuss. The test may end up as `@suspect` until the fix lands.

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize HarvestablesHandler living spawn`.

### Task 23: Scenario, size decrement via event 46

**Intent:** `HarvestableChangeState` with a new size lower than the current one decrements the harvestable size without removing it.

**Fixture:** spawn T7 WOOD with 10 charges, then event 46 with size 9.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: decrements charges on event 46 with lower size', () => {
  const [spawn, update] = loadFixture('harvestables/size-decrement.json');
  handler.newHarvestableObject(spawn.params[0], spawn.params);
  handler.HarvestUpdateEvent(update.params);
  const list = handler.getHarvestableList();
  expect(list).toHaveLength(1);
  expect(list[0].size ?? list[0].charges).toBe(9);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize HarvestablesHandler size decrement`.

### Task 24: Scenario, size regeneration via event 46

**Intent:** `HarvestableChangeState` with a size higher than current accepts the new value (resources regenerate in Albion).

**Fixture:** spawn with 5 charges, then event 46 with size 10.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: accepts higher size on event 46 (regeneration)', () => {
  const [spawn, update] = loadFixture('harvestables/size-regeneration.json');
  handler.newHarvestableObject(spawn.params[0], spawn.params);
  handler.HarvestUpdateEvent(update.params);
  const list = handler.getHarvestableList();
  expect(list[0].size ?? list[0].charges).toBe(10);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize HarvestablesHandler size regeneration`.

### Task 25: Scenario, depletion via event 46

**Intent:** `HarvestableChangeState` with `params[1] === undefined` removes the resource from the list.

**Fixture:** spawn + event 46 with no params[1].

**Test body pattern:**
```javascript
it('@verified 2026-04-12: removes harvestable on event 46 with undefined size', () => {
  const [spawn, update] = loadFixture('harvestables/depletion.json');
  handler.newHarvestableObject(spawn.params[0], spawn.params);
  handler.HarvestUpdateEvent(update.params);
  const list = handler.getHarvestableList();
  expect(list).toHaveLength(0);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize HarvestablesHandler depletion`.

### Task 26: Scenario, harvestFinished is a no-op

**Intent:** `harvestFinished` is called by EventRouter on event 61 but the actual state change comes from event 46. This test locks the fact that `harvestFinished` alone does not mutate the list.

**Fixture:** spawn + harvestFinished call only.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: harvestFinished does not mutate list by itself', () => {
  const [spawn, finished] = loadFixture('harvestables/harvest-finished.json');
  handler.newHarvestableObject(spawn.params[0], spawn.params);
  handler.harvestFinished(finished.params);
  const list = handler.getHarvestableList();
  expect(list).toHaveLength(1);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize HarvestablesHandler harvestFinished noop`.

### Task 27: Scenario, living enchant update via event 46

**Intent:** this is the second living-harvestables bug zone. A living resource spawns at `charges=0`, and event 46 later delivers the real enchant. The handler should update it correctly and not filter it out.

**Fixture:** living spawn at enchant 0, then event 46 updating enchant to 3.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: updates enchant on living resource via event 46', () => {
  const [spawn, enchantUpdate] = loadFixture('harvestables/enchant-update-living.json');
  handler.newHarvestableObject(spawn.params[0], spawn.params);
  handler.HarvestUpdateEvent(enchantUpdate.params);
  const list = handler.getHarvestableList();
  expect(list).toHaveLength(1);
  expect(list[0].enchant).toBe(3);
  expect(list[0].isLiving).toBe(true);
});
```

**Known risk:** also directly in the bug zone. Stop and discuss on any anomaly.

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize HarvestablesHandler living enchant update`.

### Task 28: Scenario, living vs static discrimination

**Intent:** the handler must distinguish living from static using `mobileTypeId` (historical regression hotspot: the wrong code used `size`).

**Fixture:** two events, one static spawn with no mobileTypeId, one living spawn with mobileTypeId set. Assert both are added with correct `isLiving` flags.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: distinguishes living vs static using mobileTypeId', () => {
  const [staticSpawn, livingSpawn] = loadFixture('harvestables/living-vs-static-discrimination.json');
  handler.newHarvestableObject(staticSpawn.params[0], staticSpawn.params);
  handler.newHarvestableObject(livingSpawn.params[0], livingSpawn.params);
  const list = handler.getHarvestableList();
  expect(list).toHaveLength(2);
  const staticOne = list.find(h => h.id === staticSpawn.params[0]);
  const livingOne = list.find(h => h.id === livingSpawn.params[0]);
  expect(staticOne.isLiving).toBe(false);
  expect(livingOne.isLiving).toBe(true);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize HarvestablesHandler living vs static`.

### Task 29: Scenario, stale cleanup

**Intent:** `cleanupStaleEntities` removes harvestables with old `lastUpdateTime`. Symmetric to Task 18 for players.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: removes stale harvestables', () => {
  const [spawn] = loadFixture('harvestables/static-spawn-individual.json');
  handler.newHarvestableObject(spawn.params[0], spawn.params);
  const list = handler.getHarvestableList();
  list[0].lastUpdateTime = Date.now() - 999999;
  handler.cleanupStaleEntities(1000);
  expect(handler.getHarvestableList()).toHaveLength(0);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize HarvestablesHandler stale cleanup`.

Checkpoint: HarvestablesHandler coverage complete. Counter should show 10 additional tests (20 total). Review with user before MobsHandler.

---

## Part 4. MobsHandler coverage (Tasks 30 to 39)

### Task 30: Read MobsHandler in full

- [ ] **Step 1: Read the handler**

Open `web/scripts/handlers/MobsHandler.js`. Read lines 1 to 712. Identify:
- Entry points: `NewMobEvent`, `updateMobPosition`, `updateMobHealth`, `updateMobHealthBulk`, `updateMobHealthRegen`, `updateEnchantEvent`, `removeMob`, `debugLogMobById`.
- Mist-specific methods: `updateMistPosition`, `removeMist`.
- State: `this.mobList` or similar, plus mist storage.
- Threat tier classification (green/purple/orange/red).

- [ ] **Step 2: Write notes**

Create `web/scripts/__tests__/handlers/MobsHandler/_notes.md`.

- [ ] **Step 3: Commit**

```
git add web/scripts/__tests__/handlers/MobsHandler/_notes.md
git commit -m "docs(tests): add MobsHandler reading notes"
```

### Task 31: Scenario, normal mob spawn

**Intent:** `NewMob` event with a green-tier mob adds it with the normal threat category.

**Fixture:** one event carrying a standard mob.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: adds a normal mob with green threat', () => {
  const [spawn] = loadFixture('mobs/normal-mob-spawn.json');
  handler.NewMobEvent(spawn.params);
  const mobs = handler.getMobList ? handler.getMobList() : handler.mobList;
  expect(mobs).toHaveLength(1);
  expect(mobs[0].threatLevel ?? mobs[0].type).toMatch(/normal|green/i);
});
```

Field names to confirm from source.

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize MobsHandler normal mob spawn`.

### Task 32: Scenario, enchanted mob spawn

**Intent:** `NewMob` event with an enchanted mob (enchant > 0) adds it with the purple threat category.

**Fixture `__fixtures__/ws/mobs/enchanted-mob-spawn.json`:** one event 123 (NewMob) carrying a mob with enchant 2.

**Test body:**
```javascript
it('@verified 2026-04-12: adds an enchanted mob with purple threat', () => {
  const [spawn] = loadFixture('mobs/enchanted-mob-spawn.json');
  handler.NewMobEvent(spawn.params);
  const mobs = handler.getMobList ? handler.getMobList() : handler.mobList;
  expect(mobs).toHaveLength(1);
  expect(mobs[0].enchant).toBeGreaterThan(0);
  expect(mobs[0].threatLevel ?? mobs[0].type).toMatch(/enchanted|purple/i);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize MobsHandler enchanted mob spawn`.

### Task 33: Scenario, elite mob spawn

**Intent:** veteran/elite mobs (high XP/rare category) are classified as orange threat.

**Fixture `__fixtures__/ws/mobs/elite-mob-spawn.json`:** one event carrying a known elite mob type id. Mob id must correspond to a veteran or elite entry in `MobsDatabase`. The test overrides `window.mobsDatabase.getMobInfo` to return `{ category: 'elite' }` for the relevant type id.

**Test body:**
```javascript
it('@verified 2026-04-12: adds an elite mob with orange threat', () => {
  const originalGet = window.mobsDatabase.getMobInfo;
  window.mobsDatabase.getMobInfo = () => ({ category: 'elite', isLiving: false });
  try {
    const [spawn] = loadFixture('mobs/elite-mob-spawn.json');
    handler.NewMobEvent(spawn.params);
    const mobs = handler.getMobList ? handler.getMobList() : handler.mobList;
    expect(mobs).toHaveLength(1);
    expect(mobs[0].threatLevel ?? mobs[0].type).toMatch(/elite|orange/i);
  } finally {
    window.mobsDatabase.getMobInfo = originalGet;
  }
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize MobsHandler elite mob spawn`.

### Task 34: Scenario, boss mob spawn

**Intent:** bosses are classified as red threat.

**Fixture `__fixtures__/ws/mobs/boss-mob-spawn.json`:** one event carrying a boss mob type id. Same override pattern as Task 33, returning `{ category: 'boss' }`.

**Test body:**
```javascript
it('@verified 2026-04-12: adds a boss mob with red threat', () => {
  const originalGet = window.mobsDatabase.getMobInfo;
  window.mobsDatabase.getMobInfo = () => ({ category: 'boss', isLiving: false });
  try {
    const [spawn] = loadFixture('mobs/boss-mob-spawn.json');
    handler.NewMobEvent(spawn.params);
    const mobs = handler.getMobList ? handler.getMobList() : handler.mobList;
    expect(mobs).toHaveLength(1);
    expect(mobs[0].threatLevel ?? mobs[0].type).toMatch(/boss|red/i);
  } finally {
    window.mobsDatabase.getMobInfo = originalGet;
  }
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize MobsHandler boss mob spawn`.

### Task 35: Scenario, mob move (position update)

**Intent:** `updateMobPosition(id, x, y)` updates the mob's target position, used by the Drawing for interpolation.

**Test body pattern:**
```javascript
it('@verified 2026-04-12: updates mob target position on Move event', () => {
  const [spawn] = loadFixture('mobs/normal-mob-spawn.json');
  handler.NewMobEvent(spawn.params);
  const mobs = handler.getMobList ? handler.getMobList() : handler.mobList;
  const mobId = mobs[0].id;
  handler.updateMobPosition(mobId, 500, 600);
  expect(mobs[0].posX ?? mobs[0].targetX).toBe(500);
  expect(mobs[0].posY ?? mobs[0].targetY).toBe(600);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize MobsHandler mob move`.

### Task 36: Scenario, mob health update

**Intent:** `updateMobHealth(Parameters)` updates a mob's current health field after it takes damage.

**Fixture `__fixtures__/ws/mobs/mob-health-update.json`:** a spawn event followed by a HealthUpdate event (code 6) with the same mob id and a lower health value.

**Test body:**
```javascript
it('@verified 2026-04-12: updates mob health on HealthUpdate event', () => {
  const [spawn, hp] = loadFixture('mobs/mob-health-update.json');
  handler.NewMobEvent(spawn.params);
  handler.updateMobHealth(hp.params);
  const mobs = handler.getMobList ? handler.getMobList() : handler.mobList;
  expect(mobs).toHaveLength(1);
  expect(mobs[0].health ?? mobs[0].currentHealth).toBeLessThan(mobs[0].maxHealth ?? Infinity);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize MobsHandler mob health update`.

### Task 37: Scenario, mob health bulk update

**Intent:** `updateMobHealthBulk(Parameters)` handles event 7 (HealthUpdates), which carries HP changes for multiple mobs at once.

**Fixture `__fixtures__/ws/mobs/mob-health-bulk.json`:** two spawn events plus one bulk HP update that changes both.

**Test body:**
```javascript
it('@verified 2026-04-12: updates multiple mobs on HealthUpdates bulk event', () => {
  const [spawnA, spawnB, bulk] = loadFixture('mobs/mob-health-bulk.json');
  handler.NewMobEvent(spawnA.params);
  handler.NewMobEvent(spawnB.params);
  handler.updateMobHealthBulk(bulk.params);
  const mobs = handler.getMobList ? handler.getMobList() : handler.mobList;
  expect(mobs).toHaveLength(2);
  mobs.forEach(m => {
    expect(m.health ?? m.currentHealth).toBeDefined();
  });
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize MobsHandler mob health bulk`.

### Task 38: Scenario, mob enchant update via MobChangeState

**Intent:** `updateEnchantEvent(Parameters)` handles event 47 (MobChangeState) which updates the enchant tier of an existing mob. Symmetric to HarvestableChangeState for mobs.

**Fixture `__fixtures__/ws/mobs/mob-enchant-update.json`:** spawn with enchant 0 plus a MobChangeState carrying enchant 2.

**Test body:**
```javascript
it('@verified 2026-04-12: updates mob enchant via MobChangeState', () => {
  const [spawn, enchantUpdate] = loadFixture('mobs/mob-enchant-update.json');
  handler.NewMobEvent(spawn.params);
  handler.updateEnchantEvent(enchantUpdate.params);
  const mobs = handler.getMobList ? handler.getMobList() : handler.mobList;
  expect(mobs).toHaveLength(1);
  expect(mobs[0].enchant).toBe(2);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize MobsHandler mob enchant update`.

### Task 39: Scenario, mob leave

**Intent:** `removeMob(id)` removes a mob from the list after it despawns or dies. Triggered by event 1 (Leave).

**Fixture `__fixtures__/ws/mobs/mob-leave.json`:** spawn event plus a leave event carrying the same id.

**Test body:**
```javascript
it('@verified 2026-04-12: removes mob on Leave event', () => {
  const [spawn, leave] = loadFixture('mobs/mob-leave.json');
  handler.NewMobEvent(spawn.params);
  handler.removeMob(leave.params[0]);
  const mobs = handler.getMobList ? handler.getMobList() : handler.mobList;
  expect(mobs).toHaveLength(0);
});
```

- [ ] Apply Standard workflow. Commit: `test(handlers): characterize MobsHandler mob leave`.

Checkpoint: MobsHandler coverage complete. Counter should show 10 additional tests (30 total). Plan budget reached.

---

## Part 5. Closing tasks (Tasks 40 to 42)

### Task 40: Append suspect register summary

**Files:**
- Modify: `web/scripts/__tests__/handlers/README.md`
- Modify: `docs/project/IMPROVEMENTS.md`

- [ ] **Step 1: Fill in the counter**

Update the counter table in `web/scripts/__tests__/handlers/README.md` with the final counts per handler. If any `@suspect` tests exist, their list at the bottom of the file cross-links to `IMPROVEMENTS.md`.

- [ ] **Step 2: Ensure IMPROVEMENTS.md has an entry per suspect**

For every `@suspect` test, `docs/project/IMPROVEMENTS.md` has a paragraph under a "Known bugs discovered by characterization tests" section, with:
- Handler name and test file path.
- Observed behavior.
- Expected behavior.
- Evidence (which code line, which fixture, which source).
- Suggested action (fix plan to write, defer, close as not-a-bug).

- [ ] **Step 3: Commit**

```
git add web/scripts/__tests__/handlers/README.md docs/project/IMPROVEMENTS.md
git commit -m "docs(tests): finalize handler coverage counters and suspect register"
```

### Task 41: Run the full suite

- [ ] **Step 1: Run all tests**

Run:
```
npm test
```
Expected: 30 to 33 tests (infra sanity plus 30 scenarios), all green. Suspect tests pass because they encode the buggy behavior (on purpose).

- [ ] **Step 2: Record the result**

Paste the summary output in the final commit message of this plan.

### Task 42: Write a completion note

**Files:**
- Create: `docs/plans/notes/2026-04-12-handlers-characterization-completion.md`

- [ ] **Step 1: Write the note**

The file contains:
- Final counts per handler (verified, characterization, suspect).
- List of suspects with brief description.
- Any deviation from the plan.
- The `npm test` summary output.
- Next steps: upgrade fixtures to real ones after the photon event codes refresh plan completes.

- [ ] **Step 2: Commit**

```
git add docs/plans/notes/2026-04-12-handlers-characterization-completion.md
git commit -m "docs(plans): close handlers characterization coverage plan"
```

- [ ] **Step 3: Move the plan to archive**

```
git mv docs/plans/2026-04-12-handlers-characterization-coverage-design.md docs/archive/completed-plans/
git commit -m "docs(plans): archive handlers characterization plan"
```

---

## Verification

1. `npm test` green with 30 to 33 tests total.
2. `web/scripts/__tests__/handlers/README.md` counter matches the actual test count.
3. Every test `it()` description starts with `@verified`, `@characterization`, or `@suspect`.
4. Every `@suspect` test has a matching entry in `docs/project/IMPROVEMENTS.md`.
5. `go build ./...` still green (nothing in this plan touches Go).
6. `npm run lint` still green (ESLint should accept the new test files, otherwise add a lint config override for `web/scripts/__tests__/`).
7. `make run` still starts the binary, no regression in the dev server.

## Out of scope

- Any test on RadarRenderer, Drawings, Canvas.
- Any test on EventRouter routing logic (handled by the photon refresh plan).
- Any test on Go code (handled by the photon refresh plan for the parser, and by future plans for the server).
- Any fix of any bug discovered. Stop and discuss, decide later.
- Playwright e2e setup (deferred to a future plan).

## Risks

- **Field name mismatches between assumptions and reality.** Several test scaffolds in this plan use hypothetical field names (`posX`, `targetX`, `playerList`, etc.). These must be confirmed from source during Step 1 of each scenario. This is normal, not a plan flaw.
- **Many suspect tests on HarvestablesHandler.** Tasks 22 and 27 sit directly on a known bug zone. Expect the stop-and-discuss rule to fire at least twice in this part. Budget-wise, each stop may cost 10 to 30 minutes of discussion, total impact bounded.
- **Vitest ESM import resolution** may fail for some handlers that use window-global databases as if they were modules. If that happens, add the missing stub to `setup.js` and retry.
- **Import of PlayersHandler may pull EventRouter or WebSocketManager indirectly**, triggering a cascade of stubs. Mitigation: read the handler's import list first (Standard workflow Step 1) and pre-stub everything upfront.
- **Test isolation:** each test instantiates a fresh handler in `beforeEach`. If a handler uses a module-level singleton, the test may leak state. Mitigation: inspect the handler for module-level state during reading, refactor only if unavoidable (discuss with user first).

## Handoff

Once this plan completes, the next plan in the queue is `2026-04-12-photon-event-codes-refresh-design.md`. That plan will produce real Photon fixtures. A follow-up informal pass should:

- Rederive the WS fixtures from the real Photon data.
- Re-run every characterization test against the new fixtures.
- For every test that fails the rerun, stop and discuss (same rule).
- Upgrade `@characterization` labels to `@verified` where the real fixture confirms the intent.

This follow-up is not a new plan, it is a follow-through of this plan. Budget: one session.