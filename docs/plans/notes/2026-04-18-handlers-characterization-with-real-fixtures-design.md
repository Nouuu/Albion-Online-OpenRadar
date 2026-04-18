# Handlers Characterization With Real Fixtures — Design

| Field | Value |
|---|---|
| Status | Brainstormed 2026-04-18, design approved by user, awaiting writing-plans |
| Supersedes | `docs/plans/2026-04-12-handlers-characterization-coverage-design.md` (to be archived after plan writes) |
| Depends on | PR #64 merged on main, `feat/revival` merged on main |
| Blocks | `2026-04-18-protocol18-regressions-design.md`, `2026-04-18-alerts-and-ignore-list-design.md`, `2026-01-15-living-harvestables-fix-design.md` |
| Priority | Top of queue |

## Context

Three triggers merged into one design:

1. Initial `2026-04-12-handlers-characterization-coverage-design.md` targeted 30 scenarios across 3 handlers (Players, Harvestables, Mobs) with synthetic fixtures derived from reading the parser. Undersized and error-prone.
2. PR #51 (Protocol18 port) shipped Vitest + happy-dom + first test (`EventRouter.test.js`), rendering the plan's infrastructure tasks moot and exposing a wire layout drift (`Parameters[103]` scalar to hashtable) that proves synthetic fixtures are fragile.
3. User produced a 25-minute Wireshark capture with deliberate variety (exploration, harvesting, combat, town, black zone). It covers scenarios for multiple plans, not just characterization.

Net effect: rewrite the characterization scope end-to-end around real pcap fixtures, extend coverage to all 7 detection handlers plus EventRouter, push the scenario count up by variant, and produce a fixture corpus that also feeds the Protocol18 regressions and alerts plans.

## Goals

- Retroactive safety net across all detection handlers (Players, Harvestables, Mobs, Chests, Dungeons, Fishing, WispCage) plus EventRouter routing.
- Fixtures derived from a real Photon capture, reusable across characterization, Protocol18 regressions, alerts, and living harvestables plans.
- Explicit confidence labels (`@verified` / `@characterization` / `@suspect`) per Rule 10 of CLAUDE.md.
- Zero handler modifications during this plan. All fixes live in their dedicated plans.

## Non goals

- Fixes for any bug discovered. Stop-and-discuss, `@suspect` label, log in IMPROVEMENTS.md.
- Refactor of any handler or router.
- Tests on RadarRenderer, Drawings, Canvas internals, SettingsHandler, MetricsCollector.
- New detection handler.

## Decisions locked during brainstorm

| Topic | Decision |
|---|---|
| Fixture source | Real pcap upfront (approach B), not synthetic |
| Extraction scope | Plan-forward (approach 2): cover characterization + Protocol18 regressions from same corpus |
| Branch strategy | Merge PR #64 first, rebase `feat/revival`, PR `feat/revival` to main, cut `feat/handlers-characterization` from main (approach A) |
| Extraction tool | New `cmd/photon-dump/` binary (approach Y) |
| PII policy | P1 baseline (match existing pcap convention), with minimal extension to `tools/anonymize-pcap/` to scrub local player name via `--scrub-string` |
| Coverage principle | Cover every distinct variant observed in corpus (Rule 10 coverage principle), not one test per category |
| Scenario target | 125-190 scenarios across 7 handlers + EventRouter, hard cap 220 |
| EventRouter | Included, extension of existing `EventRouter.test.js` |

## Architecture

### Pipeline

```
capture.pcap (local, 25 min session, gitignored)
    |
    | tools/anonymize-pcap --scrub-string "<local_player_name>"
    v
capture.anon.pcap (local, gitignored)
    |
    | cmd/photon-dump -in capture.anon.pcap -out-go ... -out-js ...
    v
+---> internal/photon/testdata/<scenario>.pcap       (N small anonymized pcaps, committed, fed to Go tests)
+---> web/scripts/__fixtures__/ws/<handler>/<scenario>.json  (N WS-level JSON, committed, fed to Vitest)
```

### `tools/anonymize-pcap/` extension

Add CLI flag `--scrub-string <value>` (repeatable). Byte-level search-and-replace with same-length padding (`X` repeated). Limits: ASCII only, no Unicode multi-byte handling. Photon payload length-prefixed strings are safe when replacement matches length. Unit tests on a synthetic small pcap assert byte replacement without corrupting pcap headers.

Single commit: `feat(anonymize-pcap): add --scrub-string for local player name`.

### `cmd/photon-dump/` new binary

CLI:
```
photon-dump -in capture.anon.pcap -out-go internal/photon/testdata -out-js web/scripts/__fixtures__/ws [-inventory]
```

