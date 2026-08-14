# OpenRadar Documentation

Everything that ships with the repo, and what each file is for.

## Start here

| Document | Purpose |
|---|---|
| [Main README](../README.md) | install, quick start, what the radar detects |
| [DEV_GUIDE.md](./dev/DEV_GUIDE.md) | development setup, build system, testing |
| [TODO.md](./project/TODO.md) | roadmap, open observations, tech debt |

## Technical deep-dives

`docs/technical/` documents how a subsystem works today. Not how it got there: git log is the history.

| Document | Topic |
|---|---|
| [PLAYERS.md](./technical/PLAYERS.md) | player detection, alert gate, ignore list |
| [PLAYER_POSITIONS_MITM.md](./technical/PLAYER_POSITIONS_MITM.md) | why live positions are encrypted, why no MITM |
| [HARVEST_EVENTS.md](./technical/HARVEST_EVENTS.md) | event 40/46/61 logic, living vs static, tier resolution |
| [MISTS_DETECTION.md](./technical/MISTS_DETECTION.md) | portal, feu follet, wisp cage detection |
| [CAPTURE_INTERFACES.md](./technical/CAPTURE_INTERFACES.md) | multi-interface manager, network.json schema, ExitLag behavior |
| [LOGGING.md](./technical/LOGGING.md) | log routing, file naming, pcap recording |
| [PROTOCOL18_OBSERVED_CODES.md](./technical/PROTOCOL18_OBSERVED_CODES.md) | observed event and op codes with counts |
| [PROTOCOL18_PARAM_LAYOUTS.md](./technical/PROTOCOL18_PARAM_LAYOUTS.md) | wire parameter layouts per event code |
| [DEATHEYE_ANALYSIS.md](./technical/DEATHEYE_ANALYSIS.md) | architecture comparison with DEATHEYE, lessons kept |

## Releases

| Version | Notes |
|---|---|
| [v2.2.3](./releases/RELEASE_2.2.3.md) | fresh game data on upgrade, equipment ids, alert gate, ignore list |
| [v2.2.2](./releases/RELEASE_2.2.2.md) | 2026-06-29 patch resync: event codes and mob table |
| [v2.2.1](./releases/RELEASE_2.2.1.md) | Mists threat detection, Knightfall Abbey, sub-zone maps |
| [v2.2.0](./releases/RELEASE_2.2.0.md) | Protocol18 stabilization, Mists, multi-interface, logging coherence |
| [v2.1.0](./releases/RELEASE_2.1.0.md) | memory and performance, Picture-in-Picture, zone-aware alerts |
| [v2.0.0](./releases/RELEASE_2.0.0.md) | Go backend, UI overhaul |

v2.1.1 and the v1.x line have no note in the repo. Their changelogs live on
[Releases](https://github.com/Nouuu/Albion-Online-OpenRadar/releases).
