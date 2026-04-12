# Player Spawn Position - Research Document

**Date:** 2025-12-16
**Status:** ⏳ RESEARCH - Theoretical, needs validation

> Note: This is research for a potential future feature. Player positions are currently encrypted by Albion - see Known Limitations in TODO.md

## Problem

Players detected via Event 29 (NewCharacter) have no usable position. Currently created with `posX = 0, posY = 0`.

## Discovery: Event 29 Contains World Coordinates

From log analysis (`session_2025-12-16T21-42-22.jsonl`):

```
param[19] = World X coordinate (float)
param[20] = World Y coordinate (float)
```

### Examples from Logs

| Player | param[19] | param[20] | Map Context |
|--------|-----------|-----------|-------------|
| Trigal | 60.19367 | 5.5 | Thetford area |
| Sztuqqa | 180 | 11.275 | Thetford area |
| Sobyrasha | 180 | 8.525 | Thetford area |

**Important:** These are WORLD coordinates, not local coordinates. The values appear small because Thetford is near the world center (0,0).

## Discovery: Cluster Offset Data

Source: `https://github.com/ao-data/ao-bin-dumps/tree/master/cluster`

Each map has a `*.cluster.xml` file with `origin` offset.

### Collected Cluster Origins

| Map ID | Type | Origin X | Origin Y | Size |
|--------|------|----------|----------|------|
| 0000 | City (Caerleon?) | -305 | -305 | 600x600 |
| 0004 | STT | -5 | -5 | 240x240 |
| 0005 | HBS | -466 | -466 | 932x932 |
| 0006 | City | -95 | -65 | 160x210 |
| 0007 | City | -95 | -65 | 160x230 |
| 0008 | City | -125 | -256 | 341x371 |
| 0201 | World T5 | -465 | -465 | 930x930 |

### Map ID Correlation

The map ID prefix in cluster filenames matches:
- `web/images/Maps/*.webp` filenames
- `window.currentMapId` in the radar
- `dynamicclusters.json` `@name` prefixes

## Theoretical Conversion Formula

```
localX = worldX - cluster.originX
localY = worldY - cluster.originY
```

### Example Calculation

If player on map 0201 (origin: -465, -465):
```
worldX = 100, worldY = 50
localX = 100 - (-465) = 565
localY = 50 - (-465) = 515
```

If player on map 0007 (origin: -95, -65):
```
worldX = 60.19, worldY = 5.5
localX = 60.19 - (-95) = 155.19
localY = 5.5 - (-65) = 70.5
```

## What Needs Validation

### Question 1: Which City is Which Map ID?

Need to map city names to IDs:
- Thetford = 0007? 0008?
- Martlock = ?
- Lymhurst = ?
- etc.

### Question 2: Coordinate System Alignment

The radar uses:
```javascript
// MapsDrawing.js
const hY = -lpY;  // Y axis inverted
```

Does the same transformation apply after offset conversion?

### Question 3: Does the Formula Work?

To validate:
1. Be in a known map (e.g., Thetford, know its ID)
2. Capture Event 29 with another player nearby
3. Note local player position (`lpX`, `lpY`)
4. Apply formula to other player's param[19]/[20]
5. Check if relative position makes sense

## Implementation Plan (Pending Validation)

### Step 1: Generate Cluster Offsets Database

Parse all `cluster/*.cluster.xml` files → `cluster-offsets.json`:

```json
{
  "0000": { "originX": -305, "originY": -305 },
  "0007": { "originX": -95, "originY": -65 },
  "0201": { "originX": -465, "originY": -465 }
}
```

### Step 2: Load at Startup

```javascript
// ClusterOffsetsDatabase.js
class ClusterOffsetsDatabase {
  async load(path) {
    const response = await fetch(path);
    this.offsets = await response.json();
  }

  getOffset(mapId) {
    return this.offsets[mapId] || null;
  }
}
```

### Step 3: Convert in PlayersHandler

```javascript
handleNewPlayerEvent(id, Parameters) {
  const worldX = Parameters[19];
  const worldY = Parameters[20];

  const mapId = window.currentMapId;
  const offset = window.clusterOffsets?.getOffset(mapId);

  let posX = 0, posY = 0;
  if (offset && worldX !== undefined && worldY !== undefined) {
    posX = worldX - offset.originX;
    posY = worldY - offset.originY;
  }

  const player = new Player(posX, posY, id, nickname, ...);
}
```

## Related Files

| File | Purpose |
|------|---------|
| `ao-bin-dumps/cluster/*.cluster.xml` | Source of origin offsets |
| `ao-bin-dumps/dynamicclusters.json` | Dynamic slot positions (not directly useful here) |
| `web/scripts/Handlers/PlayersHandler.js` | Where conversion would be implemented |
| `web/images/Maps/*.webp` | Map images (ID = filename) |

## Full Event 29 Parameter Reference

From log analysis:

| Param | Type | Description |
|-------|------|-------------|
| 0 | int | Player ID |
| 1 | string | Nickname |
| 7 | Buffer(16) | Unknown (encrypted?) |
| 8 | string | Guild Name |
| **19** | **float** | **World X** |
| **20** | **float** | **World Y** |
| 22 | int | Current Health |
| 23 | int | Max Health |
| 40 | Array | Equipment IDs |
| 43 | Array | Spell IDs |
| 51 | string | Alliance Name |
| **53** | **int** | **Faction** (0/1-6/255) |

## Next Steps

1. [ ] Identify which map ID corresponds to Thetford
2. [ ] Capture new logs with known relative positions
3. [ ] Apply formula and validate
4. [ ] If validated: generate cluster-offsets.json
5. [ ] Implement conversion in PlayersHandler