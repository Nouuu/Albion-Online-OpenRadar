# Alerts and Ignore List Fix Design

| Field | Value |
|---|---|
| Status | Active, queued after Protocol18 regressions |
| Created | 2026-04-18 |
| Priority | Medium (user-facing, pre-existing plus community regression) |
| Depends on | `docs/plans/notes/2026-04-18-handlers-characterization-with-real-fixtures-design.md` (safety net on PlayersHandler, successor to the superseded `2026-04-12-handlers-characterization-coverage-design.md` now archived) |
| Blocks | None |
| User action required | Minimal (in-game verification on a few zones) |
| GitHub interaction | None during execution (standby) |

## Context

Two bugs cluster around the player alert and ignore pipeline in `web/scripts/handlers/PlayersHandler.js`:

- **#36** (legacy, 2026-01) Ignored players still trigger alerts. The triage shows there is no ignore-list check in the alert path (`PlayersHandler.js:157-174`). A related concern is that unknown zones default to `pvpType === 'safe'` in `ZonesDatabase.getPvpType`, which can suppress alerts on real PvP maps that are missing from the zone database.
- **#65** (community, 2026-04-18) Alert not triggering. Body is empty but the reporter context suggests the alert sound and flash are silent when hostile players are nearby. Triage links this to the same `isPlayerThreat` gate and the safe-map default that also backs #36.

Both bugs touch the same gate, in the same file. Fixing them together makes sense: we harden the gate once, and add explicit ignore-list evaluation.

## Goals

- Ignored players never trigger sound, flash, or toast alerts, regardless of zone.
- Hostile players in a real PvP zone reliably trigger alerts.
- Unknown zones do not default to `safe` when the zone id clearly points at a PvP area (Avalon hideouts, unmapped black-zone subzones).
- Regression tests pin the gate so future refactors cannot silently break it.

## Non goals

- No new alert channel (no Discord webhook, no Windows toast, etc.).
- No ignore-list UI work.
- No exhaustive zone database refresh. Only the default-safe behavior is adjusted.

## Investigation

### Step 1: Confirm the gate and path

Read `web/scripts/handlers/PlayersHandler.js` around lines 92 to 174 (per triage):

- `isPlayerThreat(faction, pvpType)` at lines 92 to 97
- Alert trigger at lines 157 to 174
- Zone pvp lookup via `zonesDatabase.getPvpType(mapId)`

Confirm:

- Where is the ignore list stored? Likely `window.settingsSync.getJSON('ignoredPlayers')` or similar. Grep for `ignoreList`, `ignoredPlayers`, `alreadyIgnoredPlayers`.
- Where is it cleared? Triage mentioned line 253 clears `alreadyIgnoredPlayers`.
- How does the UI expose the ignore list? (Not scope, but identify so the fix matches user expectation.)

### Step 2: Confirm the safe-default behavior

Read `web/scripts/data/ZonesDatabase.js`:

```javascript
getPvpType(zoneId) {
    return this.getZone(zoneId)?.pvpType || "safe";
}
```

Decide on the new default:

- Option A: keep `"safe"` default, but separate "known safe zone" from "unknown zone". Add `getPvpTypeOrUnknown(zoneId)` returning one of `safe`, `yellow`, `red`, `black`, or `unknown`. Alert path treats `unknown` as potentially hostile.
- Option B: change the default to `"unknown"` and adjust every consumer. Higher blast radius.

Option A is lower risk and does not change callers that explicitly want a fallback. Use Option A.

## Fix

### Step 3: Add ignore-list check in the alert path

In `PlayersHandler.js`, before triggering sound or flash, check if the player id is in the ignore list. If yes, skip the alert. Do not skip the detection (the player stays on the radar), only the alert.

Pseudocode:

```javascript
function isIgnored(playerId) {
    const list = window.settingsSync?.getJSON('ignoredPlayers') ?? [];
    return Array.isArray(list) && list.includes(playerId);
}

// in the alert path
if (isThreat && mapId && !isIgnored(player.id)) {
    if (settingFlash) triggerFlash();
    if (settingSound) playSound();
}
```

Confirm the exact list storage key from Step 1. Match the existing convention.

### Step 4: Separate unknown from safe in ZonesDatabase

Edit `web/scripts/data/ZonesDatabase.js` to expose `getPvpTypeOrUnknown(zoneId)` returning `'unknown'` when the zone is missing. Keep the existing `getPvpType` as a backwards-compatible wrapper that maps `unknown` to `safe` for callers that have not been updated.

Update the alert path in `PlayersHandler.js` to use `getPvpTypeOrUnknown`. Treat `unknown` as alert-worthy when a hostile flagged player is detected, since the fallback-to-safe behavior is precisely what was suppressing alerts in unmapped zones.

### Step 5: Tests

Add tests in `web/scripts/handlers/PlayersHandler.test.js`:

- `@verified: ignored player does not trigger alert in a PvP zone`
- `@verified: non-ignored hostile triggers alert in red zone`
- `@verified: non-ignored hostile triggers alert in unknown zone`
- `@verified: no alert in known safe zone regardless of faction`

Add tests in `web/scripts/data/ZonesDatabase.test.js` (create if absent):

- `@verified: getPvpType returns safe as a fallback (legacy)`
- `@verified: getPvpTypeOrUnknown returns unknown when zone is missing`

### Step 6: Commit

One commit per fix for cleanliness:

- `fix(players): skip alerts for ignored players (#36)`
- `fix(zones): separate unknown zone from safe default (#36, #65)`
- `fix(players): alert on hostile in unknown zone (#65)`

## Files touched

| File | Action |
|---|---|
| `web/scripts/handlers/PlayersHandler.js` | Add ignore-list check, switch to getPvpTypeOrUnknown |
| `web/scripts/handlers/PlayersHandler.test.js` | New file, alert gate tests |
| `web/scripts/data/ZonesDatabase.js` | Add getPvpTypeOrUnknown |
| `web/scripts/data/ZonesDatabase.test.js` | New file, fallback tests |

## Verification

1. `npm test` green including new tests.
2. In a live session, add a player to the ignore list, confirm no flash or sound when they are nearby.
3. In a live session in an unmapped Avalon hideout, confirm alerts fire when a hostile flagged player is detected.
4. In a known safe zone, confirm no alerts fire regardless of faction.

## Risks

- **Ignore list storage key mismatch** could make the fix a no-op. Mitigation: grep the codebase for all storage keys related to ignoring before implementing, confirm with the UI settings page.
- **Changing the default in ZonesDatabase** may surface other callers that assumed safe. Mitigation: `getPvpType` stays backwards compatible, only the alert path switches.
- **Unknown-zone alerts could over-trigger** if many real-world zones are missing from the database. Mitigation: `refresh-assets` step via Makefile can update the zones file; the alert is only on `unknown` AND hostile, not on all players.

## Out of scope

- Ignore-list UI overhaul (separate work if needed).
- Alert channel additions (Discord, etc.).
- Zone database refresh beyond what `make refresh-assets` already covers.
