# 📑 In-Depth Analysis Report: DEATHEYE vs Current Implementation

> **Reference:** `work/data/albion-radar-deatheye-2pc/`  
> **Focus:** Events, offsets, XML bases (items/harvestables/mobs), PvE strategy (T6+, living resources, dungeons, equipment/IP).

> This analysis **does not** cover player positions via Photon MITM. For encryption, XorCode, and the decision not to implement MITM, see `./PLAYER_POSITIONS_MITM.md`.

---

## 1. DEATHEYE Concept vs OpenRadar

DEATHEYE is a previous project that:

- Used Photon MITM (Cryptonite) to decrypt all network traffic.
- Parsed XML dumps (`items.xml`, `mobs.xml`, `harvestables.xml`).
- Built complete XML-based databases (items, mobs, harvestables).
- Computed real **item power** (IP) from equipment.

OpenRadar is a lighter implementation that:

- Does **not** use MITM (no Photon decryption).
- Relies on official dumps + runtime logging.
- Uses enriched logging to approximate/derive missing data.

This document compares DEATHEYE’s approach with OpenRadar’s current implementation and proposes an upgrade path.

---

## 2. XML Databases in DEATHEYE

### 2.1 Database Structure (DEATHEYE)

#### Items

- Source: `items.xml`.
- Parsed into a normalized structure with:
  - `@uniquename`
  - `@tier`
  - `@enchantmentlevel`
  - `@itempower`
  - Equipment slots, categories, etc.

Used for:

- Player equipment lookup.
- Real item power (IP) calculation.
- Gear score and build analysis.

#### Mobs

- Source: `mobs.xml`.
- Contains:
  - `@uniquename`
  - `@tier`
  - `@prefab`
  - `@faction`
  - `@hitpointsmax`
  - `@abilitypower`
  - Other attributes.

Used for:

- Living resources mapping.
- HP validation.
- Faction-based filters.

#### Harvestables

- Source: `harvestables.xml`.
- Contains resource nodes (trees, ore, rock, fiber).
- Defines:
  - Tier.
  - Base resource.
  - Enchantment states.

Used for:

- Mapping harvestable nodes to item IDs.
- Dungeon resource visualization.

---

### 2.2 Current Implementation – Gaps

In the current OpenRadar implementation (before upgrades):

