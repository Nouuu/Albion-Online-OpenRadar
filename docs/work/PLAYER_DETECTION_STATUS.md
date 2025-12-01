# 🧭 Player Detection & Movement – Current Status (OpenRadar)

**Last update**: 2025-11-17 18:00  
**Scope**: Player detection, positions, movement, and lessons learned.

> **Role of this file**: single source of truth for the **current state**, **timeline**, and **lessons learned** about player detection/movement.
>
> For the overall player system architecture, see `docs/technical/PLAYERS.md`.

---

## 📌 Quick Summary (TL;DR)

- ✅ Players are **detected** (names, guilds, alliances) via Event 29.
- ✅ Equipment is detected (IDs) and ready for item power calculation (see DEATHEYE/analysis doc).
- ⚠ Initial positions are **partially correct** (NewCharacter param[7] not fully deserialized server-side).
- ⚠ Movement is **still problematic** (Event 3 for players not behaving like for mobs).
- ✅ Move events (Event 3) are correctly handled for mobs (positions update fine).
- ❌ Players do **not** move reliably yet (frozen / inconsistent positions).

Full details and timeline below.

---

## ✅ What Works (Confirmed 2025-11-17 18:00)

### 1. Player Detection (Event 29)

- **Event 29 (NewCharacter)** is correctly parsed.
- Players appear in the radar list with:
  - Name
  - Guild
  - Alliance
  - Equipment IDs (weapons, armor, etc.)

### 2. Equipment Detection

- Equipment IDs are extracted from Event 29 parameters.
- These IDs can be mapped against `items.xml` to compute **real item power** (see `ANALYSIS_DEATHEYE_VS_CURRENT.md`).

### 3. Event 3 (Move) for Mobs

- For mobs, Move events (Event 3) are fully deserialized:
  - `param[4]` = posX.
  - `param[5]` = posY.
  - `param[252]` = event code.
- Mobs move correctly on the radar (confirmed in-game).

---

## ❌ What Is Still Broken

### 1. Initial Player Position (Event 29 param[7])

- Event 29 contains an initial position buffer in `param[7]` **server-side**.
- This buffer is **not** fully deserialized in the current implementation.
- On the client side (browser) we receive:

```js
// Example structure
{
  7: { type: 'Buffer', data: [...] }
}
```

- `Buffer.isBuffer()` returns false in the browser environment (not a Node buffer).
- The fallback uses other params (e.g. param[19]/[20] world coords), which are not reliable for players.

### 2. Player Movement (Event 3)

- Event 3 (Move) is deserialized **the same way** for mobs and players (positions in `param[4]` and `param[5]`).
- Mobs move correctly → Event 3 parsing is correct.
- Players, however, remain static or behave inconsistently.

Possible causes:

- Hypothesis 1: **Race condition** (Move received before NewCharacter, player not yet in `playersInRange`).
- Hypothesis 2: **PlayersHandler** silently rejects updates (player not found / out of range).
- Hypothesis 3: **No Event 3 for players** in some scenarios (needs log confirmation).

---

## 🕒 Timeline of Key Changes

### [2025-11-09] – Initial Movement Investigation

- Started investigation on player movement vs mob movement.
- Confirmed that:
  - Mob movement uses Event 3 (Move) with positions in `param[4]` and `param[5]`.
  - Player detection uses Event 29 (NewCharacter), but positions are not correctly used.

Key observation:

- Move events (Event 3) are fully functional for mobs but not for players.

### [2025-11-10] – Buffer Deserialization Attempts (Server-Side)

Files touched:

- `scripts/classes/Protocol16Deserializer.js`
- `scripts/Utils/Utils.js`

#### Attempted "Fix" (BROKEN)

```javascript
// ❌ This "correct" version broke everything
static deserializeByteArray(input) {
  const arraySize = input.readUInt32BE();
  const startPos = input.tell();
  const buffer = input.buffer.slice(startPos, startPos + arraySize);
  input.seek(startPos + arraySize);
  return buffer;
}

// ❌ And for parameter tables
static deserializeParameterTable(input) {
  const tableSize = this.deserializeShort(input);
  let table = {};
  for (let i = 0; i < tableSize; i++) {
    const key = this.deserializeByte(input);
    const valueTypeCode = this.deserializeByte(input);
    const value = this.deserialize(input, valueTypeCode);
    table[key] = value;
  }
  return table;
}
```

**Result:**

- This “theoretically correct” code **broke the entire event parsing pipeline**.
- The previous implementation was technically weird, but it worked in production.

### [2025-11-17] – Full Revert to Working Behavior

The working-but-weird versions were restored:

```javascript
// ✅ Restored version (works in production)
static deserializeByteArray(input) {
  const arraySize = input.readUInt32BE();
  return input.slice(arraySize).buffer;
}

// ✅ Restored version (works in production)
static deserializeParameterTable(input) {
  const tableSize = input.readUInt16BE(1); // Fixed offset
  let table = {};
  let offset = 3;
  for (let i = 0; i < tableSize; i++) {
    const key = input.readUInt8(offset);
    const valueTypeCode = input.readUInt8(offset + 1);
    const value = this.deserialize(input, valueTypeCode);
    table[key] = value;
  }
  return table;
}

// ✅ Restored special case for Event Code 3
static deserializeEventData(input) {
  const code = this.deserializeByte(input);
  const parameters = this.deserializeParameterTable(input);

  if (code == 3) {
    const bytes = new Uint8Array(parameters[1]);
    const position0 = new DataView(bytes.buffer, 9, 4).getFloat32(0, true);
    const position1 = new DataView(bytes.buffer, 13, 4).getFloat32(0, true);
    parameters[4] = position0;
    parameters[5] = position1;
    parameters[252] = 3;
  }

  return { code, parameters };
}
```

