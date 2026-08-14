A fix pass on the two paths that quietly report the wrong thing: the **reference data your browser holds**, and the
**alerts that are supposed to warn you**. If 2.2.2 kept showing stones as trees on your machine while the changelog said
it was fixed, this is the release that explains why.

Closes #131, #145, #146. Ships fixes for #155 and #163, both left open until the reporters confirm on this build.

---

## 🎯 What you'll notice first

- 🗂️ **Upgrading actually upgrades the data.** Game data was cached for 7 days with nothing to revalidate against, so
  after installing 2.2.2 the browser kept serving 2.2.1's catalog at the same URL. Mobs and resources stayed
  mislabeled on a binary that was already fixed. Incognito worked, which is what made it so confusing to report.
- 🐗 **Named bosses and event mobs are hostiles again**, not wisp signs. Any named spawn was routed to the Mist portal
  list.
- 🎽 **Player gear shows the right items.** The item catalog assumed a position in the file equals the Albion item id.
  It does not. On top of that, equipment changes never reached the player list at all.
- 🌿 **Living resources cluster again.** Broken since 2.1: the cluster filter read a variable that production never
  sets, so only static nodes were ever grouped.
- 🔇 **The ignore list mutes alerts.** The page wrote the setting and nothing read it, so ignored players kept
  flashing the screen and sounding the alarm.
- 🔊 **A blocked alert sound says so.** Browsers refuse audio until the page gets a click, which is exactly the state
  of a radar left in the background. That refusal went into a debug log nobody reads. It now raises a warning on
  screen.
- 🖥️ **A terminal that cannot host the dashboard no longer kills the radar.** The console error tore down capture and
  the web server with it.
- 🔎 **Zoom out reaches 10%**, was 30%.

---

## 🐛 Bug fixes

- **Stale game data after an upgrade** (#147, closes #146). `embed.FS` reports a zero modtime, so static assets had no
  `Last-Modified` and carried no `ETag` either. Combined with `max-age` (7 days for game data, 24h images, 1h scripts)
  the browser had no reason to ask for the new file. Assets now serve `no-cache` with a build-scoped `ETag` and answer
  304 through `http.ServeContent`, API responses are `no-store`, and the six database loaders fetch with
  `{cache: 'no-cache'}`. Caches poisoned by 2.2.2 heal on their own within the hour. Ctrl+F5 does it immediately.
- **Named non-portal mobs drawn as wisp signs** (#160, closes #145). The route to the Mist list is now gated on the
  `MISTS_` name prefix, the same discriminant the dungeon path already uses.
- **Equipment icons and equipment updates** (#162, closes #131). The item catalog is keyed on real Albion item ids
  instead of `array_index + 1`, and `CharacterEquipmentChanged` writes the field the player list actually reads.
- **Living resource clustering** (#159). `_collectClusterCandidates` compared against `window.EnemyType`, a global that
  production never assigns, so every comparison hit `undefined`. It reads the module import now.
- **Ignore list not wired to the alert gate** (#161). Matching is on nickname, guild or alliance, trimmed and case
  insensitive. Blank entries never match, so a stray empty line cannot mute every threat. Ignored players still render
  on the radar and in the list, which is what the page promises.
- **Blocked threat sound** (#174, closes #163). Logged at warn level and raised as a persistent toast, once, so a
  stream of hostiles cannot bury the screen.
- **Console dashboard failure took the radar down** (#155). On some Windows console hosts the terminal library cannot
  switch stdin to raw mode and returns `error making raw: The parameter is incorrect.`. The dashboard is optional now:
  it reports why it could not start and the web interface keeps running. This also adds the SIGINT and SIGTERM
  handling the app never had.
- **Windows Docker build shipped without its stylesheet** (#173). `Dockerfile.windows` embedded the frontend without
  running the Tailwind build first. A frontend stage now generates the assets before the Go build copies them in.

---

## 🔒 Privacy

<details>
<summary>Player names and machine identifiers removed from the committed captures</summary>

The pcap fixtures in `internal/photon/testdata/` carried the nicknames, guild names and alliance tags of players who
happened to be near a recording session, plus the GPU, CPU and operating system of one recording machine and an account
identifier. Only the operator's own name had ever been scrubbed, because the anonymizer removed nothing beyond the
strings passed on the command line.

Matching names as raw bytes is not a workable fix: the shortest nickname in the corpus is three characters and collides
with binary payload data. The tool now decodes each capture with the project parser, reads the parameters known to carry
identity data, and replaces those values anchored on their own Photon length prefix. A value the protocol split across
two packets is patched only when both halves line up.

Anonymization also became the default. Writing a capture untouched now needs an explicit `--no-scrub`, and the run
prints a replacement count per value so a mistyped name shows up as zero instead of passing for a clean run. A companion
tool, `tools/photon-strings`, lists every string a capture carries grouped by message kind, Albion code and parameter
index, which is how the field table was derived and how it gets audited.

All 22 fixtures were rewritten. Every file kept its exact byte length, and the Go suite stayed green.

</details>

---

## 🧪 Tests

1,087 green (758 frontend, 329 Go), up from 947 at 2.2.2. Cache headers and revalidation are covered by
`internal/server/http_cache_test.go` and `_DatabaseCacheMode.test.js`. The zoom bounds and the Windows Docker build are
pinned by tests that read the file they describe, so a silent revert fails CI.

## 📄 Documentation

The README shipped inside the archive told you to select a network adapter at startup. That prompt was removed back in
2.2, when interfaces became automatic. Every downloader since has been following a step that does not happen. Both the
Windows and Linux files are rewritten, and both now answer the two questions the tracker keeps receiving: why players
are not drawn on the radar, and what to check when nothing is detected.

The main README had its own set: an end-to-end test suite that has never existed, a Linux download URL that returned
404, a zoom range and a mob count wrong for several releases, and a table of threat colours that appear nowhere in the
code. Corrected, and a Common Questions section added from the closed issues.

Nine technical pages were checked line by line against the code. The corrections worth knowing: `KeySync` is event 600,
not 593; code 40 is `NewHarvestableObject`, not `NewMob`; batch harvestable spawn is 39, not 38 or 59. Both Protocol18
snapshots now state which side of the 2026-06-29 shift they were recorded on.

## 🙏 Thanks

Reports on this one were unusually precise, and two of them arrived as pull requests.

- @lincongjian-beep (#146, stones read as trees after the 2.2.2 fix). This one took a while to believe because the
  binary was correct. The report is what pointed at the cache.
- @BlueLavend3r (#131 and PR #133, item id mapping). The diagnosis was right on both counts.
- @emrebaran619-ship-it (#163, no sound in the Mists while the flash fires).
- @EstebanLemes (PR #173, zoom range and the Windows Docker build).
- @lx78WyY0J5 (PR #150, libpcap soname mismatch and the Arch install path).

---

### Verification

```bash
sha256sum -c checksums-sha256.txt
```

### Requirements

**Windows:** Windows 10/11 (64-bit), [Npcap 1.87+](https://npcap.com/) - **Linux:** libpcap (`apt install libpcap0.8`)

---

**Full Changelog**: https://github.com/Nouuu/Albion-Online-OpenRadar/compare/2.2.2...2.2.3
