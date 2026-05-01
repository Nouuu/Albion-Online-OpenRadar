# DEATHEYE comparison

Why OpenRadar diverged from DEATHEYE on architecture and what we kept from its design.

*Last verified against code: 2026-05-01.*

## Two philosophies

DEATHEYE is the canonical Albion radar. It used a Photon MITM proxy (Cryptonite) to decrypt every event and parsed full XML dumps for items, mobs, and harvestables. The result was a complete picture of the game state at the cost of a complex, detection-prone runtime.

OpenRadar took the AlbionRadar route: passive pcap on UDP 5056, no MITM, no game traffic modification. The runtime is simpler and the threat model is lighter, but live player positions are not available (see `PLAYER_POSITIONS_MITM.md`).

| Concern | DEATHEYE | OpenRadar |
|---|---|---|
| Capture | Photon MITM (Cryptonite) | passive pcap (gopacket, libpcap) |
| Player positions | yes | no (XOR-encrypted, see MITM doc) |
| Player spawn / identity | yes | yes |
| Mobs / resources | yes | yes |
| Harvestables (static) | yes | yes |
| Living harvestables (critters) | yes | yes (post #52, #92) |
| Item database | XML parse | JSON dumps (`web/ao-bin-dumps`) |
| Item power | real values from XML | real values from `itemsDatabase` |
| TypeID resolution | offset 16 | offset 16 (same anchor, see #92) |
| Dungeon enchant source | `Parameters[8]` | `Parameters[8]` |

## Lessons we kept

The ones that proved load-bearing once OpenRadar started shipping fixtures and tests:

1. **TypeID OFFSET=16 is the live anchor.** The radar tried OFFSET=15 for a long time and silently compensated the drift with a `t-1` shift on living non-DYNAMIC critters; that shift exposed itself as a bug on DEAD/DYNAMIC variants. Cross-validation against 6469 pcap NewMob events plus 5889 session-log events confirmed OFFSET=16 with zero outliers. The radar now reads `MobsDatabase.OFFSET = 16` and the tier rule reduces to the database `t` field.
2. **Dungeon enchant lives in `Parameters[8]`.** Not `Parameters[6]`, which is a dungeon type/variant id. The same `Parameters[8]` slot carries Mists portal rarity. Live evidence on a "Peu commun" YELLOW portal (`Parameters[8]=1`) and a T6_MORGANA E2 dungeon (`Parameters[8]=2`) confirmed the slot. This fix unblocked every group dungeon family that had been silently filtered out (Morgana, Keeper, Undead, Royal Solo).
3. **Item power comes from real XML values.** Approximations on item id ranges are not better than nothing: they are misleading. `itemsDatabase` parses the official dumps and exposes `getItemById(id)` with `itempower`, fed back into `PlayersHandler.getAverageItemPower`.
4. **The TypeID namespace for items and mobs is separate.** A live capture can show id 358 as both a quest token (in `items.txt`) and a T1 Hide rabbit (in `MobsInfo.js`); they live in different lookup tables.

## Lessons we did not adopt

- **MITM proxy.** Three to four weeks of work, increased detection risk, no PvE gain.
- **XML parsing in the browser.** OpenRadar uses precomputed JSON minified dumps shipped under `web/ao-bin-dumps`. The build pipeline (`tools/update-ao-data`, `tools/optimize-icons`) turns the XML into the radar-relevant subset.
- **Full mobs.xml import.** OpenRadar maintains `MobsInfo.js` as a runtime-collected database with the exact entries the radar needs. The `tools/` folder regenerates the JSON from upstream when the schema changes.

## Files involved

| File | Source of truth |
|---|---|
| `web/scripts/data/ItemsDatabase.js` | item id, name, tier, enchant, item power |
| `web/scripts/data/MobsDatabase.js` | mob template, harvest type, OFFSET=16 anchor |
| `web/scripts/data/HarvestablesDatabase.js` | static harvestable nodes |
| `web/ao-bin-dumps/*.min.json` | precomputed JSONs |
| `tools/update-ao-data/` | XML to JSON pipeline |

## Reference

DEATHEYE source: `Triky313/AlbionOnline-StatisticsAnalysis`, `pxlbit228/albion-radar-deatheye-2pc`, `ao-data/albiondata-client`. These remain the upstream sources OpenRadar checks against when the protocol drifts.
