# OpenRadar Documentation

Documentation index for OpenRadar.

---

## For Users

- **[Main README](../README.md)** - Installation and features

---

## For Developers

- **[DEV_GUIDE.md](./dev/DEV_GUIDE.md)** - Development guide

---

## Technical Documentation

| File | Description |
|------|-------------|
| [LOGGING.md](./technical/LOGGING.md) | Centralized logging system v2.2 |
| [ENCHANTMENTS.md](./technical/ENCHANTMENTS.md) | Enchantments system |
| [PLAYERS.md](./technical/PLAYERS.md) | Player detection & radar display |
| [PLAYER_POSITIONS_MITM.md](./technical/PLAYER_POSITIONS_MITM.md) | Protocol and encryption limits |
| [DEATHEYE_ANALYSIS.md](./technical/DEATHEYE_ANALYSIS.md) | DEATHEYE vs current implementation |

---

## Project Management

| File | Description |
|------|-------------|
| [TODO.md](./project/TODO.md) | Current and upcoming tasks |
| [IMPROVEMENTS.md](./project/IMPROVEMENTS.md) | Summary of improvements |
| [PLAYER_DETECTION_STATUS.md](./project/PLAYER_DETECTION_STATUS.md) | Player detection investigation |
| [ROOT_FILES.md](./project/ROOT_FILES.md) | Rules for root files |

### Active Plans

| Plan | Status |
|------|--------|
| [GO_MIGRATION_PLAN.md](./project/GO_MIGRATION_PLAN.md) | Backend rewrite in Go |
| [RADAR_UNIFICATION_PLAN.md](./project/RADAR_UNIFICATION_PLAN.md) | ~80% complete |
| [SETTINGS_MIGRATION_PLAN.md](./project/SETTINGS_MIGRATION_PLAN.md) | ~50% complete |

---

## Quick Search

| I want to... | Go to |
|--------------|-------|
| Install the project | [Main README](../README.md) |
| Debug and trace events | [LOGGING.md](./technical/LOGGING.md) |
| Understand player detection | [PLAYERS.md](./technical/PLAYERS.md) |
| Understand player position limits | [PLAYER_POSITIONS_MITM.md](./technical/PLAYER_POSITIONS_MITM.md) |
| See current tasks | [TODO.md](./project/TODO.md) |

---

## Important Rules

### Do NOT create temporary Markdown files

- `WORKING_*.md`, `*_FIX.md`, `*_ANALYSIS.md`, `*_SESSION.md`, etc.
- Use existing files or the appropriate sections
- Keep long-lived information in `docs/`

### Where to put what

| Content type | Destination |
|--------------|-------------|
| Temporary session notes | Local notes or issues |
| Permanent documentation | `docs/` |
| TODOs | `docs/project/TODO.md` |
| Known bugs | GitHub Issues or `docs/project/TODO.md` |

---

*Last update: 2025-12-09*