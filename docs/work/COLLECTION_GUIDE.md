# 📊 Collection Guide – Living Resources TypeIDs

## 🎯 Goal

Collect TypeIDs for enchanted living creatures (Hide/Fiber T4–T8 .1/.2/.3) using the new enriched logging system.

---

## ⚙️ Preparation

### 1. Clear cache (IMPORTANT!)

Before starting, clear the localStorage cache:

1. Open the browser console (F12).
2. Go to the radar Settings.
3. Click **"Clear TypeID Cache"**.
4. Reload the page (F5).

### 2. Enable logging

1. Open Settings → Debug.
2. Check **"🔍 Log Living Creatures"**.
3. A collection guide appears in the console.

### 3. Open the console

- Press F12.
- Go to the **Console** tab.
- Keep the console open during the entire session.

---

## 🎮 Collection Session

### Log Format

You will see two types of logs:

**1. JSON (for automatic parsing):**

```text
[LIVING_JSON] {"timestamp":"2025-11-03T...","typeId":425,"resource":...}
```

**2. Human-readable (for you):**

```text
🟢 ✓ TypeID 425 | hide T4.0 | HP: 1323 (expected ~1323, diff: 0) → Boar
│
├─ 🟢 = Living creature
├─ ✓ = HP matches expected creature
├─ TypeID 425 = Unique identifier
├─ hide T4.0 = Type/Tier/Enchantment
└─ → Boar = Identified animal
```

### Symbols

- **🟢** = LIVING creature.
- **🔴** = DEAD creature (corpse).
- **✓** = HP validated (matches a known creature).
- **?** = HP not validated (unknown creature).

---

## 🗺️ Recommended Zones

### For Hide (animals)

#### T4 Enchanted (.1 .2 .3)

- **Bridgewatch** – North-West (red zones).
- **Caerleon** – Surrounding steppes (T4–T5 zones).

#### T5 Enchanted (.1 .2 .3)

- **Forest** – T5 red zones.
- **Swamp** – T5 red zones.

#### T6+ Enchanted

- **Black Zone** – Main routes.
- **Avalon Roads** – Random roads.

### For Fiber (living plants)

#### T4–T5

- **Highland** – T4–T5 zones (Keeper).
- **Forest** – Zone edges.

#### T6+

- **Black Zone** – Contested zones.
- **Hideouts** – Around active farming areas.

---

## 📝 During the Session

### What you must do

1. **Move** through target zones.
2. **Kill enchanted creatures** (.1, .2, .3).
3. **Watch logs** in the console.
4. **Check** that TypeID changes for each enchantment.

### What you must record

For each killed creature:

- ✅ Displayed TypeID.
- ✅ Tier (T4, T5, T6...).
- ✅ Enchantment (.1, .2, .3).
- ✅ Type (Hide or Fiber).
- ✅ HP validation (✓ or ?).

### Example Session

```text
Zone: Bridgewatch T4 Red (enchanted animals)

🟢 ✓ TypeID 425 | hide T4.0 | HP: 1323 → Boar        ← .0 (already known)
🟢 ? TypeID 426 | hide T4.1 | HP: 1450 → Unknown     ← .1 TO COLLECT!
🔴 ? TypeID 426 | hide T4.1 | HP: 0   → Unknown      ← Same creature dead
🟢 ? TypeID 432 | hide T4.2 | HP: 1580 → Unknown     ← .2 TO COLLECT!
🟢 ? TypeID 438 | hide T4.3 | HP: 1720 → Unknown     ← .3 TO COLLECT!
```

---

## 💾 After the Session

### 1. Save Logs

**Method 1: Manual save**

- Right click in the console → **"Save as..."**.
- Save as `logs-session-YYYY-MM-DD.txt`.

**Method 2: Filter and copy**

```javascript
// Paste into the console to extract all LIVING_JSON logs
let logs = [];
document.querySelectorAll('.console-message').forEach(msg => {
  if (msg.textContent.includes('[LIVING_JSON]')) {
    logs.push(msg.textContent);
  }
});
copy(logs.join('\n'));
console.log(`✅ ${logs.length} logs copied to clipboard!`);
```

**Method 3: Filter directly in the console**

1. Click the "Filter" (funnel) icon at the top of the console.
2. Type: `LIVING_JSON`.
3. Right click → **"Save as..."** → save the filtered file.