Scenarios declared in Go (no YAML, no config parser). Structure:
```go
type Scenario struct {
    Name        string           // "players/passive-player-spawn"
    Handler     string           // "players"
    Match       MatchCriteria    // event code + param filters
    FollowUps   []MatchCriteria  // multi-event scenarios (spawn + update)
    CorrelateBy string           // param key to follow same entity (e.g., "0" player id)
    Output      OutputSpec
}
```

Two artifacts per matched scenario:
- Pcap fragment: `internal/photon/testdata/<scenario>.pcap` (1 + len(FollowUps) packets)
- WS-level JSON: `web/scripts/__fixtures__/ws/<handler>/<scenario>.json` matching the format `EventRouter.test.js` already uses

`--inventory` mode: decode the whole pcap and emit a census (event code histogram, distinct typeIds, tiers, enchants, factions, zones). Output: `docs/technical/PROTOCOL18_OBSERVED_CODES.md`. Contributes to closing issue #54.

Tests: unit tests on synthetic mini-pcaps (3-4 hand-crafted packets) verifying match + extraction logic produces expected files.

Single commit: `feat(cmd/photon-dump): extract per-scenario fixtures from anonymized pcap`.

### Scenarios unobservable in the corpus

Some scenarios require states a pcap cannot reproduce (stale cleanup with Date.now offset, settings injection, ignore-list gate with artificial list). These stay synthetic, hand-written in the test file. Every test header declares `pcap-derived <fixture-path>` or `synthetic <reason>` in a 2-line comment at top.

## Scope and scenarios

### Handlers covered

| Handler | Lines | Target scenarios | Notable bugs |
|---|---:|---:|---|
| PlayersHandler | 384 | 20-28 | #36 ignore-list, #65 alert |
| HarvestablesHandler | 639 (hot-spot) | 35-50 | #30 hides, #32 e0 filter, #52 Fiber tier |
| MobsHandler | 712 (hot-spot) | 25-40 | faction param history |
| ChestsHandler | 80 | 5-10 | #29 rarity vs chestName |
| FishingHandler | 112 | 4-7 | #25 fishpool |
| DungeonsHandler | 158 | 8-14 | none known |
| WispCageHandler | 77 | 2-4 | none known |
| EventRouter (extension) | 446 | 25-35 | #57 isBZ hashtable |
| **Total** | | **125-190** | |

### Coverage principle

Per Rule 10 of CLAUDE.md, cover every distinct variant observed in the pcap corpus (tier, type, enchant, faction, zone), not one scenario per category. Example: if the capture exposes WOOD at tiers T2, T3, T4, T5, T7, write 5 WOOD spawn tests. If enchants 0 through 3 appear on FIBER, write 4 FIBER spawn tests.

### Execution order of handlers

