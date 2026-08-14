## ⭐ 100 stars

OpenRadar just hit **100 stars**, and I did not expect a number to make me this happy.

I built this thing for me. A radar I wanted while farming, written between play sessions, with no plan beyond
scratching my own itch. It is the first project I have put out in the open that actually caught on, and learning that
a hundred other people wanted the same tool is a genuinely proud moment over here. So, thank you 🙏

Fitting release for it, too, because this is the one that fixes the bug that made the last one look broken.

---

If 2.2.2 kept showing stones as trees on your machine while the changelog said it was fixed, here is why: the binary
was correct, your browser was not. Game data was cached for a week with no way to tell it had changed, so an upgraded
radar kept reading the old catalog. That is fixed, along with seven other things that were quietly reporting the wrong
answer.

Closes #131, #145, #146. Ships fixes for #155 and #163, left open until the reporters confirm on this build.

---

## 🎯 What you'll notice

- 🗂️ **Upgrading actually upgrades the data.** Mobs and resources read correctly right after an install.
- 🐗 **Named bosses and event mobs are hostiles again**, not wisp signs.
- 🎽 **Player gear shows the right items**, and equipment changes now reach the players list at all.
- 🌿 **Living resources cluster again.** Broken since 2.1, only static nodes were ever grouped.
- 🔇 **The ignore list mutes alerts.** The page wrote the setting, nothing read it.
- 🔊 **A blocked alert sound tells you.** Browsers refuse audio until you click the page, which is exactly the state of
  a radar left in the background. It used to fail into a log nobody reads.
- 🖥️ **A console that cannot host the dashboard no longer takes the radar down with it.**
- 🔎 **Zoom out reaches 10%**, was 30%.

<details>
<summary>🐛 How each one broke</summary>

- **Stale game data after an upgrade** (#147, closes #146). `embed.FS` reports a zero modtime, so static assets had no
  `Last-Modified` and carried no `ETag` either. Combined with `max-age` (7 days for game data, 24h images, 1h scripts)
  the browser had no reason to ask for the new file. Assets now serve `no-cache` with a build-scoped `ETag` and answer
  304 through `http.ServeContent`, API responses are `no-store`, and the six database loaders fetch with
  `{cache: 'no-cache'}`. Caches poisoned by 2.2.2 heal on their own within the hour. Ctrl+F5 does it immediately.
- **Named non-portal mobs drawn as wisp signs** (#160, closes #145). Any named spawn was routed to the Mist portal
  list. The route is now gated on the `MISTS_` name prefix, the same discriminant the dungeon path already uses.
- **Equipment icons and equipment updates** (#162, closes #131). The catalog assumed a position in the file equals the
  Albion item id. It is keyed on the real ids now, and `CharacterEquipmentChanged` writes the field the player list
  actually reads.
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

</details>

<details>
<summary>🔒 Player names removed from the committed captures</summary>

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

<details>
<summary>🧪 Tests and documentation</summary>

**Tests**: 1,087 green (758 frontend, 329 Go), up from 947 at 2.2.2. Cache headers and revalidation are covered by
`internal/server/http_cache_test.go` and `_DatabaseCacheMode.test.js`. The zoom bounds and the Windows Docker build are
pinned by tests that read the file they describe, so a silent revert fails CI.

**The README inside this archive told you to select a network adapter at startup.** That prompt was removed back in
2.2, when interfaces became automatic. Every downloader since has been following a step that does not happen. Both the
Windows and Linux files are rewritten, and both now answer the two questions the tracker keeps receiving: why players
are not drawn on the radar, and what to check when nothing is detected.

The main README had its own set: an end-to-end test suite that has never existed, a Linux download URL that returned
404, a zoom range and a mob count wrong for several releases, and a table of threat colours that appear nowhere in the
code. Corrected, and a Common Questions section added from the closed issues.

Nine technical pages were checked line by line against the code. The corrections worth knowing: `KeySync` is event 600,
not 593; code 40 is `NewHarvestableObject`, not `NewMob`; batch harvestable spawn is 39, not 38 or 59.

</details>

---

## 🙏 Thanks

Reports on this one were unusually precise, and two arrived as pull requests.

- @lincongjian-beep (#146, stones read as trees after the 2.2.2 fix). This one took a while to believe because the
  binary was correct. The report is what pointed at the cache.
- @BlueLavend3r (#131 and PR #133, item id mapping). The diagnosis was right on both counts.
- @emrebaran619-ship-it (#163, no sound in the Mists while the flash fires).
- @EstebanLemes (PR #173, zoom range and the Windows Docker build).
- @lx78WyY0J5 (PR #150, libpcap soname mismatch and the Arch install path).

And to the 100 of you who starred it: that is the whole marketing budget. It works.

---

### Verification

```bash
sha256sum -c checksums-sha256.txt
```

### Requirements

**Windows:** Windows 10/11 (64-bit), [Npcap 1.87+](https://npcap.com/) - **Linux:** libpcap (`apt install libpcap0.8`)

---

**Full Changelog**: https://github.com/Nouuu/Albion-Online-OpenRadar/compare/2.2.2...2.2.3
