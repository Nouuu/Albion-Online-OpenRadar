# Protocol18 Event Parameter Layouts (observed)

Status: snapshot from a single live capture (T5 zone + harvest + zone transit,
~130s, 3020 packets, 4954 events decoded), taken before the 2026-06-29 patch.
Parameter shapes below still hold. The event codes do not: that patch inserted
two entries in the upstream enum, shifting every code at or above 248 by +2.
Codes under 248, which is all of the ones listed here, were untouched.

Use as a baseline for regression tests and frontend compatibility checks.
Expect shifts when Albion patches gameplay payload layouts.

*Last verified against code: 2026-08-14.*

## Convention

- **Dispatch byte** (`EventData.Code`): the 1-byte event selector read from the
  wire. Under Protocol18 Albion only uses two dispatch bytes: `3` (Move, hot
  path) and `1` (generic, real code in `params[252]`).
- **Real code** (`params[252]` as `int16`): the authoritative Albion event ID.
  74 distinct codes observed in this capture.
- **Frontend truth**: `EventRouter.onEvent` routes on `params[252]`. Backend
  logs follow the same convention (`cmd/radar/main.go:onPhotonEvent`).

## Dispatch byte 3: Move

```
params[  0] int64            entity id
params[  1] ByteArray        raw 30-byte (mode=3) or 22-byte (mode=4) blob
params[  4] float32          posX, injected by PostProcessEvent (offset 9 of params[1])
params[  5] float32          posY, injected by PostProcessEvent (offset 13 of params[1])
params[252] byte(3)          fallback-injected by PostProcessEvent (server omits)
```

**Notes:**
- Mobs/resources: `params[1][0] == 3`, positions at offsets 9/13 are unencrypted.
- Players: `params[1][0] == 3` too, but positions at offsets 9/13 are XOR-encrypted
  with the KeySync `XorCode`, unreadable without MITM (see `PLAYER_POSITIONS_MITM.md`).
- Mode 4 (22-byte) never has positions; the `len(raw) < 17` guard handles it.

## Dispatch byte 1: Generic (real code in `params[252]`)

Representative layouts observed:

| Real code | Purpose (guess from context) | Notable params |
|-----------|------------------------------|----------------|
| 1         | Leave                        | `params[0]` int64 entity id only |
| 6         | HealthUpdate (single)        | `params[2..3]` float32 HP, `params[6]` int64 attacker |
| 8         | HealthUpdate (alt)           | `params[2..3]` float32, similar shape |
| 11        | HealthUpdates (bulk)         | `params[1..10]` mixed arrays + ByteArrays |
| 14        | ?                            | `params[2]` `[]float32`, `params[8..9]` uint8 (flags) |
| 19        | ?                            | `params[2]` `[]float32`, `params[7]` int16 |
| 22        | ?                            | `params[1]` `[]int32`, `params[3..4]` ByteArray |
| 29        | NewCharacter (player spawn)  | `params[1]` string (name), `params[5..7,16,17]` ByteArray, `params[19..37]` float32 stats |
| 30        | ?                            | `params[5]` string, `params[8]` ByteArray, `params[9]` `[]int16`/ByteArray |
| 39        | NewSimpleHarvestableObjectList | `params[0]` `[]int16` batch ids, `params[3]` `[]float32` batch positions |
| 40        | NewHarvestableObject         | `params[5]` typeNumber, `params[6]` mobileTypeId, `params[7]` tier, `params[8]` **`[]float32`** packed X/Y, `params[10]` size, `params[11]` enchant |
| 91        | ?                            | `params[2..3,5]` float32, `params[6]` int64 |

**Frontend layout note (real code 40):**

`HarvestablesHandler.newHarvestableObject` reads the position from
`Parameters[8]` as a `[]float32` of length 2 (packed X and Y), not as scalars.
`MobsHandler` does the same on its own spawn event. Upstream
`ao-data/albiondata-client` and `Triky313/AlbionOnline-StatisticsAnalysis`
decode the same wire shape.

Mobs and living resources do not arrive on code 40. They arrive on `NewMob`,
currently code 123. See `HARVEST_EVENTS.md`.

## Gaps in this snapshot

- No combat events (Cast*, Damage*): single idle plus harvest scenario.
- No JoinResponse (zone transit happened once; only real code 0 response
  observed, 1 sample). Covered by `move_map_change.pcap` (see below).
- Only 2 fragments in the capture; fragment reassembly is exercised in
  `TestPhotonParser_Fragment_*` unit tests instead.
- `msg_type 132` (53 occurrences) and `130` (3) silently dropped, not event
  / request / response. Proximity to `msgEncrypted=131` suggests encrypted
  variants. Worth investigating when more captures arrive.

## Router-contract fixture: `move_map_change.pcap`

A 584-packet capture exercising the three operation codes the frontend
router dispatches on. Under Protocol18 the wire `OperationCode` byte is
always 1; the real code lives in `Parameters[253]` as `int16`. These are
the counts observed across the fixture:

| Kind     | Real code | Name            | Count | Key params                                   |
|----------|-----------|-----------------|-------|----------------------------------------------|
| request  | 22        | Move            | 79    | `[0]` int64 entity id, `[1]` `[]float32` src pos (len 2), `[3]` `[]float32` tgt pos |
| response | 2         | JoinFinished    | 2     | `[8]` string mapId, `[9]` `[]float32` local player pos |
| response | 41        | ChangeCluster   | 1     | `[0]` string new mapId                       |

`TestLivePcap_RouterContract` in `internal/photon/live_pcap_test.go` pins
these as minimum expectations. Drop new router-visible codes into the
`cases` table there; add new fixtures with `tools/anonymize-pcap` before
committing.

## How to regenerate this document

Feed a new pcap through the analyzer pattern documented in the PR description
for issue #49. Compare the resulting layout table with this snapshot to detect
protocol drift across patches.
