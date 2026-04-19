# Mists Detection Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore mist detection on the radar across 3 lifecycle facets (wisp-sign in world, opened portal mob, wisp cage inside Mists), with proper settings gating and debug overlays.

**Architecture:** Facet 1 fixes a single inverted filter in `MobsDrawing.js`. Facet 2 fixes pre-pinned `WispCageHandler` indexing bug. Facet 3 adds a dedicated `MistsWispHandler` + `MistsWispDrawing` routed from `EventRouter` on event 523 (`NewMistsWispSpawn`), with a generic marker because no rarity field was found in the pcap corpus.

**Tech Stack:** Vanilla JavaScript ES modules, Vitest 4.x + happy-dom, existing `DrawingUtils` base class, Go `tools/photon-dump` for fixture extraction.

**Spec:** `docs/plans/2026-04-19-mists-detection-design.md`

---

## File structure

### Create

- `web/scripts/handlers/MistsWispHandler.js` : Wisp class + MistsWispHandler (newWispEvent, removeWisp, Clear, cleanupStaleEntities)
- `web/scripts/handlers/MistsWispHandler.test.js` : unit + integration tests
- `web/scripts/drawings/MistsWispDrawing.js` : invalidate + interpolate + settings gate + debug ID overlay
- `web/scripts/drawings/MobsDrawing.test.js` : dedicated test file for mist filter drawing
- `web/scripts/__fixtures__/ws/mists-wisp/spawn.json` : 10+ pcap-derived event-523 samples from capture-52

### Modify

- `web/scripts/drawings/MobsDrawing.js:207` : invert enchant filter condition
- `web/scripts/handlers/WispCageHandler.js` : swap Parameters[1]/[2]/[4] indexing, drop inverted gate
- `web/scripts/handlers/WispCageHandler.test.js` : flip existing `test.fails` to `@verified`, add rendering integration
- `web/scripts/core/EventRouter.js` : add case for `EventCodes.NewMistsWispSpawn` dispatching to mistsWispHandler
- `web/scripts/core/EventRouter.test.js` : add routing test for event 523
- `web/scripts/utils/Utils.js:152-182` : instantiate handler + drawing, add to EventRouter init
- `web/scripts/utils/RadarRenderer.js` : include mists wisp drawing in render loop (pattern match existing drawings)
- `internal/templates/pages/chests.gohtml` : add checkboxes `settingWispSpawn` and `settingWispSpawnDebugID`, bind in initializer
- `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` : close WISP-1, open MIST-1 (enchant filter fix), open MIST-2 (rarity parsing reported), open MIST-3 (events 518/519 semantics)

---

## Task 1 : Facet 1 fix for MobsDrawing mist enchant filter

**Files:**
- Create: `web/scripts/drawings/MobsDrawing.test.js`
- Modify: `web/scripts/drawings/MobsDrawing.js:207-210`

- [ ] **Step 1 : Write the failing integration test**

Create `web/scripts/drawings/MobsDrawing.test.js` with this content :

```javascript
import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
    },
}));

const {MobsDrawing} = await import('./MobsDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('MobsDrawing mist rendering', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new MobsDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.interpolateEntity = vi.fn();
        drawing.getScaledSize = vi.fn(s => s);
        ctx = {};
    });

    test('MIST-1: MISTS_SOLO_YELLOW with settingMistE0=true and settingMistSolo=true renders mist_0', () => {
        settingsSync.getBool.mockImplementation(key => true);
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [], [mist]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(
            ctx, 10, 20, 'mist_0', 'Resources', 21
        );
    });

    test('MIST-1: settingMistE0=false skips the mist render', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistE0');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [], [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    test('MIST-1: settingMistSolo=false skips solo mist even with E0=true', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistSolo');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [], [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2 : Run the test to confirm it FAILS**

Run: `npx vitest run web/scripts/drawings/MobsDrawing.test.js`
Expected: the first test fails because the current inverted filter skips the render when `settingMistE0=true`. The second test fails too (setting=false renders because inversion). The third passes.

- [ ] **Step 3 : Apply the fix to MobsDrawing.js**

Edit `web/scripts/drawings/MobsDrawing.js` lines 207-210 :

```diff
-            if (settingsSync.getBool("settingMistE"+mistsOne.enchant))
-            {
-                continue;
-            }
+            if (!settingsSync.getBool("settingMistE" + mistsOne.enchant)) continue;
```

- [ ] **Step 4 : Run the test to confirm it PASSES**

Run: `npx vitest run web/scripts/drawings/MobsDrawing.test.js`
Expected: 3 tests pass.

- [ ] **Step 5 : Run the full suite to check no regression**

Run: `npm test`
Expected: existing count + 3 new tests, all passing except 3 pre-existing expected failures.

- [ ] **Step 6 : Commit**

```bash
git add web/scripts/drawings/MobsDrawing.js web/scripts/drawings/MobsDrawing.test.js
git commit -m "fix(mists): invert settingMistE<n> gate in MobsDrawing

