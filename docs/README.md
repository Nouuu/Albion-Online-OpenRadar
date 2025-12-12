# OpenRadar Documentation

Documentation index for OpenRadar v2.0 (Go Backend).

---

## For Users

- **[Main README](../README.md)** - Installation and features

---

## For Developers

- **[DEV_GUIDE.md](./dev/DEV_GUIDE.md)** - Development guide (Go backend)

---

## Technical Documentation

| File | Description |
|------|-------------|
| [LOGGING.md](./technical/LOGGING.md) | Centralized logging system |
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

### Completed Plans

| Plan | Status |
|------|--------|
| [GO_MIGRATION_PLAN.md](./archive/GO_MIGRATION_PLAN.md) | ✅ **COMPLETE** - v2.0 released |
| [RADAR_UNIFICATION_PLAN.md](./project/RADAR_UNIFICATION_PLAN.md) | ✅ Complete |
| [SETTINGS_MIGRATION_PLAN.md](./project/SETTINGS_MIGRATION_PLAN.md) | ✅ Complete |

---

## Architecture Overview (v2.0)

```
OpenRadar v2.0
├── cmd/radar/main.go       # Entry point
├── internal/
│   ├── capture/pcap.go     # Packet capture (gopacket)
│   ├── photon/             # Protocol parsing
│   │   ├── packet.go       # Photon packet
│   │   ├── command.go      # Commands
│   │   └── protocol16.go   # Protocol16 deserializer
│   ├── server/
│   │   ├── http.go         # HTTP + WebSocket server
│   │   └── websocket.go    # WebSocket handler
│   └── logger/logger.go    # JSONL logging
├── web/                    # Frontend (embedded)
│   ├── scripts/            # JavaScript
│   ├── images/             # Assets
│   ├── public/             # HTML, game data
│   └── sounds/             # Audio
├── embed.go                # Asset embedding
└── go.mod                  # Go modules
```

### Key Changes from v1.x (Node.js)

| Component | v1.x | v2.0 |
|-----------|------|------|
| Backend | Node.js + Express | Go native |
| WebSocket | ws (port 5002) | gorilla/websocket (`/ws`) |
| Packet capture | cap (Node addon) | gopacket/pcap |
| Templates | EJS | Static SPA (Alpine.js) |
| Distribution | ~500 MB | ~95 MB single binary |
| Ports | 5001 + 5002 | 5001 only |

---

## Quick Search

| I want to... | Go to |
|--------------|-------|
| Install the project | [Main README](../README.md) |
| Set up development | [DEV_GUIDE.md](./dev/DEV_GUIDE.md) |
| Debug and trace events | [LOGGING.md](./technical/LOGGING.md) |
| Understand player detection | [PLAYERS.md](./technical/PLAYERS.md) |
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

*Last update: 2025-12-12 - v2.0 Go Backend*
