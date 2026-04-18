# Parallel Work Realignment Note

Date: 2026-04-18.

This note captures the state reconciliation done after the user performed extensive parallel work on the repo from another machine. The previous plan queue was built on assumptions that are now stale. This note records what changed, what was archived, what stays active, and what new plans replace the archived ones.

## Summary of parallel changes

Merged on `main`:

- **PR #51** (2026-04-16) `fix(photon): port wire parser to Protocol18 (closes #49, #50)`. Rewrote `internal/photon/` entirely. New files: `deserializer.go`, `packet.go`, `types.go`, `events.go`, `readers.go`, `typecodes.go`. Dropped `protocol16.go`. Added 57 Go tests, 4 live pcap fixtures, 11 Vitest tests on `EventRouter.js`. Fixed opMove request code 21 to 22 regression, restored `map.id` extraction from JoinFinished `params[8]`, moved ChangeCluster to opResponse 41.
- **PR #61** (2026-04-17) `build: cross-platform Makefile + drop GoReleaser`. Replaced GoReleaser with a cross-platform Makefile using `docker build -f Dockerfile.linux` / `Dockerfile.windows`, `git-cliff` for changelog, `gh release create --draft` for publishing.
- **Composite setup action** `.github/actions/setup` used by both CI and Release workflows.

On `feat/revival` (rebased, SHAs differ):

- Several `chore(deps)` commits updated Go 1.26, Node.js deps, asset data files.

Open PRs at realignment time:

- **PR #64** (ready) `test(photon): pin Protocol18 router contract via pcap fixtures`. Adds `tools/anonymize-pcap/`, extends `live_pcap_test.go` with router contract assertions. All CI green.
- **PR #63** (ready) `fix(shutdown): unblock pcap close + guard log viewport panic`. Two small fixes, all CI green.
- **PR #62** (dependabot) npm security bumps, mergeable.
- **PR #46** (community) `updated eventcodes`. Obsolete. Same `EventCodes.js` as current main after #51.

## Plan queue before and after

### Before realignment (pre 2026-04-18)

| Plan | Status |
|---|---|
| `2025-01-21-goreleaser-single-source-design.md` | Active |
| `2026-01-15-living-harvestables-fix-design.md` | Active |
| `2026-04-12-assets-refresh-design.md` | Active |
| `2026-04-12-handlers-characterization-coverage-design.md` | Active |
| `2026-04-12-photon-event-codes-refresh-design.md` | Active |
| `2026-04-12-release-cicd-automation-design.md` | Active, queued first |
| `2025-12-21-zone-manager-design_DEFERRED.md` | Deferred |

### After realignment (2026-04-18)

Archived to `docs/archive/completed-plans/`:

- `2025-01-21-goreleaser-single-source-design.md` (superseded by PR #61 dropping GoReleaser)
- `2026-04-12-release-cicd-automation-design.md` (superseded, banner inside)
- `2026-04-12-photon-event-codes-refresh-design.md` (superseded, banner inside)
- `2026-04-14-photon-protocol18-port.md` (completed, merged as PR #51)
- `2026-04-12-handlers-characterization-coverage-design.md` (superseded later on 2026-04-18 by brainstorm output `docs/plans/notes/2026-04-18-handlers-characterization-with-real-fixtures-design.md`, banner inside)

Active in `docs/plans/`:

- `2026-04-18-protocol18-regressions-design.md` (new, fixes issues #52 and #57)
- `2026-04-18-alerts-and-ignore-list-design.md` (new, fixes issues #36 and #65)
- `2026-01-15-living-harvestables-fix-design.md` (unchanged, still valid)
- `2026-04-12-assets-refresh-design.md` (unchanged, still valid)

Sidecar (brainstorm output awaiting `superpowers:writing-plans`):

- `docs/plans/notes/2026-04-18-handlers-characterization-with-real-fixtures-design.md` (supersedes the archived handlers-characterization plan, top of execution queue once turned into a plan)

Deferred:

- `2025-12-21-zone-manager-design_DEFERRED.md`

## Issue state mapped to plans

Post-Protocol18 regressions from the parallel work:

| Issue | Title | Target plan |
|---|---|---|
| #57 | map.isBZ always false after Protocol18 | `2026-04-18-protocol18-regressions-design.md` |
| #52 | Living resource tier mismatch on Fiber | `2026-04-18-protocol18-regressions-design.md` |
| #65 | Alert not triggering (community) | `2026-04-18-alerts-and-ignore-list-design.md` |

Legacy bugs:

| Issue | Title | Target plan |
|---|---|---|
| #36 | Ignored players still trigger alerts | `2026-04-18-alerts-and-ignore-list-design.md` |
| #32 | Living harvestables require e0 enabled | `2026-01-15-living-harvestables-fix-design.md` |
| #30 | Hides do not show up | `2026-01-15-living-harvestables-fix-design.md` |
| #25 | Fishpool | No plan yet (low priority, Mist/Fishing cluster) |
| #24 | Mist Detection | No plan yet (feature, low priority) |
| #29 | Chests help | No plan yet (feature, low priority) |

Community and meta:

| Issue | Title | Action |
|---|---|---|
| #65 | [BUG] empty body | Covered by alerts plan (root cause matches) |
| #59 | Why no discord | Not actionable, can be closed whenever user lifts standby |
| #44 | Project on pause | Can be closed when the user lifts standby |

Feature requests from user self-opened:

| Issue | Title | Action |
|---|---|---|
| #58 | typeId debug overlay on living resources | Prerequisite for #52, will likely be folded into the regressions plan if needed for diagnostic |
| #53 | Single source of truth enum for Photon codes | Future plan, natural follow-up to PR #64 |
| #54 | Capture and reverse all live op/event codes | Future plan, natural follow-up to PR #64 |

## Proposed execution order after realignment

1. **Handlers characterization (patched)**: safety net before touching handlers for fixes.
2. **Protocol18 regressions**: #57 and #52, concrete user-facing bugs.
3. **Alerts and ignore list**: #36 and #65, concrete user-facing bugs.
4. **Living harvestables fix** (legacy plan): closes #30 and #32, may share infrastructure with #52 diagnostics.
5. **Assets refresh**: formalize the existing `refresh-assets` Makefile target into a documented workflow.
6. **Zone manager**: stays deferred.
7. **Future plans (not yet scheduled)**: #24 Mist, #25 Fishpool, #29 Chests, #53 enum single source, #54 live codes capture.

## References cross-check recap

Trusted sources for Protocol18 going forward:

- `ao-data/albiondata-client` at tag `0.1.51` (upstream used by PR #51, documented in the archived Protocol18 port plan).
- `work/data/AlbionOnline-StatisticsAnalysis/` (actively maintained Protocol18 support).
- `work/data/albion-radar-deatheye-2pc/jsons/indexes.json` (offsets authoritative but requires validation against Protocol18 for NewCharacter parameter mapping).

Not authoritative anymore:

- `work/data/AlbionOnlinePhotonEventIds/EventCodes.txt` (frozen snapshot, fine for event code numbers but not for parameter layouts).
- `work/data/AlbionRadar/` (lags behind current Albion version).
- `work/data/albion-network/` (archived, legacy reference only).
