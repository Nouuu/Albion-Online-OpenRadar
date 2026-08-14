A focused patch release that makes **threat detection actually work inside the Mists**, restores the **standard Solo/Duo Mist portals** that a mid-cycle server update had silently broken, adds **Knightfall Abbey portals** to the radar, and fixes the **stretched map in city sub-zones**. All on top of a safety net grown to **936 tests** (679 frontend + 257 Go), every fix pinned by a failing test first.

Closes #112, #117, #119, #120, and discussion #102, #108.

---

## 🎯 What you'll notice first

- 🚨 **Alerts finally fire inside the Mists from Brecilien** - a Mist entered from Brecilien was classified `Safe`, so the alarm, the screen flash, and the beep never triggered even with hostiles on top of you. The radar now reads the real Mist class on entry and alerts correctly.
- 🔴 **Roads of Avalon and red-origin Mists are lethal** - both are full-loot Black Zones per the game rules. The radar treated Avalon Roads as `safe` and red-origin Mists as `red` (faction-only alarm). Both now alarm on any player, not just faction-flagged ones.
- ⛪ **Knightfall Abbey portals on the radar** - the sanctuary portal that spawns inside Mist instances now shows up, behind a new **Show Knightfall Abbey** setting toggle.
- 🌫️ **Standard Mist portals are back** - a server update around 2026-05-15 stopped sending the portal name where the radar read it, which silently dropped Solo/Duo Mist portal display on 2.2.0. Fixed.
- 🔊 **The beep survives long sessions** - after a long play session the threat sound went silent while the flash and border kept working. The sound now plays from a fresh audio element each time.
- 🗺️ **Sub-zone maps line up again** - in small clusters (Brecilien plaza, bank, market) the background map was stretched and the player dot landed off the visible area. The map now renders at the cluster's real size and the dot sits where you actually are.

---

## 🐛 Bug Fixes