1. HarvestablesHandler (hot-spot, 3 known bug clusters)
2. MobsHandler (hot-spot, faction history)
3. PlayersHandler (alert gate bug cluster)
4. ChestsHandler (known bug #29)
5. FishingHandler (known bug #25)
6. DungeonsHandler
7. WispCageHandler
8. EventRouter extension (bug #57)

Rationale: high-risk, high-payoff handlers first. ChestsHandler and FishingHandler moved up (from last in original plan) because they carry known community bugs.

### EventRouter coverage detail

Current `EventRouter.test.js` has 11 tests from PR #51. Extension adds:
- One test per dispatched event code in `onEvent` switch (about 20-22 cases that call a handler method): asserts the right handler method is invoked with expected Parameters.
- One test per documented no-op case (HarvestStart, HarvestCancel, InventoryPutItem, NewSimpleItem, NewEquipmentItem, NewJournalItem, UpdateFame, UpdateMoney): asserts no handler method fires.
- Unknown event code: asserts dispatcher does not crash.
- `onRequest` cases 21 and 22 (complete from partial PR #51 coverage).
- `onResponse` JoinMap, ChangeCluster, JoinFinished (complete from partial).
- Logging-only case 590: asserts no state mutation.

## Execution workflow

### Branch strategy

Per user decision (approach A):

```
Step 0a  Review PR #64 (already MERGEABLE, all CI green). Merge.
Step 0b  Rebase feat/revival on updated main.
Step 0c  PR feat/revival -> main with short description. Merge.
Step 0d  Cut feat/handlers-characterization from main.
```

### Steps 1 to 4: tools, fixtures, tests, wrap

```
Step 1  Tools
  Commit A : feat(anonymize-pcap): add --scrub-string
  Commit B : feat(cmd/photon-dump): binary + scenario declarations + unit tests
  Commit C : docs(technical): add PROTOCOL18_OBSERVED_CODES.md via --inventory

Step 2  Extract fixtures
  Run anonymize-pcap --scrub-string "<name>" capture.pcap capture.anon.pcap (local)
  Run photon-dump --inventory (produces docs output)
  Run photon-dump (produces N pcap fragments + N JSON)
  Commit D : test(fixtures): add N pcap+json fixtures from 25-min session

Step 3  Characterize handlers (loop)
  Per handler (8 iterations):
    Read entire handler (Rule 3 hot-spot or preventive)
    Write _notes.md with entry points + state fields
    Per scenario (3-50 iterations):
      Standard 6-step workflow: read, fixture, test, run, label, commit
      Stop-and-discuss on anomalies
    Update counter README
    Checkpoint user (go/no-go next handler)

Step 4  Wrap
  Final counter update
  IMPROVEMENTS.md suspect register
  npm test full green, go test full green, make run smoke
  Completion note docs/plans/notes/<date>-handlers-characterization-completion.md
  PR feat/handlers-characterization -> main
```

### Standard per-scenario workflow

1. Read the target method in full (plus helpers in the same file). Write 2-line intent comment in test header.
2. Confirm fixture JSON exists (from photon-dump) or hand-write a synthetic one with `synthetic` declaration.
3. Write the test file: co-located `.test.js`, inline `vi.fn()` stubs, assert observable state.
4. Run `npm test -- <path>`. Three outcomes:
   - Pass + intent matches reference: label `@verified`, proceed.
   - Fail on assertion: stop-and-discuss (three hypotheses).
   - Crash on error: investigate stub / import, fix or stop.
5. Set label with date and short reason.
6. Commit `test(handlers): characterize <Handler> <scenario>`.

### Stop-and-discuss protocol

On failing characterization test:
1. Stop, no patch.
2. Present three hypotheses with evidence (line numbers, fixture content):
   - H1 Intent wrong
   - H2 Fixture wrong
   - H3 Code bug
3. User decides.
4. One path chosen, test goes `@verified` / `@characterization` / `@suspect`.
5. If H3, entry added to `docs/project/IMPROVEMENTS.md` with cross-link to issue if existing.

### Checkpoints user (mandatory)

- CP1 after Step 1+2 (tools + fixtures extracted): review inventory, validate surface.
- CP2 after HarvestablesHandler.
- CP3 after MobsHandler.
- CP4 after PlayersHandler.
- CP5 after ChestsHandler + FishingHandler.
- CP6 after DungeonsHandler + WispCageHandler.
- CP7 after EventRouter extension, before PR.

At each CP: tests passed, `@suspect` found, surprises, decision go/no-go.

### Bailout rule

If during characterization a bug surfaces that:
- Blocks 5 or more tests in cascade, OR
- Is a user-visible regression that a stakeholder is waiting on, OR
- Is about to be fixed by another active plan anyway

Then suspend the characterization loop, land the fix in a dedicated PR (TDD red-green, the `@suspect` test becomes `@verified`), resume characterization. Default preference: scope discipline. Pivot only when above conditions are met.

## Issue mapping

### Already covered by active plans (tests feed the fixes)

| Issue | Title | Plan | Expected test outcome |
|---|---|---|---|
| #65 | Alert not triggering | alerts-and-ignore-list | `@suspect` in PlayersHandler alert-gate |
| #57 | map.isBZ always false Protocol18 | protocol18-regressions | `@suspect` in EventRouter JoinFinished |
| #52 | Living Fiber tier mismatch | protocol18-regressions | Possibly `@suspect` in HarvestablesHandler living spawn (if corpus exposes litigious Fiber) |
| #36 | Ignored players trigger alerts | alerts-and-ignore-list | `@suspect` in PlayersHandler alert-gate |
| #32 | Living harvestables require e0 | living-harvestables-fix | `@suspect` in HarvestablesHandler enchant update + filtering |
| #30 | Hides do not show up | living-harvestables-fix | Same cluster as #32 |

### Integrated into characterization without existing plan

| Issue | Integration |
|---|---|
| #29 Chests rarity vs chestName | Characterize `ChestsHandler.addChestEvent` field storage. Likely `@suspect`. |
| #25 Fishpool invalid | Characterize `FishingHandler.newFishEvent` on corpus fish spots. Likely `@suspect`. |
| #54 Code census | `photon-dump --inventory` output contributes. Can close #54 after inventory review at CP1. |

### Out of scope

- #58 typeId overlay: rendering feature, separate plan if prioritized.
- #53 single enum: cross-cutting refacto, better tackled after characterization provides the safety net.
- #24 Mist Detection: feature request, not bug.
- #44, #59, #47: meta or non-actionable.

## Testing and verification

### Invariants

- `beforeEach` instantiates fresh handler, no cross-test state.
- One intent per `it()`.
- Inline `vi.fn()` stubs, default benign returns, overridden only when test requires.
- Assertions on observable state (getPlayerList().[0].faction), not internals.
- Label in `it()` description, no exception.
- Fixture source declared in 2-line header comment.

### Verification runs

Per scenario: `npm test -- <path>` green with `✓ 1 passed` visible.

Per handler checkpoint:
```
npm test        # full suite green
npm run lint    # green
```

Before PR:
```
npm test
npm run lint
go build ./...
go test ./...
make run        # smoke test binary starts
```

Per Rule 5 of CLAUDE.md, no completion claim without fresh output as evidence.

### Counter README

Co-located tests break the legacy `web/scripts/__tests__/handlers/` layout. Two candidate locations, decided at CP1:

- **Option A**: `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`. Living progress doc, evolves with the plan, archived at plan completion.
- **Option B**: `web/scripts/handlers/_COVERAGE.md`. Co-located with the sources under test. Visible when browsing handlers, less visible at project level.

Default: Option A. Decide at CP1 if browsing frequency suggests B instead.

Discipline: no commit of a scenario without updating the counter.

Final shape expected:
```
| Handler | @verified | @characterization | @suspect | Total |
| PlayersHandler | ... | ... | ... | ~24 |
| HarvestablesHandler | ... | ... | ... | ~42 |
| MobsHandler | ... | ... | ... | ~33 |
| ChestsHandler | ... | ... | ... | ~7 |
| FishingHandler | ... | ... | ... | ~5 |
| DungeonsHandler | ... | ... | ... | ~11 |
| WispCageHandler | ... | ... | ... | ~3 |
| EventRouter | ... | ... | ... | ~30 |
| Total | ~125 | ~20 | ~10 | ~155 |
```

### Expected label distribution

- `@verified` : 70-80%
- `@characterization` : 15-20%
- `@suspect` : 5-10%

### Rate limiter on suspects

If 3 consecutive `@suspect` in one handler: extended stop-and-discuss. Possible causes: misread handler intent, cluster of real bugs, wrong fixture shape. User decides whether to continue or back off.

## Risks

- **R1** Scope creep past 220 scenarios. Mitigation: hard cap, mandatory CP decisions, possibility to close a handler on minimal coverage.
- **R2** Pcap missing variants (no hellgate, no T8 ORE). Mitigation: `--inventory` exposes gaps at CP1, adjust scope or synthesize critical cases.
- **R3** `--scrub-string` corrupts pcap. Mitigation: dedicated unit test on synthetic case, post-scrub pcap must decode identically to original (except scrubbed string).
- **R4** `photon-dump` JSON schema misaligned with what Vitest tests consume. Mitigation: align with the format `EventRouter.test.js` (PR #51) already uses. First characterization scenario runs end-to-end before mass fixture generation.
- **R5** Cascade of `@suspect` in HarvestablesHandler. Expected. Rate limiter (3 consecutive) forces stop-and-discuss.
- **R6** Tests fragile to next Albion patch. Intended. Failing tests are the signal.
- **R7** `feat/revival` PR merge conflicts. Mitigation: rebase clean, verify `git log main..HEAD` is only new commits.
- **R8** Work volume (30-75 hours). Mitigation: checkpoints, bailout option, possibility to split into multiple intermediate PRs.

## Handoff

Post merge of `feat/handlers-characterization`:

1. **`2026-04-18-protocol18-regressions-design.md`** patched: remove "capture safe + BZ pcaps" step (fixtures already present). Tests for #52 and #57 already `@suspect` via characterization. Plan flips them to `@verified` via fix.
2. **`2026-04-18-alerts-and-ignore-list-design.md`**: `@suspect` tests on #36/#65 become the regression pins. Plan delivers fix, tests flip to `@verified`.
3. **`2026-01-15-living-harvestables-fix-design.md`**: same pattern for #30/#32.
4. **Issue #54**: potentially closable after `--inventory` output reviewed at CP1.
5. **Issue #29** (Chests): if `@suspect` confirms bug, new small fix plan or folded into alerts plan if scope matches.
6. **Issue #25** (Fishpool): same pattern as #29.

## Dependencies

- PR #64 merged on main (ships `tools/anonymize-pcap/`, `internal/photon/testdata/move_map_change.pcap`).
- `feat/revival` merged on main (ships realignment docs).
- `capture.pcap` provided locally (done).
- User available for stop-and-discuss on anomalies.

## Success criteria

1. 7 detection handlers + EventRouter covered with `@verified` or `@characterization` tests forming a safety net.
2. Fixture corpus reusable by 3 other active plans without re-capture.
3. All known bugs (#29, #30, #32, #36, #52, #57, #65, #25) documented as `@suspect` with IMPROVEMENTS.md cross-link.
4. Zero handler modifications.
5. `npm test` and `go test` green on main after merge.