**Status after revert:**

- ✅ Mobs move correctly (positions updated from Event 3).
- ✅ Event code stored in `param[252]`.
- ❌ Players still not moving correctly (see hypotheses above).

---

## 💡 Critical Lessons Learned

### ❌ What Not to Do

1. **Never “fix” code that works** without understanding the entire system:
   - Even if it looks technically wrong.
   - Even if comments say “bugged” or “needs fix”.
   - If it works in production → treat it as the source of truth until you fully understand it.

2. **Do not blindly trust old documentation** that claims something is broken:
   - Docs may be outdated or incomplete.
   - The running code is the real reference.

3. **Avoid stacking patches without understanding**:
   - Adding layers of debug/workarounds hides the root cause.
   - Take the time to understand the real protocol.

4. **Do not touch multiple critical files at once**:
   - Increases regression risk drastically.
   - Makes it impossible to know which change broke what.

### ✅ What to Do

1. **Always test each change** before making another one:
   - In-game test after EVERY modification.
   - Confirm nothing regressed before continuing.

2. **If it works, do not touch it**:
   - Working > clean.
   - Refactor only with extensive test coverage.

3. **Use separate branches for experiments**:
   - Easy to roll back.
   - Keeps `main`/stable branches safe.

4. **Document errors immediately**:
   - Avoid repeating the same mistakes.
   - Save time and effort.

---

## 🧩 Current Code State (Post-Revert 2025-11-17)

### `Protocol16Deserializer.js`

**Move events (Event Code 3):**

```javascript
if (code == 3) {
  const bytes = new Uint8Array(parameters[1]);
  const position0 = new DataView(bytes.buffer, 9, 4).getFloat32(0, true);  // offset 9
  const position1 = new DataView(bytes.buffer, 13, 4).getFloat32(0, true); // offset 13
  parameters[4] = position0;  // posX
  parameters[5] = position1;  // posY
  parameters[252] = 3;
}
```

**Status:**

- ✅ Correctly deserializes mob positions for Event 3.
- ✅ Positions stored in `param[4]` and `param[5]`.
- ✅ Event code in `param[252]`.

### `Utils.js` (Client-Side)

**Handling Move events:**

```javascript
case EventCodes.Move:
  if (Parameters[4] !== undefined && Parameters[5] !== undefined) {
    const posX = Parameters[4];
    const posY = Parameters[5];

    if (isValidPosition(posX, posY)) {
      mobsHandler.updateMobPosition(id, posX, posY);
      playersHandler.updatePlayerPosition?.(id, posX, posY);
    }
  }
```

**Status:**

- ✅ Reads `param[4]` and `param[5]`.
- ✅ Validates positions via `isValidPosition`.
- ✅ Calls `updateMobPosition()` and `updatePlayerPosition()`.
- ✅ Mobs move correctly.
- ⚠ Players still do not move reliably → likely a logic issue in `PlayersHandler` and/or event ordering.

---

## ✅ Next Steps (Checklist)

### Priority 1: Fix Event 29 `param[7]` Deserialization (Server-Side)

- [ ] Add a specific block for Event 29 in `Protocol16Deserializer.deserializeEventData()`.
- [ ] Deserialize `param[7]` (buffer) into an array `[posX, posY]`.
- [ ] Identify correct offsets (likely 0 and 4, not 9 and 13 like Event 3).
- [ ] Test: player appears at correct position when entering view.

### Priority 2: Investigate Event 3 for Players

- [ ] Confirm via logs that Event 3 is received for players.
- [ ] Inspect `PlayersHandler.updatePlayerPosition()` (e.g. line 260+):
  - Does the player exist in `playersInRange`?
  - Are updates silently ignored?
- [ ] Compare with `MobsHandler.updateMobPosition()` which works.
- [ ] If needed, create a fallback: auto-create player on Move if NewCharacter not seen yet.

### Priority 3: Full Validation

- [ ] In-game test: players appear AND move.
- [ ] Confirm no regression on mobs/resources.
- [ ] Remove debug logging once stable.
- [ ] Document final solution in `PLAYERS.md` and this file.

---

## 🔗 References

### Critical Files

- `scripts/classes/Protocol16Deserializer.js` – Server-side deserialization.
- `scripts/Utils/Utils.js` – Client-side event processing.
- `scripts/Handlers/MobsHandler.js` – Mobs handler.
- `scripts/Handlers/PlayersHandler.js` – Players handler.
- `app.js` – WebSocket bridge.

### Archived Documentation

- `archive_2025-11-17/BUFFER_DESERIALIZATION_STATUS.md` – Full buffer deserialization investigation.
- `archive_2025-11-17/PLAYER_MOVEMENT_INVESTIGATION_2025-11-10_PM.md` – PM movement investigation.
- `archive_2025-11-17/PLAYER_MOVEMENT_CURRENT_STATUS.md` – Older movement status (obsolete).
- `archive_2025-11-17/PLAYER_MOVEMENT_FIX_2025-11-10.md` – Incorrect fix documentation.

### External Repositories

- **ao-network** (May 2025): `work/data/ao-network/` – Photon protocol reference.
- **AO-Radar** (2021): Obsolete – for historical reference only.

---

## ⚠ Reminders for Next Work Session

1. Read the **Lessons Learned** section before touching the code.
2. Do **not** modify `Protocol16Deserializer.js` unless absolutely necessary.
3. Test EVERY change in-game before stacking more modifications.
4. Use a separate branch for experiments.
5. If stuck, ask for confirmation before high-risk refactors.

---

_Last modification_: 2025-11-17 18:00  
_Next objective_:
1. Add Event 29 `param[7]` deserialization (server-side).
2. Investigate why Event 3 works for mobs but not for players.