- **Mist threat detection inside Brecilien** (#123, closes #117, #112). The radar reads the Mist class on entry from `op 473 MistsUseStaticEntrance` (non-lethal yellow vs lethal black, solo vs duo), verified across 6 pcaps. Falls back to origin-cluster inheritance when the op is not seen.
- **Mist sanctuary chain and Knightfall Abbey** (#124, closes #119). The Mist class now survives a Knightfall Abbey round-trip, a Mist-to-Mist border exit, and an in-app navigation, instead of falling back to safe. A Mist entered from a red zone is treated as lethal black. The Knightfall Abbey portal shows on the radar behind a new **Show Knightfall Abbey** toggle and despawns on its Leave event.
- **Roads of Avalon forced to lethal** (#118). `zones.json` tagged `TUNNEL_ROYAL` and `TUNNEL_ROYAL_RED` as safe/red, but every Road of Avalon is a full-loot Black Zone. A live capture confirmed the alarm was suppressed there. Both are now overridden to `black`; hideout interiors stay safe.
- **Threat beep robustness** (#124). The reused audio element went silent after a long session. The beep now plays from a fresh element each trigger.
- **Sub-zone map rendering** (#121, closes #120). Small clusters were drawn at a fixed 825 game-units and stretched, so the player dot drifted off the terrain. The map now renders at each zone's real bounds and recenters on the bounds midpoint, which also fixes the asymmetric city sub-zones.

---

## 🌐 Server protocol regression (mid-cycle hotfix)

<details>
<summary>A server update silently broke standard Mist portals on 2.2.0</summary>

Between 2026-05-14 and 2026-05-16 the Albion server stopped sending the MISTS portal name in `Parameters[3]` (event 323); it now lives only in `Parameters[15]`. This silently broke standard Solo/Duo Mist portal display on 2.2.0, with no client change on our side. Pinned by a cross-capture diff (same portal type, the field populated through 05-14 and empty from 05-16) and fixed with a `Parameters[15]` fallback (#124).

</details>

---

## ✅ Issues and discussions this release resolves

<details>
<summary>6 items closed (4 issues + 2 discussions)</summary>

| Item | Status | Fixed by |
|---|---|---|
| #117 Brecilien Mist classified Safe, no alarm in Mists | Closed | #118, #123, #124 |
| #112 Mists not recognized as a danger zone | Closed | #123, #124 |
| #119 No sound cue for players in Knightfall Abbey | Closed | #124 |
| #120 Radar map stretched in small sub-zones | Closed | #121 |
| Discussion #102 (no alarm / flash / beep in Mists) | Resolved | #123, #124 |
| Discussion #108 (no alarm on the Brecilien to Avalon exit) | Resolved, pending reporter confirmation | #118, #124 |

The Mist alarm chain (Brecilien classification + red-origin lethality + sound robustness) is what closes discussion #102 end to end. Discussion #108 is the same alarm gate on the Brecilien to Avalon exit: the road was classified `safe`, so `isPlayerThreat(255, 'safe')` returned false and no alarm fired even with enemies present. Forcing Roads of Avalon to lethal (#118) restores the alarm there. It is marked pending confirmation because the reporter also mentions enemy dots being intermittently absent while resources render; a one-way-portal pcap would be needed to rule out a separate player-event drop, so the reporter is asked to confirm on 2.2.1 before it is closed for good.

</details>

---

## ⚠️ Known, not fixed in 2.2.1

<details>
<summary>Known bugs untouched by this release</summary>

- **#109** Wood living resources missing, living resources reading one tier high.
- **#101** T8 Mist living nodes.
- **#100** Rich static nodes misclassified by family (`typeNumber` 16-22 not always Hide).
- **#113** Missing player equipment.
- **#29** Chest rarity to drawing-layer color (rarity is persisted on the entity since 2.2.0; the color resolution at draw time is still backlog).

</details>

---

## 🧪 Tests

<details>
<summary>936 tests, all green (679 frontend, 257 Go)</summary>

Every Mist fix shipped with a pcap-derived fixture first, the server regression included.

</details>

---

## 🛠️ Under the Hood

<details>
<summary>Click to expand technical details</summary>

### Map sizing diverged from the issue proposal
Issue #120 proposed persisting the cluster `@size` and drawing at `max(W, H)`. The shipped fix (#121) uses `@minimapBoundsMin/Max` instead and persists a bounds rectangle, then recenters the texture on the bounds midpoint. The minimap asset depicts the bounds rectangle, not the raw cluster size, and on asymmetric city sub-zones the bounds center is offset from the cluster origin (Brecilien Bank mid `(5, -75)`, Market mid `(5, 75)`). Sizing on `@size` alone would have lined up the scale but kept the dot offset on those sub-zones. The translation by `(-(hX - center.x) * sf, (hY + center.y) * sf)` is what lands the dot correctly regardless of cluster origin offset.

### op 473 as a Mist class discriminant
The wire does not carry a Mist `pvpType`. `op 473 MistsUseStaticEntrance` is fired when you take a static Mist entrance; `Parameters[2]` is absent for a non-lethal (yellow) Mist and present for a lethal (black) one, with the value doubling as the mode flag (2 solo, 4 duo). The router caches that choice and applies it to the next `@MISTS@*` join within 30 seconds, then writes a forced `pvpType` into the zone override entry.

### Mist override lifecycle
The override resolution order in `applyMapChange` is: consume a pending `op 473` choice, else continue a sanctuary chain across `@MISTSDUNGEON@`, else inherit from the previous Mist on a Mist-to-Mist border exit, else fall back to origin-cluster inheritance. The override carries its `pvpType` into `sessionStorage` so it survives an in-app navigation.

</details>

---

## 🔧 Maintenance

<details>
<summary>Dependency and CI bumps</summary>

- Dependency bumps: `golang.org/x/net` 0.54.0, `golang.org/x/sys` 0.44.0, `golang.org/x/text` 0.37.0; `@tailwindcss/cli` 4.3.0, `vitest` 4.1.6, `typescript-eslint` 8.59.3, `puppeteer` 24.43.1.
- CI: `golangci-lint-action` pinned to v2.12.2, `docker/setup-buildx-action` to v4.

</details>

---

## 🙏 Thanks

This release runs on your bug reports. To be clear about how it works: I record every pcap myself. What your reports do is aim the search, which Standing, which entry route, which zone to go look at. From there I still have to reproduce each bug on my own client, and the Mist surface is wide enough that replicating one report can take hours of play before I can capture it cleanly and pin the cause. So the reports matter a lot, even when no capture is attached 🫶.

- @bigegg16 (#112, Mists not recognized as a danger zone)
- @StelMorph (Brecilien Mist classified Safe, the report behind #117)
- @forestez (#119, no sound cue in Knightfall Abbey)
- @Disgusting15ff (discussion #102, no alarm / flash / beep in the Mists)
- @danilka3113-lab (discussion #108, no alarm on the Brecilien to Avalon exit)

If your handle is missing here it is on me, not on the value of what you reported. Leave a comment on the release or in [Discussions](https://github.com/Nouuu/Albion-Online-OpenRadar/discussions) and I will edit you in.

---

### Verification

```bash
sha256sum -c checksums-sha256.txt
```

### Requirements

**Windows:** Windows 10/11 (64-bit), [Npcap 1.87+](https://npcap.com/)

**Linux:** libpcap (`apt install libpcap0.8`)

---

**Full Changelog**: https://github.com/Nouuu/Albion-Online-OpenRadar/compare/2.2.0...2.2.1
