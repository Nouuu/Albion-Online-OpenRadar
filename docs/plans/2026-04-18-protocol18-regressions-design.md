# Protocol18 Regressions Fix Design

| Field | Value |
|---|---|
| Status | Active, queued after handlers characterization |
| Created | 2026-04-18 |
| Priority | High (user-facing regressions introduced by PR #51) |
| Depends on | `docs/plans/notes/2026-04-18-handlers-characterization-with-real-fixtures-design.md` (safety net, successor to the superseded `2026-04-12-handlers-characterization-coverage-design.md` now archived) |
| Blocks | None |
| User action required | Yes, live Albion capture for isBZ hashtable reverse |
| GitHub interaction | None during execution (standby) |

## Context

PR #51 (merged 2026-04-16) ported the Photon wire parser to Protocol18 and fixed several frontend regressions (opMove 21 to 22, JoinFinished zone id, ChangeCluster 41). Two user-facing regressions remain open:

- **#57** `map.isBZ` always false after Protocol18. Parameter index 103 in JoinFinished changed from a scalar integer to a hashtable with sub-keys. The assignment `map.isBZ = Parameters[103] == 2` was dropped in the port rather than reverse-engineered. Impact is limited because `zonesDatabase.getPvpType(map.id)` is the primary source for black-zone detection, but `map.isBZ` is cached and serialized, and downstream code paths may still read it.
- **#52** Living resource tier mismatch on Fiber. Observed T4 displayed as T5. Tier for living resources is derived from `mobileTypeId` via `MobsDatabase.getResourceInfo(mobileTypeId).tier`. Either `mobileTypeId` meaning changed in Protocol18, the lookup table is stale, or the display logic is off by one.

Both require a diagnostic step before code change.

## Goals

- `map.isBZ` correctly reflects the black-zone state for the current zone after a JoinFinished event, post-Protocol18.
- Living resources display the correct tier on the radar, confirmed on at least three different living resource types (Fiber, Hide, Ore-living if any).
- Both fixes ship with Go or Vitest tests that pin the contract, so a future Protocol refactor cannot silently regress again.

## Non goals

- No refactor of the Photon parser.
- No new feature (no typeId overlay from #58, that stays a separate future plan).
- No fix of the legacy living harvestables bugs #30 and #32 (those have their own plan `2026-01-15-living-harvestables-fix-design.md`).

## Part A. #57 map.isBZ reverse engineering and fix

### Step 1: Capture a pair of live sessions

User action. Capture two pcap traces:

- `work/captures/2026-04-18-safe-zone.pcap`: login in a blue or yellow zone
- `work/captures/2026-04-18-black-zone.pcap`: login in a black zone (any black zone entrance or port)

Capture command: on Linux or WSL, `sudo tcpdump -i <iface> -w <path> 'udp port 5056'` during login, until the zone change response is visible.

Feed each pcap to `tools/anonymize-pcap/` (from PR #64) to strip personal data. Store the anonymized versions in `internal/photon/testdata/`.

### Step 2: Decode JoinFinished params[103] from each

Write a throwaway Go test that runs the Protocol18 parser on each fixture, isolates the JoinFinished response (opResponse code 2, identified in PR #51), and dumps `params[103]` in full. Compare the two dumps. The sub-key that differs between safe and black zones is the isBZ signal.

Likely candidates based on the Parameter 103 hashtable shape observed so far: `{5: ..., 7: ...}`. The value that is 2 in the black-zone capture and not 2 in the safe-zone capture is the signal.

### Step 3: Fix the frontend extraction

Edit `web/scripts/core/EventRouter.js` in the JoinMap handler (around lines 387 to 428 per the triage). After extracting `map.id` from `Parameters[8]`, read the identified sub-key from `Parameters[103]` and assign `map.isBZ = hashtable[subKey] === 2`. Keep the existing sessionStorage persistence.

### Step 4: Vitest test

Add a test in `web/scripts/core/EventRouter.test.js` that exercises the `onResponse` path with a hand-crafted opResponse 2 message containing the hashtable shape for a black zone, asserts `map.isBZ === true`. Same for safe zone, asserts `false`.

### Step 5: Commit

Single commit `fix(zones): restore map.isBZ extraction post-Protocol18 (#57)`.

## Part B. #52 living resource tier diagnostic and fix

### Step 1: Reproduce with a targeted capture

User action. Find a zone with Fiber nodes (T4 or T5 living resource). Capture the session: `work/captures/2026-04-18-fiber-t4.pcap`. Note in a sidecar text file the expected tier shown in game.

### Step 2: Extract NewHarvestableObject events from the capture

Write or reuse a Go test harness that reads the pcap, filters event 40 (`NewHarvestableObject`) packets, and dumps the full parameter map for each. Identify:

- The tier parameter position in the current Protocol18 params (deatheye offsets.json says offsets[2] for tier, but that is pre-Protocol18)
- The `mobileTypeId` parameter position
- Correlate against what the game shows on screen

### Step 3: Trace the frontend handler

Read `web/scripts/handlers/HarvestablesHandler.js`:
- Entry point `newHarvestableObject(id, Parameters)` at line 384 (called by EventRouter on event 40, NewHarvestableObject).
- It decodes parameters and delegates to `addHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId = null)` at line 158, where the living-vs-static discrimination and tier resolution live.
- Companion path: `HarvestUpdateEvent(Parameters)` at line 326 (event 46) for size and enchant updates on existing harvestables.

The living-resource tier logic in `addHarvestable`:

```javascript
const isLiving = mobileTypeId !== null && mobileTypeId !== 65535;
if (isLiving) {
  tier = MobsDatabase.getResourceInfo(mobileTypeId).tier;
}
```

Check:

- Is `mobileTypeId` being read from the correct Protocol18 parameter index?
- Does `MobsDatabase.getResourceInfo(mobileTypeId)` return an entry for the captured Fiber typeId?
- Does that entry carry the right tier?
- Is there an off-by-one between tier stored in `mobs.min.json` and tier sent by the server?

### Step 4: Fix

Depending on the diagnostic outcome:

- If `mobileTypeId` is read from the wrong index: fix the extraction in `HarvestablesHandler.newHarvestableObject`.
- If the lookup table is stale: regenerate `web/ao-bin-dumps/mobs.min.json` via `make update-ao-data` and commit, plus a targeted assertion on a known typeId.
- If it is off-by-one in derivation: fix the tier math.

### Step 5: Vitest test

Add a test in a new `web/scripts/handlers/HarvestablesHandler.test.js` that constructs a `NewHarvestableObject` event with a known living-resource typeId and asserts the resulting entity has the expected tier.

### Step 6: Commit

Single commit `fix(harvestables): correct living resource tier derivation (#52)`.

## Files touched

| File | Action |
|---|---|
| `web/scripts/core/EventRouter.js` | Patch isBZ extraction |
| `web/scripts/core/EventRouter.test.js` | Add isBZ tests |
| `web/scripts/handlers/HarvestablesHandler.js` | Fix living resource tier path |
| `web/scripts/handlers/HarvestablesHandler.test.js` | New file, living tier tests |
| `web/ao-bin-dumps/mobs.min.json` | Refresh only if lookup table found stale |
| `internal/photon/testdata/*.pcap` | New fixtures for isBZ and tier scenarios |

## Verification

1. `npm test` green, including the new isBZ and tier tests.
2. `go test ./internal/photon/...` green.
3. In a live session entering a black zone, the radar UI picks up the correct pvp indicator based on `map.isBZ`.
4. In a live session near Fiber nodes, the radar shows the correct tier for each node.
5. No other handler or drawing regresses.

## Risks

- **Zone captures may reveal other Protocol18 drift** beyond what this plan addresses. Scope discipline: any new issue found goes to `docs/project/IMPROVEMENTS.md` and a separate plan if material.
- **`mobs.min.json` refresh may introduce a large diff** with unrelated changes. Mitigation: refresh in a separate commit, filter the diff to confirm only expected entries moved.
- **Capture fixtures contain personal data** (character name, IP). Use `tools/anonymize-pcap/` before committing.

## Out of scope

- Issue #58 (typeId debug overlay): separate plan if the user prioritizes it.
- Issue #53 and #54 (enum and capture): separate future plans.
- Any non-Protocol18 regression.
