## 🐉 Back after Dragonfire

Dragonfire and the 12 October patch broke most of what the radar reads. This release puts it all back, plays the alert
sound from the radar itself, and gives the Radar page a real settings panel.

Closes #127, #153, #163, #183, #187, #192, #193, #195, #196, #198, #216, #224. Ships fixes for #219, #222 and #229, open
until the reporters confirm. Already on 2.2.4-beta1? You have the Dragonfire fixes, everything else is new.

---

## ⚠️ Before you upgrade

- **Avalonian treasure drones moved** from Normal to Enemies > Other > Avalonian Drones, off by default. Tick it to keep
  seeing them.
- **The alert sound plays on the PC running the radar**, not on a phone or tablet viewing it over the network.
- **On Linux**, the alert sound needs PulseAudio or PipeWire, or `libasound2` without them.
- **Settings carry over**, with a few moves:
  - **Keep screen awake** is on by default, and also keeps a PC monitor awake while the radar page is open. Turn it off
    in the Radar settings panel.
  - **Mists bosses** you never ticked in 2.2.3 stay off: tick them under Enemies > Mists Bosses.
  - **Map background and resource display options** now live in the Radar settings panel, **debug options** in
    Settings > Debug. Enchanted enemies are now **Champion**.
  - **Gone**: the All enemies checkbox, the Bosses and Mini-Boss+ presets (All and Clear remain), Health Throttling and
    Clear Browser Cache.
  - Backend logs and pcap recording now change only from the radar PC, like network interfaces.
- **Building from source** needs Go 1.27 and Node.js 26. Released binaries are not affected.

---

## 🎯 What you'll notice

- 🌿 **Resources read their real tier again.** T4 nodes no longer show as T8, T6 hide and Mists living wood are right,
  marmots are T1 hide (#193, #196, #222).
- 🎽 **Enemy gear is the right gear again** (#198, #229). The IP shown is the average base item power, so it can differ
  from the game.
- 🌀 **Wisp signs, their portals, living resource enchants and Mists dungeon entrances are back** (#192, #195).
- 📦 **Cages, chests, fishing zones, dungeon exits, Mists entry, faction changes and mounts are back** after the 12
  October patch (#224). Open cages are hidden, fishing zones stay up to 30 minutes.
- 🔊 **The alert sound plays from the radar itself**: no more "click the page", and muting the tab no longer silences it
  (#163, #219). Keep the radar tab visible: a hidden or minimized tab delays alerts.
- 🎵 **Eight alert sounds** with picker, preview, volume and cooldown (#153, #183).
- 🛣️ **Roads of Avalon maps that hold a hideout are black zones.** Hostiles are listed and alerts fire again (#187).
- 🖥️ **Radar settings panel**: zoom, size up to 1200 px, fit to screen, icon size, HUD toggles, players beside radar,
  keep screen awake, fullscreen, and a landscape layout for phones used sideways (#216). Zoom, size and icon size now
  work on phones too.
- 🎨 **Every settings page has a new look**: toggles, collapsible sections that remember their state, sliders with -/+
  and reset, short tooltips. See the
  [screenshots](https://github.com/Nouuu/Albion-Online-OpenRadar/tree/2.3.0/docs/images).
- 👥 **One Detect players switch** for the list, counts, flash, border and sound. Cards gain guild, total IP and mounted
  toggles, and update live when gear, name, guild, faction or mount changes. Ignored players no longer pulse the red
  border.
- 🐲 **Four Mists bosses** get their own icon and toggle: Fairy Dragon, Griffin, Veil Weaver, Crystal Spider (#127). Only
  the Fairy Dragon is confirmed live so far.

<details>
<summary>🐛 How each one broke</summary>

- **Dragonfire** (#194) shifted event codes, mob ids and item ids (12215 of 12237 items resolved wrong), and inserted a
  parameter on mob spawns and dungeon exits. Tables and game data were regenerated and the reads moved.
- **12 October patch** (#230) removed one event, so every later code moved down by one. Open cages were drawn because
  their state was never read.
- **Fishing zones** (#228, in #230) are announced once, so the 5 minute stale age dropped zones still in range. They now
  get the 30 minute age of chests and cages.
- **Roads of Avalon** (#202): the black zone rule covered two map families, leaving 100 hideout maps safe. It now covers
  all 400 Roads maps.
- **Alert sound** (#184): the browser played it, and a page nobody clicked may not make sound.
- **Drones** had no type of their own and fell back to Normal.

</details>

<details>
<summary>🧪 Tests and the rest</summary>

- 1,492 frontend tests green, up from 758 at 2.2.3, and the Go suite passes.
- Griffin, Veil Weaver, Crystal Spider and the drones are not confirmed from a capture yet. Met one with the radar
  running? Tell me.
- Resource clusters work out of the box (30 m, 2 nodes). Before, the fields showed those values but the radar read 0.
- Chests, dungeon entrances, wisp cages and Knightfall portals leave the radar after 30 minutes without an update.
- Dungeon, Mists entrance and wisp cage filters apply at once to what is already on the radar.
- A fresh install or Reset All Settings starts with players, Champion, Mini-Boss, Boss, Mists bosses, fishing, chests,
  Mists, dungeons and T4 to T8 resources on. Reset now keeps your ignore list.
- A `-ip` that matches nothing warns and no longer overwrites your saved interfaces.
- 46 item and 11 spell icons from Dragonfire, two arena loot bag icons.
- Player spell icons can still be wrong (#166), so Show Spells stays off by default.
- README screenshots refreshed for the new settings interface.

</details>

---

## 🙏 Thanks

@declaranet-dev (PR #194) regenerated the code tables and game data the day Dragonfire shipped, where most of the fixes
above start. @marlito22 (PR #228) kept fishing zones on the radar.

Reports and requests: @maxzflow, @forestez, @sbibannedaku-tech, @tc155426, @ITSSAMURAI, @rodyuga, @nattakingo,
@MD71-code, @emrebaran619-ship-it, @vitunkeisari, @GabYeager, @Abimaelmsantos.

---

### Verification

```bash
sha256sum -c checksums-sha256.txt
```

### Requirements

**Windows:** Windows 10/11 (64-bit), [Npcap 1.87+](https://npcap.com/) - **Linux:** libpcap (`apt install libpcap0.8`),
plus `libasound2` without PulseAudio or PipeWire

---

**Full Changelog**: https://github.com/Nouuu/Albion-Online-OpenRadar/compare/2.2.3...2.3.0