The gate at MobsDrawing.js:207 was inverted: checking settingMistE0=true
caused the mist to be skipped. With the default UI state (all E0-E4
checked) every mist silently disappeared, matching bug reports #66 and
#69. Flip the condition so checking an enchant level shows mists of that
level.

Added MobsDrawing.test.js with 3 cases exercising the gate: E0+Solo
enabled renders, E0 disabled skips, Solo disabled skips."
```

---

## Task 2 : Facet 2 fix for WispCageHandler indexing

**Files:**
- Modify: `web/scripts/handlers/WispCageHandler.js`
- Modify: `web/scripts/handlers/WispCageHandler.test.js`

- [ ] **Step 1 : Confirm existing `test.fails` is RED on current code**

Run: `npx vitest run web/scripts/handlers/WispCageHandler.test.js`
Expected: the `test.fails('pcap-derived spawn: cage is added with name from Parameters[4] and position from Parameters[2]')` is green because the test body fails (0 cages added) which `test.fails` inverts. Any other failing test stops here.

- [ ] **Step 2 : Apply the fix to WispCageHandler.js**

Open `web/scripts/handlers/WispCageHandler.js` and locate the `newCageEvent` function. Replace the body between `newCageEvent(parameters) {` and the dedup/push block with :

```javascript
    newCageEvent(parameters) {
        if (settingsSync.getBool('settingCage')) return;

        const id = parameters[0];
        const position = parameters[2];
        const name = parameters[4];

        if (id === undefined || position === undefined) return;

        const existing = this.cages.find(c => c.id === id);
        if (existing) {
            existing.touch();
            return;
        }

        this.cages.push(new Cage(id, position[0], position[1], name));
    }
```

The three changes versus current code : (a) the inverted `if (parameters[4] !== undefined) return` gate is removed, (b) `position` now reads `parameters[2]` not `parameters[1]`, (c) `name` now reads `parameters[4]` not `parameters[2]`.

- [ ] **Step 3 : Flip the pinned test from test.fails to @verified**

In `web/scripts/handlers/WispCageHandler.test.js`, locate the block starting with the comment `// WISP-1:` and the line `test.fails('pcap-derived spawn: cage is added with name from Parameters[4] and position from Parameters[2]'`. Replace :

```diff
-        // WISP-1: pinned bug, real spawn should add a cage with name from Parameters[4] and position from Parameters[2].
-        test.fails('pcap-derived spawn: cage is added with name from Parameters[4] and position from Parameters[2]', async () => {
+        // @verified 2026-04-19: real pcap spawn (capture-70) adds a cage with name from Parameters[4] and position from Parameters[2].
+        test('pcap-derived spawn: cage is added with name from Parameters[4] and position from Parameters[2]', async () => {
```

Also locate the preceding test about "current handler drops cage" (currently labeled `@characterization 2026-04-19` and passing) and remove it entirely, because after the fix the behaviour it characterizes no longer exists. Replace the whole block :

```diff
-        // @characterization 2026-04-19: real pcap shape (capture-70) is P[2]=position array, P[4]=cage name, P[1]=scalar, P[5]=int. Current handler reads P[1] (scalar) as position array, P[2] (position) as name, and gates on P[4] (defined) so the cage is dropped. No cage appears on the radar.
-        test('pcap-derived spawn: current handler drops cage because Parameters[4] is always defined in real traffic', async () => {
-            const fx = await loadFixture('wispcage', 'spawn');
-            const p = normalizeParams(fx.messages[0].parameters);
-
-            handler.newCageEvent(p);
-
-            expect(handler.cages).toHaveLength(0);
-        });
-
```

- [ ] **Step 4 : Run the WispCageHandler test suite**

Run: `npx vitest run web/scripts/handlers/WispCageHandler.test.js`
Expected: all tests pass. The previously-pinned `test.fails` now runs as `test()` and asserts the fixed behaviour. The dropped `@characterization` test no longer exists.

- [ ] **Step 5 : Run the full suite**

Run: `npm test`
Expected: full suite green.

- [ ] **Step 6 : Commit**

```bash
git add web/scripts/handlers/WispCageHandler.js web/scripts/handlers/WispCageHandler.test.js
git commit -m "fix(mists): correct WispCageHandler parameter indexing (WISP-1)

Real traffic (capture-70 event 530 NewCagedObject) has Parameters[0]=id,
Parameters[2]=[x,y] position array, Parameters[4]=cage name. The handler
was reading Parameters[1] as position and Parameters[2] as name, with an
inverted gate on Parameters[4] that rejected every real event because
the name is always defined.

Swap indices and drop the gate. The pinned test.fails is flipped to
a regular @verified test. The obsolete @characterization test that
encoded the pre-fix drop behaviour is removed."
```

---

## Task 3 : Facet 3 extract pcap fixture for wisp-spawn

**Files:**
- Create: `web/scripts/__fixtures__/ws/mists-wisp/spawn.json`

- [ ] **Step 1 : Anonymize capture-52**

```bash
go run ./tools/anonymize-pcap --scrub-string "Nospy" --scrub-string "FARMEURCHINOIS" capture-52.pcap capture-52.anon.pcap
```
Expected: `18812 packets read, 18812 anonymized packets written`.

- [ ] **Step 2 : Create a one-off Go extractor for event 523 messages**

Write `tools/extract-event-523/main.go` with this content :

```go
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/nospy/albion-openradar/internal/photon"
)

func main() {
	in := flag.String("in", "", "input pcap")
	out := flag.String("out", "", "output json fixture")
	flag.Parse()
	if *in == "" || *out == "" {
		fmt.Fprintln(os.Stderr, "usage: extract-event-523 -in capture.pcap -out fixture.json")
		os.Exit(2)
	}

	messages := []map[string]any{}

	parser := photon.NewPhotonParser(
		func(e *photon.EventData) {
			photon.PostProcessEvent(e)
			code := asInt(e.Parameters[252])
			if code != 523 {
				return
			}
			params := map[string]any{}
			for k, v := range e.Parameters {
				params[fmt.Sprintf("%d", k)] = normalize(v)
			}
			messages = append(messages, map[string]any{
				"kind":       "event",
				"parameters": params,
			})
		},
		func(r *photon.OperationRequest) {},
		func(r *photon.OperationResponse) {},
	)

	f, err := os.Open(*in)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	rd, err := pcapgo.NewReader(f)
	if err != nil {
		panic(err)
	}
	for {
		data, _, err := rd.ReadPacketData()
		if err != nil {
			break
		}
		pkt := gopacket.NewPacket(data, rd.LinkType(), gopacket.Default)
		if udp, _ := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP); udp != nil {
			parser.ReceivePacket(udp.Payload)
		}
	}

	fixture := map[string]any{
		"scenario": "mists-wisp/spawn.json",
		"handler":  "mists-wisp",
		"messages": messages,
	}
	bytes, _ := json.MarshalIndent(fixture, "", "  ")
	if err := os.WriteFile(*out, bytes, 0644); err != nil {
		panic(err)
	}
	fmt.Fprintf(os.Stderr, "wrote %d messages\n", len(messages))
}

func asInt(v any) int {
	switch x := v.(type) {
	case byte:
		return int(x)
	case int8:
		return int(x)
	case int16:
		return int(x)
	case int32:
		return int(x)
	case int64:
		return int(x)
	}
	return -1
}

func normalize(v any) any {
	switch x := v.(type) {
	case []float32:
		out := make([]float64, len(x))
		for i, f := range x {
			out[i] = float64(f)
		}
		return out
	case int8:
		return int(x)
	case int16:
		return int(x)
	case int32:
		return int(x)
	case int64:
		return int(x)
	case byte:
		return int(x)
	}
	return v
}
```

- [ ] **Step 3 : Run the extractor**

```bash
mkdir -p web/scripts/__fixtures__/ws/mists-wisp
go run ./tools/extract-event-523 -in capture-52.anon.pcap -out web/scripts/__fixtures__/ws/mists-wisp/spawn.json
```
Expected stdout : `wrote 27 messages`.

- [ ] **Step 4 : Verify the fixture shape**

Run :
```bash
node -e "
const fs=require('fs');
const fx=JSON.parse(fs.readFileSync('web/scripts/__fixtures__/ws/mists-wisp/spawn.json','utf8'));
console.log('messages:', fx.messages.length);
const first = fx.messages[0].parameters;
console.log('first P[0]=' + first['0'], 'P[1]=' + JSON.stringify(first['1']), 'P[2]=' + first['2'], 'P[252]=' + first['252']);
"
```
Expected : `messages: 27` and first event with `P[0]` id, `P[1]` array `[x, y]`, `P[2]` 90, `P[252]` 523.

- [ ] **Step 5 : Cleanup intermediate + tool**

```bash
rm -f capture-52.anon.pcap
rm -rf tools/extract-event-523
```

- [ ] **Step 6 : Commit**

```bash
git add web/scripts/__fixtures__/ws/mists-wisp/spawn.json
git commit -m "test(mists): pcap-derived fixture for NewMistsWispSpawn event 523

27 messages extracted from capture-52 for event 523 (feu follet
wisp-sign in open world). Each carries id, position array, constant
orientation parameter, and occasionally a bool flag. No rarity field
observed. Used by MistsWispHandler tests and rendering integration."
```

---

## Task 4 : Facet 3 MistsWispHandler class + unit tests

**Files:**
- Create: `web/scripts/handlers/MistsWispHandler.js`
- Create: `web/scripts/handlers/MistsWispHandler.test.js`

- [ ] **Step 1 : Write the failing test**

Create `web/scripts/handlers/MistsWispHandler.test.js` :

```javascript
import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

const {MistsWispHandler} = await import('./MistsWispHandler.js');

describe('MistsWispHandler', () => {
    let handler;

    beforeEach(() => {
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        handler = new MistsWispHandler();
    });

    describe('newWispEvent (event 523)', () => {
        test('pcap-derived spawn: first event from fixture adds one wisp', async () => {
            const fx = await loadFixture('mists-wisp', 'spawn');
            const p = normalizeParams(fx.messages[0].parameters);

            handler.newWispEvent(p);

            expect(handler.wispList).toHaveLength(1);
            expect(handler.wispList[0].id).toBe(p[0]);
            expect(handler.wispList[0].posX).toBe(p[1][0]);
            expect(handler.wispList[0].posY).toBe(p[1][1]);
        });

        test('pcap-derived spawn: all 27 distinct events add their own wisp', async () => {
            const fx = await loadFixture('mists-wisp', 'spawn');
            const seenIds = new Set();
            for (const msg of fx.messages) {
                const p = normalizeParams(msg.parameters);
                handler.newWispEvent(p);
                seenIds.add(p[0]);
            }

            expect(handler.wispList.length).toBe(seenIds.size);
        });

        test('synthetic: duplicate id only touches existing entry', () => {
            handler.newWispEvent({0: 42, 1: [10, 20]});
            const t0 = handler.wispList[0].lastUpdateTime;
            handler.wispList[0].lastUpdateTime = t0 - 5000;

            handler.newWispEvent({0: 42, 1: [15, 25]});

            expect(handler.wispList).toHaveLength(1);
            expect(handler.wispList[0].lastUpdateTime).toBeGreaterThan(t0 - 5000);
            expect(handler.wispList[0].posX).toBe(10);
        });

        test('synthetic: missing position is dropped', () => {
            handler.newWispEvent({0: 99});

            expect(handler.wispList).toHaveLength(0);
        });

        test('synthetic: missing id is dropped', () => {
            handler.newWispEvent({1: [0, 0]});

            expect(handler.wispList).toHaveLength(0);
        });
    });

    describe('removeWisp', () => {
        test('synthetic: remove by id drops entry', () => {
            handler.newWispEvent({0: 1, 1: [0, 0]});
            handler.newWispEvent({0: 2, 1: [1, 1]});

            handler.removeWisp(1);

            expect(handler.wispList).toHaveLength(1);
            expect(handler.wispList[0].id).toBe(2);
        });
    });

    describe('Clear', () => {
        test('synthetic: Clear empties wispList', () => {
            handler.newWispEvent({0: 1, 1: [0, 0]});
            handler.newWispEvent({0: 2, 1: [1, 1]});

            handler.Clear();

            expect(handler.wispList).toHaveLength(0);
        });
    });

    describe('cleanupStaleEntities', () => {
        test('synthetic: entries older than maxAgeMs are removed', () => {
            handler.newWispEvent({0: 1, 1: [0, 0]});
            handler.newWispEvent({0: 2, 1: [1, 1]});
            handler.wispList[0].lastUpdateTime = Date.now() - 200000;

            const removed = handler.cleanupStaleEntities(120000);

            expect(removed).toBe(1);
            expect(handler.wispList).toHaveLength(1);
            expect(handler.wispList[0].id).toBe(2);
        });
    });
});
```

- [ ] **Step 2 : Run the test to confirm it FAILS**

Run: `npx vitest run web/scripts/handlers/MistsWispHandler.test.js`
Expected: fails with "Cannot find module './MistsWispHandler.js'".

- [ ] **Step 3 : Write the minimal implementation**

Create `web/scripts/handlers/MistsWispHandler.js` :

```javascript
import {CATEGORIES} from '../constants/LoggerConstants.js';

class Wisp {
    constructor(id, posX, posY, orientation, flag) {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.orientation = orientation;
        this.flag = flag;
        this.hX = 0;
        this.hY = 0;
        this.lastUpdateTime = Date.now();
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }
}

export class MistsWispHandler {
    constructor() {
        this.wispList = [];
    }

    newWispEvent(parameters) {
        const id = parameters[0];
        const position = parameters[1];
        if (id === undefined || position === undefined) return;

        const existing = this.wispList.find(w => w.id === id);
        if (existing) {
            existing.touch();
            return;
        }

        this.wispList.push(new Wisp(id, position[0], position[1], parameters[2], parameters[3]));

        window.logger?.debug(CATEGORIES.MOBS, 'MistsWispAdded', {
            id, posX: position[0], posY: position[1]
        });
    }

    removeWisp(id) {
        this.wispList = this.wispList.filter(w => w.id !== id);
    }

    Clear() {
        this.wispList = [];
    }

    cleanupStaleEntities(maxAgeMs = 120000) {
        const now = Date.now();
        const before = this.wispList.length;
        this.wispList = this.wispList.filter(w => (now - w.lastUpdateTime) < maxAgeMs);
        return before - this.wispList.length;
    }
}
```

- [ ] **Step 4 : Run the tests to confirm they PASS**

Run: `npx vitest run web/scripts/handlers/MistsWispHandler.test.js`
Expected: all 8 tests pass.

- [ ] **Step 5 : Commit**

```bash
git add web/scripts/handlers/MistsWispHandler.js web/scripts/handlers/MistsWispHandler.test.js
git commit -m "feat(mists): MistsWispHandler for feu follet world-map detection

New handler dedicated to event 523 NewMistsWispSpawn (wisp-signs in the
open world before portal opens). Stores wisp entities with id and
position, supports touch-on-duplicate semantics, and exposes Clear +
cleanupStaleEntities for lifecycle management consistent with the other
handlers.

Rarity is not carried in event 523 Parameters per capture-52 pcap
analysis. Render will use a generic marker; rarity parsing deferred
until a live session provides the field location (tracked as MIST-3 in
the characterization register)."
```

---

## Task 5 : Facet 3 EventRouter routing event 523

**Files:**
- Modify: `web/scripts/core/EventRouter.js`
- Modify: `web/scripts/core/EventRouter.test.js`

- [ ] **Step 1 : Read the current EventRouter layout**

Run: `grep -n "NewCagedObject\|CagedObjectStateUpdated\|init:\|handlers = " web/scripts/core/EventRouter.js | head -20`

This confirms the `case` layout in `onEvent` and the handlers destructure. Use this to anchor edits.

- [ ] **Step 2 : Write the failing routing test**

In `web/scripts/core/EventRouter.test.js`, locate the `// onEvent NewRandomDungeonExit (323)` describe block (around line 615). After its closing `});`, append :

```javascript

    describe('onEvent NewMistsWispSpawn', () => {
        test('MIST-3: onEvent routes NewMistsWispSpawn (P[252]=523) to mistsWispHandler.newWispEvent', async () => {
            const handlers = makeHandlers();
            EventRouter.init({handlers, map: makeMap(), radarRenderer: null});
            const p = {0: 67, 1: [172.5, 15.5], 2: 90, 252: 523};

            EventRouter.onEvent(p);

            expect(handlers.mistsWispHandler.newWispEvent).toHaveBeenCalledWith(p);
        });
    });
```

Also locate `makeHandlers` (around line 45-60) and add to its returned object (inside the `return { ... }`) a new field :

```javascript
            mistsWispHandler: {newWispEvent: vi.fn(), removeWisp: vi.fn()},
```

Also locate the `Leave` dispatch test (around line 320-340). Add a check that Leave calls `mistsWispHandler.removeWisp` if you see a pattern of other handlers having their remove fn called. If not present (pattern not applied there), skip that assertion in this task (will be added in step 4 when the router handles it).

- [ ] **Step 3 : Run the test to confirm it FAILS**

Run: `npx vitest run web/scripts/core/EventRouter.test.js -t "NewMistsWispSpawn"`
Expected: fails because the case does not route yet.

- [ ] **Step 4 : Apply the fix to EventRouter.js**

Open `web/scripts/core/EventRouter.js`. Locate the destructure in the init method around line 145-150 that lists `dungeonsHandler, fishingHandler, wispCageHandler`. Add `mistsWispHandler` :

```diff
-        dungeonsHandler, fishingHandler, wispCageHandler
+        dungeonsHandler, fishingHandler, wispCageHandler, mistsWispHandler
```

Locate the `Leave` onEvent handler around line 150-165. After the `wispCageHandler.removeCage(id);` line, add :

```javascript
            mistsWispHandler?.removeWisp(id);
```

Locate the switch cases in `onEvent`. After the `CagedObjectStateUpdated` case block (around line 265-270), add :

```javascript
        case EventCodes.NewMistsWispSpawn:
            mistsWispHandler?.newWispEvent(Parameters);
            break;
```

- [ ] **Step 5 : Run the EventRouter test suite**

Run: `npx vitest run web/scripts/core/EventRouter.test.js`
Expected: the new NewMistsWispSpawn test passes. All other tests remain green (the `mistsWispHandler` field added to `makeHandlers` does not break existing destructuring).

- [ ] **Step 6 : Run the full suite**

Run: `npm test`
Expected: green.

- [ ] **Step 7 : Commit**

```bash
git add web/scripts/core/EventRouter.js web/scripts/core/EventRouter.test.js
git commit -m "feat(mists): route NewMistsWispSpawn (event 523) to MistsWispHandler

Wire MistsWispHandler into EventRouter.init handlers destructure. Add
case for EventCodes.NewMistsWispSpawn in onEvent that calls
newWispEvent(Parameters). Also call mistsWispHandler.removeWisp(id) in
the Leave dispatch for lifecycle symmetry with dungeonsHandler and
wispCageHandler."
```

---

## Task 6 : Facet 3 MistsWispDrawing + settings gate + debug overlay

**Files:**
- Create: `web/scripts/drawings/MistsWispDrawing.js`
- Create: `web/scripts/drawings/MistsWispDrawing.test.js`

- [ ] **Step 1 : Write the failing test**

Create `web/scripts/drawings/MistsWispDrawing.test.js` :

```javascript
import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
    },
}));

const {MistsWispDrawing} = await import('./MistsWispDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('MistsWispDrawing', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new MistsWispDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.interpolateEntity = vi.fn();
        drawing.drawText = vi.fn();
        drawing.getScaledSize = vi.fn(s => s);
        ctx = {};
    });

    test('renders nothing when settingWispSpawn is false', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingWispSpawn');
        const wisp = {id: 42, hX: 10, hY: 20};

        drawing.invalidate(ctx, [wisp]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    test('renders wisp_sign image when settingWispSpawn is true', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingWispSpawn');
        const wisp = {id: 42, hX: 10, hY: 20};

        drawing.invalidate(ctx, [wisp]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(
            ctx, 10, 20, 'wisp_sign', 'Resources', 20
        );
    });

    test('renders debug ID text when settingWispSpawnDebugID is true', () => {
        settingsSync.getBool.mockImplementation(key =>
            key === 'settingWispSpawn' || key === 'settingWispSpawnDebugID');
        const wisp = {id: 42, hX: 10, hY: 20};

        drawing.invalidate(ctx, [wisp]);

        expect(drawing.drawText).toHaveBeenCalledWith(10, 38, '42', ctx);
    });

    test('does not render debug ID when settingWispSpawnDebugID is false', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingWispSpawn');
        const wisp = {id: 42, hX: 10, hY: 20};

        drawing.invalidate(ctx, [wisp]);

        expect(drawing.drawText).not.toHaveBeenCalled();
    });

    test('interpolate delegates to interpolateEntity per wisp', () => {
        const wisps = [{id: 1}, {id: 2}];

        drawing.interpolate(wisps, 0, 0, 0.5);

        expect(drawing.interpolateEntity).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2 : Run the test to confirm it FAILS**

Run: `npx vitest run web/scripts/drawings/MistsWispDrawing.test.js`
Expected: fails with "Cannot find module './MistsWispDrawing.js'".

- [ ] **Step 3 : Write the implementation**

Create `web/scripts/drawings/MistsWispDrawing.js` :

```javascript
import {DrawingUtils} from '../utils/DrawingUtils.js';
import settingsSync from '../utils/SettingsSync.js';

export class MistsWispDrawing extends DrawingUtils {
    interpolate(wisps, lpX, lpY, t) {
        for (const w of wisps) {
            this.interpolateEntity(w, lpX, lpY, t);
        }
    }

    invalidate(ctx, wisps) {
        if (!settingsSync.getBool('settingWispSpawn')) return;

        const showId = settingsSync.getBool('settingWispSpawnDebugID');

        for (const w of wisps) {
            const p = this.transformPoint(w.hX, w.hY);
            this.DrawCustomImage(ctx, p.x, p.y, 'wisp_sign', 'Resources', 20);

            if (showId) {
                this.drawText(p.x, p.y + this.getScaledSize(18), w.id.toString(), ctx);
            }
        }
    }
}
```

- [ ] **Step 4 : Run the tests**

Run: `npx vitest run web/scripts/drawings/MistsWispDrawing.test.js`
Expected: 5 tests pass.

- [ ] **Step 5 : Commit**

```bash
git add web/scripts/drawings/MistsWispDrawing.js web/scripts/drawings/MistsWispDrawing.test.js
git commit -m "feat(mists): MistsWispDrawing with settings gate and debug ID overlay

Generic wisp_sign image rendered for each wisp in wispList. Master gate
on settingWispSpawn (off-by-default behaviour enforced by settings
layer). Debug ID overlay under settingWispSpawnDebugID, matching the
pattern of settingLivingResourcesID for harvestables. No rarity field
because event 523 does not carry one in observed captures."
```

---

## Task 7 : Wire handler + drawing into Utils.js and add settings UI

**Files:**
- Modify: `web/scripts/utils/Utils.js:152-182`
- Modify: `web/scripts/utils/RadarRenderer.js`
- Modify: `internal/templates/pages/chests.gohtml`

- [ ] **Step 1 : Instantiate handler + drawing in Utils.js**

Open `web/scripts/utils/Utils.js`. Locate imports at top and add :

```javascript
import {MistsWispHandler} from '../handlers/MistsWispHandler.js';
import {MistsWispDrawing} from '../drawings/MistsWispDrawing.js';
```

Locate lines 152-167 (the handlers/drawings instantiation block). Insert new instances :

```diff
         handlers.wispCage = new WispCageHandler();
         handlers.fishing = new FishingHandler();
+        handlers.mistsWisp = new MistsWispHandler();

         drawings.maps = new MapDrawing();
         drawings.harvestables = new HarvestablesDrawing();
         drawings.mobs = new MobsDrawing();
         drawings.players = new PlayersDrawing();
         drawings.chests = new ChestsDrawing();
         drawings.dungeons = new DungeonsDrawing();
         drawings.wispCage = new WispCageDrawing();
         drawings.fishing = new FishingDrawing();
+        drawings.mistsWisp = new MistsWispDrawing();
```

Locate the `EventRouter.init` call (around line 173-185) and add `mistsWispHandler` to the handlers map :

```diff
         EventRouter.init({
             handlers: {
                 playersHandler: handlers.players,
                 mobsHandler: handlers.mobs,
                 harvestablesHandler: handlers.harvestables,
                 chestsHandler: handlers.chests,
                 dungeonsHandler: handlers.dungeons,
                 fishingHandler: handlers.fishing,
-                wispCageHandler: handlers.wispCage
+                wispCageHandler: handlers.wispCage,
+                mistsWispHandler: handlers.mistsWisp
             },
```

If there is a `clearHandlers` function in the same file that iterates handlers and calls `.Clear()`, confirm it will pick up `handlers.mistsWisp` automatically via iteration. If it lists handlers explicitly, add a `handlers.mistsWisp.Clear();` call.

Run: `grep -n "clearHandlers\|.Clear()" web/scripts/utils/Utils.js | head -10`

- [ ] **Step 2 : Wire drawing into RadarRenderer**

Run: `grep -n "drawings\.wispCage\|drawings\.fishing\|drawings\.dungeons" web/scripts/utils/RadarRenderer.js | head -10`

Locate the interpolate and invalidate calls for wispCage/dungeons/fishing drawings. Add parallel calls for `drawings.mistsWisp`, passing `handlers.mistsWisp.wispList` as the collection. The exact edit depends on the existing pattern; follow what wispCage does.

If the pattern is something like :
```javascript
drawings.wispCage.interpolate(handlers.wispCage.cages, lpX, lpY, t);
...
drawings.wispCage.invalidate(ctx, handlers.wispCage.cages);
```
then add :
```javascript
drawings.mistsWisp.interpolate(handlers.mistsWisp.wispList, lpX, lpY, t);
...
drawings.mistsWisp.invalidate(ctx, handlers.mistsWisp.wispList);
```

- [ ] **Step 3 : Add settings checkboxes in chests.gohtml**

Open `internal/templates/pages/chests.gohtml`. Locate the Mists section (around line 75-130 with `settingMistSolo`, `settingMistDuo`, `settingMistE0`...`E4`). After the existing `settingCage` block and before the closing `</div>` of the Mists section, add :

```html
                            <div class="flex items-center gap-2">
                                <input type="checkbox" id="settingWispSpawn" class="checkbox checkbox-primary checkbox-sm">
                                <label for="settingWispSpawn" class="text-sm">Wisp signs (pre-portal)</label>
                            </div>
                            <div class="flex items-center gap-2">
                                <input type="checkbox" id="settingWispSpawnDebugID" class="checkbox checkbox-primary checkbox-xs">
                                <label for="settingWispSpawnDebugID" class="text-xs">Show wisp ID (debug)</label>
                            </div>
```

Exact classes/wrapper should match the neighbouring checkboxes in the same file. Check a nearby existing block (e.g. `settingCage`) and mimic its structure precisely.

Locate the `bindCheckbox` initializer around line 263 and add the new keys :

```diff
-["settingMistSolo", "settingMistDuo", "settingMistE0", "settingMistE1", "settingMistE2", "settingMistE3", "settingMistE4", "settingCage"].forEach(bindCheckbox);
+["settingMistSolo", "settingMistDuo", "settingMistE0", "settingMistE1", "settingMistE2", "settingMistE3", "settingMistE4", "settingCage", "settingWispSpawn", "settingWispSpawnDebugID"].forEach(bindCheckbox);
```

- [ ] **Step 4 : Run the frontend test suite**

Run: `npm test`
Expected: all tests green. Existing Utils or RadarRenderer tests if they exist should still pass.

- [ ] **Step 5 : Run go tests to confirm template still parses**

Run: `go test ./...`
Expected: all tests green (Go tests exercise the HTML template parser if any asset embed test exists).

- [ ] **Step 6 : Commit**

```bash
git add web/scripts/utils/Utils.js web/scripts/utils/RadarRenderer.js internal/templates/pages/chests.gohtml
git commit -m "feat(mists): wire MistsWispHandler and MistsWispDrawing into runtime

Instantiate handler and drawing in Utils.js alongside existing ones,
pass mistsWispHandler into EventRouter.init, call mistsWisp.interpolate
and invalidate in RadarRenderer matching the wispCage pattern. Add
settingWispSpawn and settingWispSpawnDebugID checkboxes in the Mists
settings panel, binding persistence via the existing bindCheckbox
initializer."
```

---

## Task 8 : Register update + verification + push

**Files:**
- Modify: `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`

- [ ] **Step 1 : Update the characterization register**

Open `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`.

In the `## Open test.fails register` section, remove the `WISP-1` entry (the full bullet).

In the same section, add new entries :

```markdown
- **MIST-1** (issues #66 #69) MobsDrawing mist enchant filter was inverted: checking settingMistE<n> skipped the mist instead of rendering it. Fixed in this PR. Root cause of zero visible mist portals when all E0-E4 checkboxes are checked (the default UI state). Flipped to `@verified`.
- **MIST-2** Rarity colour in the MISTS_*_<COLOR> mob name is stripped during dispatch (mist.enchant = Parameters[33] = 0 always). Capture-52/70 only show YELLOW, so the mapping colour -> level cannot be derived yet. Deferred until a live session provides multi-colour captures.
- **MIST-3** Events 518/519 have one occurrence each in capture-52 with the same entity id (2577), suggesting spawn + state-change pair. Semantics unknown. Event 523 NewMistsWispSpawn now routed but carries no rarity; the in-game tooltip on a feu follet does show rarity, so the info exists somewhere and needs targeted live capture.
```

In the `## Decisions log` section, append :

```markdown
- 2026-04-19 mists detection restoration. Facet 1 inverts settingMistE<n> filter gate in MobsDrawing (1-line fix). Facet 2 corrects WispCageHandler Parameter[1]/[2]/[4] indexing per capture-70 evidence and flips the pre-pinned test.fails to @verified. Facet 3 adds MistsWispHandler + MistsWispDrawing for event 523 with generic wisp_sign marker (no rarity data in events 518/519/523 per pcap corpus). New settings settingWispSpawn and settingWispSpawnDebugID added to the chests.gohtml Mists panel. Rarity parsing deferred: MIST-2 (portal colour mapping) and MIST-3 (feu follet rarity location) open in the register.
```

Update the `## Counts per handler` table. Add a row for the new handler and bump the `Total` :

```markdown
| WispCageHandler | 10 | 0 | 0 | 10 |
| MistsWispHandler | 8 | 0 | 0 | 8 |
```

Adjust MobsDrawing if added as a separate row : `| MobsDrawing | 3 | 0 | 0 | 3 |`. Verify with grep the actual test count.

Run :
```bash
grep -c "^        test(" web/scripts/handlers/WispCageHandler.test.js
grep -c "^        test(" web/scripts/handlers/MistsWispHandler.test.js
grep -c "^    test(" web/scripts/drawings/MobsDrawing.test.js
grep -c "^    test(" web/scripts/drawings/MistsWispDrawing.test.js
```

Use the actual counts in the table.

- [ ] **Step 2 : Verify no em-dash and no co-author trailer**

Run :
```bash
git diff main...HEAD | grep -cP '\x{2014}'
git log --format=%B main..HEAD | grep -ci "co-authored"
```
Expected : both 0.

- [ ] **Step 3 : Full suite verification**

Run :
```bash
npm test
npm run lint
go test ./...
```
Expected : all green, no lint warnings.

- [ ] **Step 4 : Commit the register update**

```bash
git add docs/plans/notes/2026-04-18-handlers-characterization-coverage.md
git commit -m "docs(mists): register WISP-1 closed, MIST-1/2/3 opened with decision log"
```

- [ ] **Step 5 : Push branch and open PR**

```bash
git push -u origin feat/mists-detection
gh pr create --title "feat(mists): restore detection across 3 lifecycle facets" --body "$(cat <<'EOF'
## Summary
- Fix inverted mist enchant filter in MobsDrawing (root cause of #66 and #69).
- Fix WispCageHandler parameter indexing (WISP-1 pinned in register).
- Add MistsWispHandler + MistsWispDrawing for event 523 NewMistsWispSpawn (feu follet detection in world map, generic marker).
- Add settings settingWispSpawn and settingWispSpawnDebugID in Mists panel.

## Test plan
- [x] MobsDrawing.test.js covers inverted filter fix (3 cases).
- [x] WispCageHandler.test.js pinned test.fails flipped to @verified.
- [x] MistsWispHandler.test.js covers dispatch, dedup, lifecycle (8 cases).
- [x] MistsWispDrawing.test.js covers settings gate and debug overlay (5 cases).
- [x] EventRouter.test.js covers routing event 523.
- [ ] Live smoke: feu follet visible in open world, portail ouvert E0 visible on radar, wisp cage visible inside Mists.

## Known deferred (tracked as MIST-2 and MIST-3)
- Mist portal rarity colour parsing (needs multi-colour live capture).
- Feu follet rarity location in wire (tooltip shows rarity in-game but not located in events 518/519/523 from pcap).
EOF
)"
```

- [ ] **Step 6 : User action for live smoke**

User launches radar in-game, navigates to a Mists zone, and verifies :
1. Wisp-sign (feu follet) appears as a generic marker on radar
2. Opened mist portal appears as mist_0 image when E0 is checked
3. Wisp cage appears inside Mists zones

If any fails, capture a session and investigate. Rarity-specific fixes deferred to MIST-2/MIST-3 follow-ups.

---

## Post-implementation checklist

- [ ] All tests green (`npm test` + `go test ./...`)
- [ ] Lint clean
- [ ] No em-dash in diff
- [ ] No Co-Authored-By trailer
- [ ] Register updated with WISP-1 closed + MIST-1/2/3 opened
- [ ] PR opened at feat/mists-detection
- [ ] Live smoke scheduled with user