- No full XML database layer (only partial JSON.
- `MobsInfo.js` manually populated from in-game collection.
- Enchantment detection for living resources was initially buggy (see `ENCHANTMENTS.md`).
- Dungeon enchantment offset was incorrect.
- Player item power was based on crude approximations (using IDs rather than `itempower`).

---

## 3. Harvestables & Living Resources

### 3.1 Harvestables – Static TypeIDs

From DEATHEYE + dumps, we can define **static** TypeIDs for harvestables:

- Source: `harvestables.xml`.
- Example:

```javascript
// Example partial content of harvestables-typeids.js
// WOOD harvestables
913,   // T1.0 - Rough Logs
11734, // T2.0 - Novice Lumberjack's Trophy Journal (Full)
5908,  // T4.1 - Adept's Lumberjack Backpack
...
```

In OpenRadar:

- `harvestables-typeids.js` is generated as a static reference.
- **Note:** These are item IDs, not directly the resource nodes.

### 3.2 Living Resources – Dynamic TypeIDs

For **living resources** (Hide/Fiber mobs), TypeIDs are **server runtime** identifiers:

- Not present as-is in `mobs.json` or `items.txt`.
- Must be collected via in-game logging.

Key conclusion:

- Items and mobs have **separate** TypeID namespaces.

Example collision:

```text
TypeID 358:
  items.txt → QUESTITEM_EXP_TOKEN_D16_T6_EXP_HRD_KEEPER_MUSHROOM
  MobsInfo.js (network) → T1 Rabbit (Hide)

TypeID 421:
  items.txt → QUESTITEM_EXP_TOKEN_D7_T6_EXP_HRD_MORGANA_TORTURER
  MobsInfo.js (network) → T1 Rabbit variant

⇒ Separate namespaces: items ≠ mobs.
```

---

## 4. Metadata Extraction (Without TypeIDs)

### 4.1 What We Can Extract from Dumps

**Source:** `mobs.json` + `randomspawnbehaviors.json` (official dumps).

We can extract:

- `@uniquename`
- `@tier`
- `@prefab`
- `@faction`
- `@hitpointsmax`

Example metadata record:

```javascript
{
  uniqueName: "MOB_RABBIT",
  tier: 1,
  prefab: "MOB_HIDE_RABBIT_01",
  hp: 20,
  faction: "RABBIT",
  enchant: 0 // inferred from suffix or rarity
}
```

**Result:** `living-resources-enhanced.json` (225 creatures) and `living-resources-reference.js` (JS module).

### 4.2 Improvements Possible Without TypeIDs

Given the extracted metadata, we can:

1. **Validate HP**:
   - Compare logged HP with expected HP per creature.
   - Detect anomalies.

2. **Enhance `MobsInfo.js`:**

```javascript
this.addItemWithMetadata(358, {
  tier: 1,
  enemyType: 1,
  resourceType: "hide",
  animal: "Rabbit",           // new
  expectedHP: 20,              // new
  prefab: "MOB_HIDE_RABBIT_01", // new
  faction: "RABBIT"            // new
});
```

3. **Infer Enchantment from Rarity:**

- Use `rarity - baseRarity` to estimate `.0/.1/.2/.3/.4`.
- See `ENCHANTMENTS.md` for full formula.

---

## 5. Player Equipment & Item Power

### 5.1 DEATHEYE Approach

DEATHEYE:

- Parsed `items.xml` to build a complete item database.
- Mapped item IDs → `itempower`.
- Calculated real item power (IP) for each slot.
- Accounted for 2H weapons (double weight).

### 5.2 Current OpenRadar Limitations (Before Upgrade)

- Equipment detection present (IDs from Event 29).
- No proper `items.xml`-based lookup.
- "Item power" approximations based on ID ranges, not real values.

### 5.3 Proposed Upgrade (Now Implemented in DEV Guide)

Create an `ItemsDatabase`:

```javascript
class ItemsDatabase {
  constructor() {
    this.itemsById = {};
    this.itemsByName = {};
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;

    const response = await fetch('/ao-bin-dumps/items.xml');
    const xmlText = await response.text();

    // Parse XML (DOMParser or custom)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

    const items = xmlDoc.getElementsByTagName('item');

    for (const item of items) {
      const id = parseInt(item.getAttribute('id'), 10);
      const name = item.getAttribute('uniquename');
      const tier = parseInt(item.getAttribute('tier'), 10) || 0;
      const enchant = parseInt(item.getAttribute('enchantmentlevel'), 10) || 0;
      const itempower = parseFloat(item.getAttribute('itempower')) || 0;

      const record = { id, name, tier, enchant, itempower };

      this.itemsById[id] = record;
      this.itemsByName[name] = record;
    }

    this.loaded = true;
  }

  getItemById(id) {
    return this.itemsById[id] || null;
  }

  getItemByName(name) {
    return this.itemsByName[name] || null;
  }
}

export const itemsDatabase = new ItemsDatabase();
```

Use it in `PlayersHandler`:

```javascript
getAverageItemPower() {
  if (!this.equipments || !Array.isArray(this.equipments)) {
    return null;
  }

  const db = window.itemsDatabase || playersHandler?.itemsDatabase;
  if (!db?.loaded) {
    return null;
  }

  const combatSlots = [0, 1, 2, 3, 4];

  let totalPower = 0;
  let count = 0;

  for (const slotIndex of combatSlots) {
    const itemId = this.equipments[slotIndex];
    if (!itemId || itemId <= 0) continue;

    const item = db.getItemById(itemId);
    if (item && item.itempower > 0) {
      totalPower += item.itempower;
      count++;
    }
  }

  // Handle 2H weapon
  const mainHandId = this.equipments[0];
  if (mainHandId > 0) {
    const mainHand = db.getItemById(mainHandId);
    if (mainHand?.name.includes('2H')) {
      totalPower += mainHand.itempower;
      count++;
    }
  }

  return count > 0 ? Math.round(totalPower / count) : null;
}
```

See `docs/dev/DEV_GUIDE.md` for the detailed implementation plan.

---

## 6. Critical Differences Summary

| Feature               | DEATHEYE                               | Current (before upgrades)                     | Status | Priority |
|-----------------------|----------------------------------------|-----------------------------------------------|--------|----------|
| **TypeID Offset**     | `typeId - 15`                          | direct `typeId`                               | ❌      | 🔴 CRIT   |
| **XML Database**      | Full parse of `harvestables/mobs/items`| Partial JSON only                             | ❌      | 🔴 CRIT   |
| **Enchant Detection** | XML suffix parsing                     | `params[33]` unreliable                       | ❌      | 🔴 CRIT   |
| **Living Resources**  | `MobInfo` lookup                       | Rarity calc buggy for Hide (fixed now)        | ❌      | 🟠 HIGH   |
| **Dungeon Enchant**   | `parameters[8]`                        | `parameters[6]`                               | ❌      | 🟡 MED    |
| **T6+ Tier**          | XML validation                         | Direct from game (buggy)                      | ❌      | 🟠 HIGH   |
| **Player Equipment**  | `items.xml` lookup                     | Approximation on IDs                          | ❌      | 🟢 LOW    |
| **Item Power**        | Real IP from XML                       | Nonsense (average of IDs)                     | ❌      | 🟢 LOW    |

---

## 7. Implementation Plan (from DEATHEYE Learnings)

### Phase 1: Quick Wins (5 min) – CRITICAL

1. **Fix TypeID Offset**

**File:** `scripts/Handlers/MobsHandler.js:481`

```javascript
// Change:
const typeId = parseInt(parameters[1]);
// To:
const typeId = parseInt(parameters[1]) - 15; // APPLY OFFSET
```

Impact: fixes a large portion of T6+ detection issues.

2. **Fix Dungeon Enchantment Offset**

**File:** `scripts/Handlers/DungeonsHandler.js:85`

```javascript
// Change:
const enchant = parameters[6];
// To:
const enchant = parameters[8]; // CORRECT OFFSET
```

Impact: solo dungeon enchantment becomes correct.

---

### Phase 2: XML Databases (≈45 min) – HIGH PRIORITY

1. **Copy `ao-bin-dumps` to public**

```bash
cp -r work/data/albion-radar-deatheye-2pc/ao-bin-dumps/ public/
```

Files used: `mobs.xml`, `harvestables.xml`, `items.xml`.

2. **Create `MobsDatabase.js`**

**File:** `scripts/Data/MobsDatabase.js`

- Parse `mobs.xml`.
- Extract tier, harvestableType, rarity (from suffix/name/rarity).
- Expose `load()` and `getMobInfo(typeId)`.

3. **Create `ItemsDatabase.js`**

**File:** `scripts/Data/ItemsDatabase.js`

- Parse `items.xml` with enchantments.
- Generate lookup structures (as shown above).
- Expose `load()`, `getItemById(id)`, `getItemByName(name)`.

4. **Integration into Handlers**

- **`MobsHandler.js`**:
  - Load `MobsDatabase` at startup.
  - Use `mobInfo.tier` and `mobInfo.rarity`.
  - Fix living resource detection.

- **`PlayersHandler.js`**:
  - Load `ItemsDatabase` at startup.
  - Fix `getAverageItemPower()` with real lookup.

---

### Phase 3: Player Equipment & Item Power (≈30 min) – CURRENT FOCUS

1. Create `ItemsDatabase.js`.
2. Modify `PlayersHandler` to use it.
3. Load items database at startup (`Utils.js`).
4. Validate item power display (must be in 700–1400 range for T4–T8).

---

### Phase 4: Testing & Validation (≈15 min)

Tests:

1. ✅ Player item power display (correct values vs game).
2. ✅ T6+ resources detection (after Phase 2).
3. ✅ Living resources enchantment (after rarity fix).
4. ✅ Solo dungeons enchantment (after offset fix).

---

## 8. Files to Create/Modify

### New Files

1. ✅ `scripts/Data/ItemsDatabase.js` – Phase 3 (player equipment).
2. 🔜 `scripts/Data/MobsDatabase.js` – Phase 2 (future branch).
3. 🔜 `scripts/Data/HarvestablesDatabase.js` – Phase 2 (future branch).

### Modified Files

1. ✅ `scripts/Handlers/PlayersHandler.js` – `getAverageItemPower()`.
2. 🔜 `scripts/Handlers/MobsHandler.js` – TypeID offset + DB lookup.
3. 🔜 `scripts/Handlers/DungeonsHandler.js` – enchant offset.
4. ✅ `scripts/Utils/Utils.js` – load databases at startup.

### Data

1. ✅ `public/ao-bin-dumps/items.xml` – copy from `work/data/`.
2. 🔜 `public/ao-bin-dumps/mobs.xml` – copy from `work/data/`.
3. 🔜 `public/ao-bin-dumps/harvestables.xml` – copy from `work/data/`.

---

## 9. Conclusion

### Root Causes Summary

1. **Missing TypeID offset (-15)** → mis-identified living resources.
2. **No XML database** → no single source of truth for tier/enchant.
3. **`params[33]` unreliable** → broken enchant detection for skinnables (fixed by rarity formula).
4. **Dungeon offset wrong** → incorrect dungeon enchantment.
5. **Item power calculation** → used item IDs instead of real `itempower`.

### Expected Gains After Fixes

| Metric                     | Before                | After Phase 1 | After Phase 2 | After Phase 3 |
|----------------------------|-----------------------|---------------|---------------|---------------|
| T6+ detection              | ~50%                  | ~75%          | 100%          | 100%          |
| Living resources enchant   | ~20%                  | ~30%          | 100%          | 100%          |
| Solo dungeons enchantment  | ~80%                  | 100%          | 100%          | 100%          |
| Player item power          | 0% (gibberish)        | 0%            | 0%            | 100%          |

### Next Steps

- Implement and validate XML database layer for mobs and harvestables.
- Finalize `ItemsDatabase`-based item power computation.
- Keep logging/analysis tooling up to date with schema changes.

---

_This analysis is the technical bridge between DEATHEYE’s full-XML architecture and the current OpenRadar implementation, and serves as a roadmap for closing critical gaps._
