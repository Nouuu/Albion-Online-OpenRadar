# Photon Event Codes Refresh Design

> **STATUS: SUPERSEDED on 2026-04-18**
>
> The intent of this plan was delivered by parallel work while the project was in standby:
>
> - **PR #51 (merged 2026-04-16) fix(photon): port wire parser to Protocol18** rewrote `internal/photon/` entirely (new files `deserializer.go`, `packet.go`, `types.go`, `events.go`, `readers.go`, `typecodes.go`; dropped `protocol16.go`). Included 57 Go tests plus 4 live pcap fixtures plus 11 Vitest tests on `EventRouter.js`. Closes issues #49 and #50 (Protocol18 wire format).
> - **PR #64 (open, ready) test(photon): pin Protocol18 router contract via pcap fixtures** adds `tools/anonymize-pcap/` for fixture creation, plus `internal/photon/live_pcap_test.go` router contract assertions. Covers the `cmd/photon-dump/` and `testdata/photon/` ambitions of this plan.
> - **Reference repo cross-check** (see `work/data/`): `AlbionOnline-StatisticsAnalysis` confirmed as the authoritative Protocol18 reference. Event codes align across sources except minor drift that does not affect functional routing.
> - **PR #46 (community updated eventcodes)** is now obsolete; `EventCodes.js` in that PR is byte-identical to current main after #51.
>
> Remaining scope split into new focused plans:
>
> - `2026-04-18-protocol18-isbz-fix-design.md` for issue #57 (map.isBZ regression)
> - `2026-04-18-living-resources-unified-fix-design.md` for issues #30, #32, #52
> - Issue #53 (single source of truth enum) and issue #54 (capture all live codes) become their own future plans if the user prioritizes them
>
> This plan is kept in `docs/archive/` as a historical record.

| Field | Value |
|---|---|
| Status | **SUPERSEDED** (see banner above) |
| Created | 2026-04-12 |
| Archived | 2026-04-18 |
| Priority | N/A |
| Depends on | N/A |
| Blocks | N/A |
| User action required | N/A |
| GitHub interaction | N/A |

## Context

The Albion Photon event code table has drifted over the course of 2025-2026 game updates. Community issues report:

- Issue #24 (Mist detection stopped working)
- Issue #25 (Fishpool bug, likely same root cause)
- PR #46 (community contribution rewriting `web/scripts/utils/EventCodes.js`, +665/-637)

Comment from PR #46 author suggests fishing event codes are "maybe changed by +2".

An existing inconsistency was also found during the audit:

- `web/scripts/utils/EventCodes.js` defines `NewMob: 123`
- `web/scripts/core/EventRouter.js` getEventName() helper hardcodes `71: 'NewMob'`

These two locations disagree. Either the helper is dead debug code, or the event code file is partially stale.

This plan refreshes `EventCodes.js` and the Go parser against three independent sources, validates every code with real Photon captures via fixtures under `testdata/photon/`, and decides the fate of PR #46 based on evidence. Issues #24 and #25 are resolved in this plan as a side effect. No interaction with GitHub issues or the PR itself is in scope (project is currently in standby on GitHub).

## Goals

- One validated `EventCodes.js` file, cross-referenced against at least three independent sources.
- An extraction tool at `cmd/photon-dump/` that reads a pcap and emits curated Photon payloads.
- A test dataset at `testdata/photon/` containing one fixture per critical scenario.
- Go tests in `internal/photon/*_test.go` that prove the parser decodes each fixture to the expected events.
- A decision on PR #46: merge as is, rewrite, or refuse, documented in this plan once the evidence is in.
- Fix for the `NewMob` helper disagreement between EventCodes.js and EventRouter.js.

## Non-goals

- No commenting on, labeling, or closing GitHub issues. The user is on standby with GitHub until further notice.
- No new features in the parser (chests rarity, mist gameplay, etc.). Strictly code table refresh and regression fix.

## Reference sources

Already cloned under `work/data/`:

| Source | Path | Role |
|---|---|---|
| AlbionOnlinePhotonEventIds | `work/data/AlbionOnlinePhotonEventIds/EventCodes.txt` | Community dedicated event id list |
| albion-radar-deatheye-2pc | `work/data/albion-radar-deatheye-2pc/` | C# radar project, previous reference |
| AlbionOnline-StatisticsAnalysis | `work/data/AlbionOnline-StatisticsAnalysis/` | Major stats project, active maintainer |
| AlbionRadar | `work/data/AlbionRadar/` | Alternative C# radar implementation |
| albion-network | `work/data/albion-network/` | Low-level Photon deserialization library |

