A hotfix for the **2026-06-29 Albion patch (1.31.030)**, which broke detection two ways at once: it shifted the network **event codes** (Dungeons, Chests, Wisp Cages, Fishing and faction alerts stopped dispatching) and reshuffled the **mob table** (every mob and living resource read the wrong creature, tier and danger). Both are resynced and validated against live captures.

Closes #141.

---

## 🐛 What's fixed

- 🧭 **Dungeons, chests, wisp cages and fishing zones dispatch again** - their event codes shifted by +2.
- 🐗 **Mobs read the correct tier and danger** - a common mob no longer shows up as a boss.
- 🌿 **Living resources show the right type and tier again.**
- 🚨 **Faction alerts and Mist lethality fire again.**
- 🧚 **Feu follets (wisp signs) are detected again.**

## 🌐 Why it broke

Both the event-code enum and the mob table are positional. The patch inserted 2 event codes (shifting every code at or above 248 by +2) and 591 mobs (shifting typeIds by +22 to +464). Nothing errors at runtime: a shifted code stops matching its handler, a shifted typeId resolves to a different mob. Fixed by resyncing the codes from upstream and refreshing the data, with the mob fixtures regenerated from a post-patch capture.

## ⚠️ Known, not fixed

- Named bosses and event mobs can show as a wisp sign instead of a hostile (#145).
- Living resource tier (#109, #101): improved by the data refresh, not re-verified.
- #100, #131, #113, #29 unchanged. Mist events 520 / 522 / 525 / 531 still unrouted; post-patch portal rarity was only seen on Common portals.

## 🧪 Tests

947 green (690 frontend, 257 Go). Mob fixtures regenerated from the post-patch capture.

## 🙏 Thanks

Patch day broke everything at once, and the #141 thread is what separated the two causes: a data-only refresh fixed the mobs and resources but left dungeons and cages dark, which pointed at the second, independent code drift.

- @hadikap (opened #141), @Neerdex (isolated the code drift), @BlueLavend3r (confirmed the two-step), @Itrapzone (data-refresh workflow), @djfaizp, @gregory5993, @sbibannedaku-tech.

---

### Verification

```bash
sha256sum -c checksums-sha256.txt
```

### Requirements

**Windows:** Windows 10/11 (64-bit), [Npcap 1.87+](https://npcap.com/) - **Linux:** libpcap (`apt install libpcap0.8`)

---

**Full Changelog**: https://github.com/Nouuu/Albion-Online-OpenRadar/compare/2.2.1...2.2.2
