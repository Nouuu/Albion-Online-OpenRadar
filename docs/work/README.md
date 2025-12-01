# 📋 Work Documentation - OpenRadar

**Last update**: 2025-12-01

---

## 🎯 Current Project State (Work View)

### Players (very short summary)

Players are **detected** and can be displayed on the radar, but their **movement** is still being stabilized, within the hard limits imposed by network encryption.

For all detailed information about players:
- Architecture & player features → `../technical/PLAYERS.md`
- MITM limits / player positions → `../PLAYER_POSITIONS_MITM.md`
- Timeline & detailed debug state → `PLAYER_DETECTION_STATUS.md`

---

## 📁 Document Organization

### Active Documents

| File | Description | Status |
|------|-------------|--------|
| [`PLAYER_DETECTION_STATUS.md`](PLAYER_DETECTION_STATUS.md) | Current state of player detection and movement debugging (detailed timeline) | 🔴 IN PROGRESS |
| [`IMPROVEMENTS.md`](IMPROVEMENTS.md) | **Summarized** history of improvements (including players) | ✅ Up to date |
| [`COLLECTION_GUIDE.md`](COLLECTION_GUIDE.md) | TypeID collection guide for mobs | ✅ Valid |
| [`QUICK_START.md`](QUICK_START.md) | Quick start for tools | ✅ Valid |
| [`TOOLS_README.md`](TOOLS_README.md) | Python scripts documentation | ✅ Valid |
| [`WORK_OVERVIEW.md`](WORK_OVERVIEW.md) | Overview of utility scripts | ✅ Valid |

### Important Related Docs (outside `docs/work/`)

| File | Role |
|------|------|
| [`../technical/PLAYERS.md`](../technical/PLAYERS.md) | Stable architecture & behavior of the player system |
| [`../PLAYER_POSITIONS_MITM.md`](../PLAYER_POSITIONS_MITM.md) | Protocol / encryption / MITM limits for player positions |
| [`../ANALYSIS_DEATHEYE_VS_CURRENT.md`](../ANALYSIS_DEATHEYE_VS_CURRENT.md) | Detailed DEATHEYE vs current implementation analysis |

### Archive

- `archive_2025-11-09/` → Older investigations based on incorrect assumptions (different protocol, encryption, etc.)
- `archive_2025-11-17/` → Player movement investigations (buffer deserialization, offsets, applied fixes)

---

## 🚀 How to Resume Work

### If you are an AI assistant

1. **Read first**: [`PLAYER_DETECTION_STATUS.md`](PLAYER_DETECTION_STATUS.md)
   - Exact state of the problem (detection + movement)
   - Full timeline of investigations
   - Lessons learned from regressions
   - Next prioritized steps

2. **Then check**: [`IMPROVEMENTS.md`](IMPROVEMENTS.md) for the **chronological summary** of work done.

3. **For protocol/limitations context**:
   - Read `../PLAYER_POSITIONS_MITM.md` to understand MITM/position limits
   - Read `../ANALYSIS_DEATHEYE_VS_CURRENT.md` if you need a comparison with DEATHEYE

4. **Analyze**: New logs in `logs/sessions/session_YYYY-MM-DD.jsonl`
   - Look for `Event_Full_Dictionary`
   - Look for `DIAG_MoveBuffer_*`

### If you are the developer

1. **Current state**: Players are detected, but movement is still partially broken and **positions are anyway constrained by encryption** (see `../PLAYER_POSITIONS_MITM.md`).
2. **Next technical step**: follow the checklist in `PLAYER_DETECTION_STATUS.md` (Event 29 param[7], Event 3 for players).
3. **References**:
   - `../technical/PLAYERS.md` for JS-side architecture
   - `../PLAYER_POSITIONS_MITM.md` for what is or is not possible without MITM
   - `../ANALYSIS_DEATHEYE_VS_CURRENT.md` for offsets and the DEATHEYE/XML side

---

## ⚠️ Archived Documents

These documents are **archived** because they relate to specific investigations that are now consolidated elsewhere:

### `archive_2025-11-17/`
- `BUFFER_DESERIALIZATION_STATUS.md` → Detailed buffer deserialization investigation
- `PLAYER_MOVEMENT_INVESTIGATION_2025-11-10_PM.md` → Movement investigation (PM session)
- `PLAYER_MOVEMENT_CURRENT_STATUS.md` → Movement status (obsolete, see PLAYER_DETECTION_STATUS.md)
- `PLAYER_MOVEMENT_FIX_2025-11-10.md` → Fix attempt (superseded)

### `archive_2025-11-09/`
- See `archive_2025-11-09/README.md` for details

**Why archived?**
- Consolidated into [`PLAYER_DETECTION_STATUS.md`](PLAYER_DETECTION_STATUS.md)
- Kept as historical reference of investigations
- Documents lessons learned and mistakes to avoid

---

## 🎯 Goals

### Short Term

1. **Stabilize player movement** 🔴 PRIORITY
   - Follow the checklist in `PLAYER_DETECTION_STATUS.md`
   - Ensure mobs/resources behavior is not broken

### Medium Term

2. **Collect TypeIDs for Living Resources**
   - See [`COLLECTION_GUIDE.md`](COLLECTION_GUIDE.md)
   - Aim for full T4–T8 coverage

### Long Term

3. **Stability and Performance**
   - Detection optimizations
   - Reduce false positives
   - Extensive testing

---

## 📞 Contacts

- **GitHub Issues**: use the main repository issue tracker
- **Documentation**: `docs/` and `docs/work/`

---

**Ready to resume debugging! 🔍🐞**
