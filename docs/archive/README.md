# Archive Index

This directory holds plans, research notes, and historical documents that are no longer active. Nothing here should drive new work. Two purposes only:

1. History: what we tried, what we decided.
2. Evidence: so a future session does not re-do the same exploration.

## Rule

Nothing in `docs/archive/` should be read as active guidance. If it is still relevant, it belongs in `docs/plans/`, `docs/technical/`, or `CLAUDE.md`, not here.

## Subdirectories

### `completed-plans/`
Plans that were implemented and merged. Kept as a record of decisions.

| File | Topic | Status |
|---|---|---|
| `2025-12-26-github-actions-ci-release.md` | CI/CD GitHub Actions setup | Implemented in `.github/workflows/` |
| `CLEANUP_PLAN.md` | Legacy cleanup | Done |
| `GO_MIGRATION_PLAN.md` | Node.js to Go backend migration | Done (current stack) |
| `MOB_UI_ENHANCEMENT.md` | Mob display improvements | Done |
| `RADAR_UNIFICATION_PLAN.md` | Radar rendering unification | Done |
| `RESOURCE_DETECTION_REFACTOR.md` | Resource detection overhaul | Done |
| `SETTINGS_MIGRATION_PLAN.md` | Settings system migration | Done |

### `historical/`
Reference notes and research from past iterations.

| File | Topic | Status |
|---|---|---|
| `ENCHANTMENTS.md` | Enchantment mechanics reference | Reference, still accurate |
| `PLAYER_DETECTION_STATUS.md` | Player detection state notes | Historical |
| `2025-12-16-player-spawn-position-research_BLOCKED_ENCRYPTION.md` | Research on decoding player spawn positions | Blocked. Albion encrypts remote player positions, no known workaround. |

## Killed docs (not archived, deleted)

Some docs were deleted rather than archived because they contradicted the current project direction and would mislead future sessions. Git history preserves the content if needed.

| File | Deleted on | Reason |
|---|---|---|
| `docs/project/wails-migration-design.md` | 2026-04-12 | Proposed full Wails v3 migration. Current direction is to stabilize v2.0 web. |

Last updated: 2026-04-12.
