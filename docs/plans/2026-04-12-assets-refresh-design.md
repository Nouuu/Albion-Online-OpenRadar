# Assets Refresh Design

| Field | Value |
|---|---|
| Status | Queued, starts after photon event codes refresh |
| Created | 2026-04-12 |
| Priority | Medium |
| Depends on | `2026-04-12-photon-event-codes-refresh-design.md` |
| Blocks | None |
| User action required | None (network-only, runs locally) |
| GitHub interaction | None, user is on standby |

## Context

The project ships with game data files under `web/ao-bin-dumps/` (items, mobs, harvestables, etc.) and image assets (item icons, spell icons, map tiles). These are periodically refreshed from upstream sources via scripts under `tools/` and Makefile targets. They have not been refreshed recently and are likely out of date relative to current Albion patches.

This plan audits the existing refresh workflow, runs the full refresh once, fills documented gaps, and adds Makefile targets that make ongoing maintenance routine. Scope is strictly refresh of existing asset categories. No new asset category is introduced in this plan (chest rarity via `lootchests.json` remains out of scope despite issue #29).

## Goals

- All existing game data files and image assets refreshed to the latest upstream version.
- The existing filter-and-compress convention preserved (data files are rewritten to keep only the fields the project uses, then gzipped).
- A documented procedure in `docs/dev/ASSETS.md` for future refresh cycles.
- Two additional Makefile targets: `verify-assets` (diff check vs upstream) and `assets-report` (inventory with sizes and dates).
- No regression in the frontend after the refresh.

## Non-goals

- No new asset category. `lootchests.json` integration stays off the table.
- No changes to the filter-and-compress logic itself unless a script is broken.
- No rework of the TS tooling pipeline.

## Execution

This plan starts after the Photon event codes refresh plan is complete. Sequential order per user directive.

### Step 1. Audit existing tooling

Read each script under `tools/` and produce a short note per file covering: input source URL, output path, filter fields kept, gzip behavior.

Files:

- `tools/update-ao-data.ts`
- `tools/download-and-optimize-item-icons.ts`
- `tools/download-and-optimize-spell-icons.ts`
- `tools/download-and-optimize-map.ts`
- `tools/compress-game-data.ts`
- `tools/common.ts`

Store the notes inline in the script files as header comments if they are missing, or in `docs/dev/ASSETS.md` if a script has no obvious doc home.

### Step 2. Dry-run the existing refresh targets

On a clean working copy, run in order:

```
make update-ao-data
make download-assets
```

Observe:

- What was downloaded (log lines, file hashes before and after)
- Any script failure (network, rate limit, source URL moved)
- Delta in file sizes and counts in `web/ao-bin-dumps/` and `web/images/`

If a script fails, fix the script as the first TDD task of this plan. Each fix is a RED-GREEN cycle on a Vitest test that checks the script's public surface (parser on a fixture input, not the live fetch).

### Step 3. Identify gaps

For each asset category, answer:

- Is the upstream source still reachable and current?
- Is the filter logic still correct? (fields kept vs fields present)
- Are there new entries upstream that the old filter silently drops even though we would want them?

Record findings in a small inventory table in `docs/dev/ASSETS.md`:

| Category | Upstream | Last refresh | Freshness | Gap |
|---|---|---|---|---|

### Step 4. Full refresh

Run the refresh scripts for real. Sanity checks:

- Diff the decompressed data before and after to spot suspicious drops.
- Confirm at least the three databases the handlers actually use (`ItemsDatabase`, `MobsDatabase`, `HarvestablesDatabase`) load in the browser without errors.
- Confirm `web/images/Items/`, `web/images/Spells/`, map tiles reflect new files.

### Step 5. Add `make verify-assets`

A new Makefile target that reports whether the local assets match upstream without downloading them in full. Strategy options:

- Hit the upstream index file (if ao-bin-dumps publishes a manifest or commit hash) and compare to a recorded hash in `work/last-refresh.json`.
- Or, compare file sizes via HEAD requests to known URLs.

Pick whichever is simplest given the upstream format. If no reliable probe exists, fall back to a timestamp-based warning ("last refresh was N days ago").

Implementation under `tools/verify-assets.ts`. Vitest test on the comparison logic with a fixture manifest.

### Step 6. Add `make assets-report`

A new Makefile target that prints a human-readable inventory of current assets: counts, total sizes, date of last refresh per category. Uses `tools/assets-report.ts`. Vitest test on the formatting.

### Step 7. Write `docs/dev/ASSETS.md`

New documentation covering:

- What lives where (`web/ao-bin-dumps/`, `web/images/`, etc.)
- The filter-and-compress convention explained clearly so a future session does not break it
- Where upstream data comes from (source URLs for each category)
- How to refresh (`make update-assets`, `make verify-assets`, `make assets-report`)
- When to refresh (after each Albion patch, or on-demand if community reports bugs)
- How to debug a failed refresh

### Step 8. Two-commit split

This plan produces two commits, not one, because the second commit is a large data diff:

1. First commit: Makefile targets, new TS scripts, `ASSETS.md`, and any script fixes. Small diff, easy to review.
2. Second commit: the refreshed data files. Large diff, easy to revert if it introduces a regression.

Both commits land in one PR if the user lifts standby, or stay local otherwise.

## Files touched

| File | Action |
|---|---|
| `Makefile` | Add `verify-assets`, `assets-report` targets |
| `tools/update-ao-data.ts` | Fix if broken, add header doc |
| `tools/download-and-optimize-item-icons.ts` | Fix if broken, add header doc |
| `tools/download-and-optimize-spell-icons.ts` | Fix if broken, add header doc |
| `tools/download-and-optimize-map.ts` | Fix if broken, add header doc |
| `tools/compress-game-data.ts` | Fix if broken, add header doc |
| `tools/verify-assets.ts` | New |
| `tools/verify-assets.test.ts` | New |
| `tools/assets-report.ts` | New |
| `tools/assets-report.test.ts` | New |
| `docs/dev/ASSETS.md` | New |
| `web/ao-bin-dumps/**` | Refreshed (second commit) |
| `web/images/Items/**` | Refreshed (second commit) |
| `web/images/Spells/**` | Refreshed (second commit) |
| `web/images/Maps/**` | Refreshed (second commit) |
| `work/last-refresh.json` | New, records last known upstream hashes |

## Verification

1. `make update-assets` runs without error.
2. `make verify-assets` reports "up to date" after a refresh.
3. `make assets-report` prints a readable inventory.
4. `npm test` green on the new Vitest suites for verify-assets and assets-report.
5. `make run` starts the binary, radar renders, entities visible, no 404s in browser devtools for asset URLs.
6. Chrome devtools network tab shows assets served from the new files.
7. For a T8 resource and a mob, the image loads correctly (ImageCache hit).

## Out of scope

- Chest rarity via `lootchests.json` (issue #29).
- Zone database refresh (handled separately if and when needed).
- Any new Makefile target beyond `verify-assets` and `assets-report`.

## Risks

- Upstream source URLs may have changed. Mitigation: step 1 (audit) catches this before step 4 (refresh).
- A refreshed data file may contain a breaking schema change. Mitigation: load-test in `make run` after the refresh, run the existing handlers against the new data.
- A large data diff is hard to review. Mitigation: split commit (step 8).
