# OpenRadar Documentation

Documentation index for OpenRadar v2.0 (Go Backend).

---

## Quick Links

| I want to... | Go to |
|--------------|-------|
| Install the project | [Main README](../README.md) |
| Set up development | [DEV_GUIDE.md](./dev/DEV_GUIDE.md) |
| See what's new in v2.0 | [RELEASE_2.0.0.md](./releases/RELEASE_2.0.0.md) |
| View the roadmap | [TODO.md](./project/TODO.md) |
| Understand player detection | [PLAYERS.md](./technical/PLAYERS.md) |

---

## Project Status

| Document | Description |
|----------|-------------|
| [TODO.md](./project/TODO.md) | Roadmap and upcoming features |
| [IMPROVEMENTS.md](./project/IMPROVEMENTS.md) | v2.0 features summary |

---

## Technical Documentation

| Document | Description |
|----------|-------------|
| [LOGGING.md](./technical/LOGGING.md) | Centralized logging system |
| [PLAYERS.md](./technical/PLAYERS.md) | Player detection architecture |
| [PLAYER_POSITIONS_MITM.md](./technical/PLAYER_POSITIONS_MITM.md) | Protocol encryption limits |
| [DEATHEYE_ANALYSIS.md](./technical/DEATHEYE_ANALYSIS.md) | Comparison with DEATHEYE project |

---

## Development

| Document | Description |
|----------|-------------|
| [DEV_GUIDE.md](./dev/DEV_GUIDE.md) | Development setup (Go backend) |

---

## Releases

| Version | Notes |
|---------|-------|
| [v2.0.0](./releases/RELEASE_2.0.0.md) | Go backend + UI overhaul |

---

## Archive

Completed plans and historical documentation are preserved in `docs/archive/` for reference.

### Completed Plans
| Plan | Description |
|------|-------------|
| [GO_MIGRATION_PLAN.md](./archive/completed-plans/GO_MIGRATION_PLAN.md) | Node.js → Go migration |
| [RADAR_UNIFICATION_PLAN.md](./archive/completed-plans/RADAR_UNIFICATION_PLAN.md) | Radar rendering refactor |
| [SETTINGS_MIGRATION_PLAN.md](./archive/completed-plans/SETTINGS_MIGRATION_PLAN.md) | Settings sync implementation |
| [RESOURCE_DETECTION_REFACTOR.md](./archive/completed-plans/RESOURCE_DETECTION_REFACTOR.md) | Detection system overhaul |
| [MOB_UI_ENHANCEMENT.md](./archive/completed-plans/MOB_UI_ENHANCEMENT.md) | Mob classification system |
| [CLEANUP_PLAN.md](./archive/completed-plans/CLEANUP_PLAN.md) | Code cleanup and removal |

### Historical
| Document | Description |
|----------|-------------|
| [ENCHANTMENTS.md](./archive/historical/ENCHANTMENTS.md) | Old enchantment system (Phase 3B) |
| [PLAYER_DETECTION_STATUS.md](./archive/historical/PLAYER_DETECTION_STATUS.md) | Player detection investigation |

---

## Architecture (v2.0)

```
OpenRadar/
├── cmd/radar/main.go       # Entry point + TUI
├── internal/
│   ├── capture/pcap.go     # Packet capture (gopacket)
│   ├── photon/             # Protocol parsing
│   │   ├── packet.go
│   │   ├── command.go
│   │   └── protocol16.go
│   ├── server/
│   │   ├── http.go         # HTTP + static
│   │   └── websocket.go    # WS handler
│   ├── templates/          # Go templates (.gohtml)
│   └── logger/             # JSONL logging
├── web/                    # Frontend (embedded)
│   ├── scripts/            # JavaScript
│   ├── images/             # Assets
│   ├── public/             # HTML, game data
│   └── sounds/             # Audio
├── embed.go                # Asset embedding
└── go.mod                  # Go modules
```

### Key Changes from v1.x

| Component | v1.x | v2.0 |
|-----------|------|------|
| Backend | Node.js + Express | Go native |
| WebSocket | ws (port 5002) | gorilla/websocket (`/ws`) |
| Templates | EJS | Go html/template |
| UI Framework | - | HTMX + Tailwind |
| Styling | Custom CSS | Tailwind CSS v4 |
| Distribution | ~500 MB | ~95 MB |

---

## Documentation Rules

### Do NOT create temporary files
- No `WORKING_*.md`, `*_FIX.md`, `*_SESSION.md`
- Use existing files or GitHub Issues

### Where to put what

| Content | Destination |
|---------|-------------|
| Roadmap items | `project/TODO.md` |
| Feature summaries | `project/IMPROVEMENTS.md` |
| Technical reference | `technical/*.md` |
| Completed plans | `archive/completed-plans/` |

---

*Last update: 2025-12-13 - v2.0.0*
