# 📚 OpenRadar Documentation

This documentation is organized into several sections to make navigation easier.

## 📂 Documentation Structure

### 🎯 For Users

- **[Main README](../README.md)** – User guide, installation, features
- **[BUILD.md](../BUILD.md)** – Build and packaging instructions

### 👨‍💻 For Developers

- **[DEV_GUIDE.md](./dev/DEV_GUIDE.md)** – Complete development guide

### 🤖 For AI Agents

- **[AI_AGENT_GUIDE.md](./ai/AI_AGENT_GUIDE.md)** – Main guide for AI agents
- **[MCP_TOOLS.md](./ai/MCP_TOOLS.md)** – Documentation for available MCP tools

### 🧪 Technical Documentation

- **[LOGGING.md](./technical/LOGGING.md)** – Centralized logging system v2.2 ⭐
- **[DEBUG_LOGGING_GUIDE.md](../work/DEBUG_LOGGING_GUIDE.md)** – Complete debug & logging guide
- **[SETTINGS.md](./technical/SETTINGS.md)** – Configuration and settings
- **[ENCHANTMENTS.md](./technical/ENCHANTMENTS.md)** – Enchantments system
- **[PLAYERS.md](./technical/PLAYERS.md)** – Player detection & radar display ⭐
- **[PLAYER_POSITIONS_MITM.md](./PLAYER_POSITIONS_MITM.md)** – Protocol and encryption limits (MITM, player positions) ⭐
- **[ANALYSIS_DEATHEYE_VS_CURRENT.md](./ANALYSIS_DEATHEYE_VS_CURRENT.md)** – Detailed DEATHEYE vs current implementation analysis (offsets, XML, equipment)

### 🔧 Utility Scripts (work/)

- **[WORK_OVERVIEW.md](./work/WORK_OVERVIEW.md)** – Overview of Python scripts ⭐
- **[COLLECTION_GUIDE.md](./work/COLLECTION_GUIDE.md)** – Data collection guide
- **[QUICK_START.md](./work/QUICK_START.md)** – Quick start for tooling scripts
- **[PLAYER_DETECTION_STATUS.md](./work/PLAYER_DETECTION_STATUS.md)** – Detailed status of player detection & movement (timeline, lessons)
- **[IMPROVEMENTS.md](./work/IMPROVEMENTS.md)** – Summary of recent improvements (including players)

### 📋 Project Management

- **[TODO.md](./project/TODO.md)** – Current and upcoming tasks

---

## 🔍 Quick Search

### I want to…

- **Install the project** → [Main README](../README.md)
- **Debug and trace events** → [DEBUG_LOGGING_GUIDE.md](../work/DEBUG_LOGGING_GUIDE.md) ⭐
- **Use Python tools** → [WORK_OVERVIEW.md](./work/WORK_OVERVIEW.md) ⭐
- **Understand the player detection system (architecture & UI)** → [PLAYERS.md](./technical/PLAYERS.md) ⭐
- **Understand limits on player positions / MITM** → [PLAYER_POSITIONS_MITM.md](./PLAYER_POSITIONS_MITM.md) ⭐
- **Follow the detailed status of the player movement bug** → [PLAYER_DETECTION_STATUS.md](./work/PLAYER_DETECTION_STATUS.md)
- **Compare DEATHEYE and this project** → [ANALYSIS_DEATHEYE_VS_CURRENT.md](./ANALYSIS_DEATHEYE_VS_CURRENT.md)
- **AI agent guide** → [AI_AGENT_GUIDE.md](./ai/AI_AGENT_GUIDE.md)
- **Configure an AI agent** → [AI_AGENT_GUIDE.md](./ai/AI_AGENT_GUIDE.md)
- **Debug logging** → [LOGGING.md](./technical/LOGGING.md)

---

## 🚨 Important Rules

### ⚠️ Do NOT create temporary Markdown files

- ❌ `WORKING_*.md`, `*_FIX.md`, `*_ANALYSIS.md`, `*_SESSION.md`, etc.
- ✅ Use existing files or the appropriate sections
- ✅ Keep long-lived information in `docs/` instead of ad-hoc files

### ✅ Where to put what

| Content type                 | Destination                         |
|-----------------------------|-------------------------------------|
| Temporary session notes     | Local notes or issues               |
| Permanent documentation     | `docs/` with the appropriate layout |
| TODOs                       | `docs/project/TODO.md`              |
| Known bugs                  | GitHub Issues or `docs/project/TODO.md` |
| Utility Python scripts      | `tools/` (git-ignored but documented)   |
| Work-in-progress tooling    | `work/` (git-ignored except README)    |

### ✅ Player-related rules

- **Stable player architecture & features** → `docs/technical/PLAYERS.md`
- **Investigation state / bugs / timeline** → `docs/work/PLAYER_DETECTION_STATUS.md`
- **MITM / encryption / player positions limits** → `docs/PLAYER_POSITIONS_MITM.md`
- **Advanced analysis vs DEATHEYE / offsets / XML** → `docs/ANALYSIS_DEATHEYE_VS_CURRENT.md`

Do not duplicate these contents:
- Summarize in a few lines and **point to the right file** instead of rewriting the full analysis.

---

*Last update: 2025-12-01*
