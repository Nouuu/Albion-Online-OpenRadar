# 🚀 Quick Start – TypeID Collection

## ✅ Your system is already working!

Based on your logs, the enriched logging system is operational. Here is how to start collecting TypeIDs right away.

---

## 📋 Quick Checklist

### 1. Preparation (2 min)

```text
✅ Open the browser console (F12)
✅ Enable "Log Living Creatures" in Settings → Debug
✅ Clear TypeID cache (Settings → Debug → Clear TypeID Cache)
✅ Reload the page (F5)
```

### 2. In-Game (30–60 min)

```text
🎯 Go to zones with enchanted creatures
🔪 Kill living animals/plants (.1, .2, .3)
👀 Watch logs in the console
```

**You will see logs like:**

```json
{
  "timestamp": "2025-11-03T11:13:16.054Z",
  "module": "MobsHandler",
  "event": "SPAWN",
  ...
}
```

And readable lines such as:

```text
🟢 ✓ TypeID 425 | hide T4.0 | HP: 1323 → Boar
```

### 3. Save Logs (5 min)

**Option A – Quick (Browser console copy)**

```javascript
// Paste into the browser console
let logs = [];
document.querySelectorAll('.console-message').forEach(msg => {
  if (msg.textContent.includes('[LIVING_JSON]')) {
    logs.push(msg.textContent);
  }
});
copy(logs.join('\n'));
console.log(`✅ ${logs.length} logs copied!`);
```

Then `Ctrl+V` into a text file.

**Option B – Complete (Save as)**

1. Filter console by typing `LIVING_JSON` in the filter box.
2. Right click → "Save as...".
3. Name the file `logs-session-2025-11-03.txt`.

### 4. Analyze (1 min)

```bash
cd work/scripts
python parse-living-logs.py ../logs-session-2025-11-03.txt
```

**Expected output:**

```text
📊 LIVING RESOURCES COLLECTION REPORT
════════════════════════════════════

🔢 Total logs: 45
Ⓜ Unique TypeIDs: 8

TypeID 425 → hide T4.0 | Boar ✓ | 🟢 12 🔴 3
TypeID 426 → hide T4.1 | Unknown | 🟢 5 🔴 1
...

📝 MobsInfo.js Entries:
    426: [4, EnemyType.LivingSkinnable, "Hide", 1],
    ...
```

---

## 🎯 Recommended Zones (30 min each)

### Session 1: Hide T4 (.0, .1, .2, .3)

- **Zone:** Bridgewatch – North-West (T4 red zones)
- **Creatures:** Boar, Wolf, Fox
- **Goal:** At least 4 TypeIDs (T4.0 + T4.1 + T4.2 + T4.3)

### Session 2: Hide T5 (.0, .1, .2, .3)

- **Zone:** Forest – T5 red zones
- **Creatures:** Bear, Direwolf
- **Goal:** At least 4 TypeIDs

### Session 3: Fiber T4–T5

- **Zone:** Highland/Forest T4–T5
- **Creatures:** Living plants (Keeper)
- **Goal:** 8 TypeIDs (T4 ×4 + T5 ×4)

---

## 🔍 What to Look For

### Identify Enchantment Level

After a kill, look at the corpse glow:

- **No glow** = .0 (normal) → Already known.
- **Green glow** = .1 → TO COLLECT.
- **Blue glow** = .2 → TO COLLECT.
- **Purple glow** = .3 → TO COLLECT.

### Logs to Focus On

**Good log (enchanted creature):**

```json
"reportedTypeId":426, "tier": 4, "name": "hide", "enchant": 1  // TypeID 426 = Hide T4.1!
```

**Ignored log (normal creature):**

```json
"reportedTypeId":425, "tier": 4, "name": "hide", "enchant": 0  // Already known
```

---

## 📈 Real-Time Tracking

In a separate text file, track progress like this:

```text
=== SESSION 2025-11-03 ===

Zone: Bridgewatch T4 Red
Time: 14:30

TypeID 425 | Hide T4.0 | Boar        ← Already known
TypeID 426 | Hide T4.1 | Unknown     ← NEW! ✓
TypeID 432 | Hide T4.2 | Unknown     ← NEW! ✓
TypeID 438 | Hide T4.3 | Unknown     ← NEW! ✓

Total new: 3
```

---

## ⚠️ Common Issues

### "No [LIVING_JSON] logs"

- ✅ Check that "Log Living Creatures" is enabled.
- ✅ Reload the page (F5).
- ✅ Move to an area with living creatures.

### "All TypeIDs look identical"

- ✅ You are likely killing only `.0` (normal) creatures.
- ✅ Go to **enchanted** zones (red/black).
- ✅ Check corpse glow for enchantment.

### "Too many logs, hard to follow"

- ✅ Filter console with `LIVING_JSON`.
- ✅ Use the copy script (Option A).
- ✅ Take breaks every 15 minutes to save logs.

---

## 🎯 Session Goals

**Minimum viable (1h):**

- Hide T4: 4 TypeIDs (.0, .1, .2, .3).
- Hide T5: 4 TypeIDs (.0, .1, .2, .3).

**Complete (2–3h):**

- Hide T4–T5: 8 TypeIDs.
- Fiber T4–T5: 8 TypeIDs.
- Total: 16 new TypeIDs.

**Full coverage (4–6h):**

- Hide T4–T8 (all enchants).
- Fiber T4–T8 (all enchants).
- Wood/Ore/Rock (optional).

---

## 🎉 After the Collection

1. ✅ Parse logs: `python parse-living-logs.py logs.txt`.
2. ✅ Copy generated `MobsInfo.js` entries.
3. ✅ Create a GitHub issue with results (optional).
4. ✅ Share raw logs for validation (optional).

---

**Ready? Launch the game and happy hunting! 🎮🔍**

> 💡 Tip: Start with a 15–30 min test session to validate the workflow, then do a longer run.