### 2. Parse Logs

Use the provided Python script:

```bash
cd work/scripts
python parse-living-logs.py ../logs-session-2025-11-03.txt
```

**Expected output:**

```text
📊 LIVING RESOURCES COLLECTION REPORT
═══════════════════════════════════════════════════════════

🔢 Total logs: 150
🆔 Unique TypeIDs: 25

───────────────────────────────────────────────────────────
📋 TypeIDs Summary:
───────────────────────────────────────────────────────────

TypeID   425 →   hide T4.0 |         Boar ✓ | 🟢  45 🔴  12 | Validated: 57/57
TypeID   426 →   hide T4.1 |      Unknown   | 🟢  12 🔴   3 | Validated: 0/15
TypeID   432 →   hide T4.2 |      Unknown   | 🟢   8 🔴   2 | Validated: 0/10
...

───────────────────────────────────────────────────────────
🔍 Coverage Analysis:
───────────────────────────────────────────────────────────

hide:
  T4: Found [.0, .1, .2, .3] | Missing [None]
  T5: Found [.0, .1] | Missing [.2, .3]
  T6: Found [.0]      | Missing [.1, .2, .3]

───────────────────────────────────────────────────────────
📝 MobsInfo.js Entries (Copy-paste ready):
───────────────────────────────────────────────────────────

    426: [4, EnemyType.LivingSkinnable, "Hide", 1],
    432: [4, EnemyType.LivingSkinnable, "Hide", 2],
    438: [4, EnemyType.LivingSkinnable, "Hide", 3],
    ...
```

### 3. Share Results

Share:

- Raw log file (`logs-session-XXX.txt`).
- Python script output.
- Screenshots if possible (visual validation).

---

## 🐛 Troubleshooting

### Issue: No logs

**Solution:**

1. Check that **"Log Living Creatures"** is enabled.
2. Reload the page (F5).
3. Ensure the console is open.

### Issue: All logs show "?"

**Cause:** Metadata not loaded.

**Solution:**

1. Check that `/tools/output/living-resources-enhanced.json` exists.
2. Reload the page (F5).
3. Check for loading errors in the console.

### Issue: Always the same TypeIDs

**Cause:** You are always killing the same `.0` creatures.

**Solution:**

- Go to **enchanted** zones (red/black).
- Ensure enchantment level changes (.1, .2, .3).
- Check the corpse after the kill (enchantment glow).

### Issue: Too many logs

**Solution:** Filter logs in the console:

```text
Click "Filter" → Type "LIVING_JSON".
```

---

## 📊 Collection Objectives

### Priority P1 (Critical)

- [ ] Hide T4 (.1, .2, .3) – **15 TypeIDs**.
- [ ] Hide T5 (.1, .2, .3) – **15 TypeIDs**.
- [ ] Fiber T4 (.1, .2, .3) – **9 TypeIDs**.
- [ ] Fiber T5 (.1, .2, .3) – **9 TypeIDs**.

### Priority P2 (Important)

- [ ] Hide T6 (.1, .2, .3) – **15 TypeIDs**.
- [ ] Fiber T6 (.1, .2, .3) – **9 TypeIDs**.

### Priority P3 (Optional)

- [ ] Hide T7–T8 enchanted.
- [ ] Fiber T7–T8 enchanted.
- [ ] Wood/Ore/Rock living resources.

---

## 🎯 Tips

### Maximize Efficiency

1. **Group with a scout** – Someone on a fast mount scouts, you collect.
2. **Trade routes** – Black zone routes = many enchanted creatures.
3. **Hideout farming** – Areas around active hideouts.
4. **Avalon roads** – Random paths with varied spawns.

### Quickly Identify Enchantment

After a kill, look at the corpse:

- **No glow** = .0 (normal).
- **Green glow** = .1.
- **Blue glow** = .2.
- **Purple glow** = .3.

### Optimize Time

- **1h session** = ~30–50 TypeIDs collected (T4–T5 zones).
- **2h session** = ~70–100 TypeIDs collected (mixed T4–T6).
- **4h session** = ~150–200 TypeIDs collected (full T4–T8).

---

## 📞 Support

Questions? Issues?

- **GitHub Issues**: [link to repo]
- **Discord**: [project Discord link]
- **Contact**: @Nouuu

---

**Happy collecting! 🎮🔍**