A local raw extract `work/opcodes.json` also exists for operation codes (`Parameters[253]`), used by `onRequest` and `onResponse` in EventRouter.js.

## Execution

Steps are ordered. TDD applies at every code-writing step. The live capture step (step 6) requires user participation.

### Step 1. Pull reference repos

For each directory under `work/data/`, run `git fetch && git pull --rebase` (or equivalent). Record the last commit date per repo. Any repo older than 6 months is flagged as potentially stale but not dropped.

### Step 2. Extract event codes from each reference

Write a one-off script `tools/extract-reference-event-codes.ts` (TS, fits the existing `tools/` convention) that:

- Parses `AlbionOnlinePhotonEventIds/EventCodes.txt` into `{name: code}`.
- Scans `albion-radar-deatheye-2pc` for C# enum definitions of event codes.
- Scans `AlbionOnline-StatisticsAnalysis` for the same.
- Scans `AlbionRadar` for the same.
- Outputs a single JSON at `work/event-codes-cross-ref.json` with one row per event name and one column per source, plus a column for the current `web/scripts/utils/EventCodes.js`.

Script is Vitest-covered with a small fixture per parser (so we know it extracts correctly). RED-GREEN-REFACTOR.

### Step 3. Fetch PR #46 diff locally without interacting

```
gh pr diff 46 --repo Nouuu/Albion-Online-OpenRadar > work/pr-46.diff
```

Read the diff, extract the new `EventCodes.js` proposal into a temporary `work/event-codes-pr46.js`. Add the PR #46 column to `work/event-codes-cross-ref.json`.

### Step 4. Cross-reference analysis

Produce `work/event-codes-analysis.md` listing:

- Events where all sources agree. Mark as consensus.
- Events where at least 2 of 4 external sources agree but disagree with current. Mark as probable-fix.
- Events where sources disagree among themselves. Mark as needs-capture.
- Events present in current but missing from all sources. Mark as unknown-origin.
- Events present in external sources but missing from current. Mark as possibly-new.

This file is committed for traceability.

### Step 5. Build `cmd/photon-dump/`

New Go binary. Responsibilities:

- Input: a `.pcap` or `.pcapng` file path.
- Output: raw Photon payloads extracted from UDP 5056 traffic, written as numbered `.bin` files plus a `manifest.json` describing source packet index, timestamp, and size.
- No Photon parsing here. This tool is a dumb extractor that reuses the packet filter logic from `internal/capture/pcap.go` but reads a file instead of a live device.

TDD sequence:

1. Write a failing Go test that feeds a tiny synthetic pcap (crafted manually or generated with a helper) to the extractor and asserts one payload is dumped.
2. Implement the extractor until the test passes.
3. Add a second test: multi-packet pcap, assert ordered manifest.
4. Add a third test: non-5056 UDP traffic is filtered out.

Files:

- `cmd/photon-dump/main.go`
- `cmd/photon-dump/extractor.go`
- `cmd/photon-dump/extractor_test.go`
- `cmd/photon-dump/testdata/synthetic.pcap` (crafted via gopacket or committed as a fixture)

### Step 6. Live capture session (requires user)

User runs the game and captures a pcap covering at minimum:

- Local player movement (Request 21, Response 35, Response 2)
- Resource spawn batch (Event 38, 39)
- Resource individual spawn (Event 40)
- Resource size update and depletion (Event 46)
- Harvest start / cancel / finished (Events 59, 60, 61)
- Mob spawn (NewMob, whatever code it really is)
- Mob health updates and move (Events 6, 7, 91, 3)
- Player join/leave (Events 1, 2, 29)
- Zone change (Response 35)
- Loot chest open (NewLootChest variant)
- Fishing full cycle (FishingStart through FishingFinished)
- Mist entrance, if possible
- Caged wisp, if possible

Capture command (Linux/WSL): `sudo tcpdump -i <iface> -w capture.pcap 'udp port 5056'`. On Windows: use Wireshark with the same filter. Store the pcap at `work/captures/<date>-<scenario>.pcap`. This directory is gitignored (capture files can be large and sensitive).

### Step 7. Extract fixtures

Run `cmd/photon-dump/` on the capture. Hand-curate the most informative payloads into `testdata/photon/`:

- File pairs `<scenario>.bin` + `<scenario>.json`.
- The `.json` file lists the expected decoded events (event code, key parameters) as ground truth.
- Scenario naming: `harvestable_t6_spawn`, `harvestable_depletion`, `mob_spawn_green`, `mist_entrance`, etc.

Fixtures are checked into git (small binary files, acceptable).

### Step 8. Photon parser tests

Write a test file `internal/photon/protocol16_fixtures_test.go` that:

- Iterates over every fixture pair in `testdata/photon/`.
- Runs the parser against the raw payload.
- Compares the decoded result to the expected JSON.

TDD flow: the first run is RED on every fixture. For each failure, either fix `EventCodes.js` (and the corresponding Go constant), fix `protocol16.go`, or update the fixture if the expectation was wrong. Iterate until all fixtures are GREEN.

### Step 9. Produce the final EventCodes.js

Based on the consensus table plus the fixtures:

- Keep events marked consensus as is.
- Apply the probable-fix events with the majority value.
- Apply the capture-validated events from step 8.
- Remove unknown-origin events that no source confirms and that no fixture uses.

Mirror the change in any Go constants that duplicate event ids.

### Step 10. Reconcile EventRouter.js helper

Fix the disagreement found during audit:

- `getEventName()` in `web/scripts/core/EventRouter.js` uses a hardcoded `{71: 'NewMob', ...}` table.
- Either delete that helper and derive names from `EventCodes.js` at runtime.
- Or update the table to match `EventCodes.js` exactly.

Prefer derivation (one source of truth). Write a Vitest test to prove the helper returns the same name for every code present in `EventCodes.js`.

### Step 11. PR #46 decision

Document the outcome at the bottom of this plan:

- If PR #46 matches the validated file: mergeable as is, local merge once user leaves standby.
- If PR #46 partially matches: the validated file stands, PR #46 is closed with a reference to this plan.
- If PR #46 introduced anything we missed: cherry-pick that specific change and still reject the rest.

No action is taken on GitHub now. The decision is recorded for when the standby lifts.

## Files touched

| File | Action |
|---|---|
| `web/scripts/utils/EventCodes.js` | Rewrite with validated codes |
| `web/scripts/core/EventRouter.js` | Reconcile `getEventName()` helper |
| `internal/photon/protocol16.go` | Patch any Go constants and decoding logic that event codes changed |
| `cmd/photon-dump/main.go` | New |
| `cmd/photon-dump/extractor.go` | New |
| `cmd/photon-dump/extractor_test.go` | New |
| `cmd/photon-dump/testdata/synthetic.pcap` | New |
| `tools/extract-reference-event-codes.ts` | New |
| `tools/extract-reference-event-codes.test.ts` | New |
| `internal/photon/protocol16_fixtures_test.go` | New |
| `testdata/photon/*.bin` | New (one per scenario) |
| `testdata/photon/*.json` | New (one per scenario, expected decode) |
| `testdata/photon/README.md` | New, documents capture and fixture procedure |
| `work/event-codes-cross-ref.json` | New, traceability artifact |
| `work/event-codes-analysis.md` | New, cross-reference analysis |
| `.gitignore` | Add `work/captures/` |

## Verification

End-to-end checklist:

1. `go build ./...` compiles.
2. `go test ./internal/photon/...` green on every fixture.
3. `npm test` green on Vitest extraction tests and EventRouter helper tests.
4. `cmd/photon-dump/` runs against a real capture and produces a manifest that matches the number of Photon frames.
5. Live session with the fresh build: previously broken scenarios from issues #24 and #25 (Mist, Fishpool) now show up on the radar.
6. `make run` starts the binary, radar renders, entities appear, no console errors in the browser devtools.

## Out of scope

- Closing or commenting on issues and PRs on GitHub.
- Integrating `lootchests.json` for chest rarity (issue #29).
- ZoneManager refactor (deferred plan).
- Any UI change.

## Risks

- Some event codes may be game-mode specific (solo mist vs group mist). A single capture may miss them. Mitigation: capture multiple scenarios, document the gaps, re-capture later if needed.
- The Photon parser in Go may crash on unexpected payloads after a code refresh. Mitigation: tests run before any merge, parser panics are caught and logged as test failures.
- Reference repos may themselves be stale. Mitigation: PR #46 plus live capture are the two fresh sources. Reference repos serve as priors, not as authority.

## Decision log

_To be filled in as evidence arrives._

- PR #46 status: pending
- NewMob code value: pending
- Mist event family: pending
- Fishing offset claim "+2": pending
