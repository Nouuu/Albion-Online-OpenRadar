# OpenRadar Documentation

Index of the documentation that ships with the repo.

## Start here

| Document | Purpose |
|---|---|
| [Main README](../README.md) | install, quick start, what the radar does |
| [DEV_GUIDE.md](./dev/DEV_GUIDE.md) | development setup, build system, testing |
| [TODO.md](./project/TODO.md) | roadmap, open observations, tech debt |

## Technical deep-dives

`docs/technical/` documents how subsystems currently work.

| Document | Topic |
|---|---|
| [PLAYERS.md](./technical/PLAYERS.md) | player detection, alert gate, ignore list |
| [PLAYER_POSITIONS_MITM.md](./technical/PLAYER_POSITIONS_MITM.md) | why live positions are encrypted, why no MITM |
| [HARVEST_EVENTS.md](./technical/HARVEST_EVENTS.md) | event 40/46/61 logic, living vs static, tier resolution |
| [MISTS_DETECTION.md](./technical/MISTS_DETECTION.md) | portal, feu follet, wisp cage detection |
| [CAPTURE_INTERFACES.md](./technical/CAPTURE_INTERFACES.md) | multi-interface manager, network.json schema, ExitLag behavior |
| [LOGGING.md](./technical/LOGGING.md) | log routing, file naming, pcap recording |
| [DEATHEYE_ANALYSIS.md](./technical/DEATHEYE_ANALYSIS.md) | architecture comparison with the DEATHEYE project, lessons kept |
| [PROTOCOL18_OBSERVED_CODES.md](./technical/PROTOCOL18_OBSERVED_CODES.md) | observed event and op codes with counts |
| [PROTOCOL18_PARAM_LAYOUTS.md](./technical/PROTOCOL18_PARAM_LAYOUTS.md) | wire parameter layouts per event code |

## Releases

| Version | Notes |
|---|---|
| [v2.2.0](./releases/RELEASE_2.2.0.md) | Protocol18, Mists, multi-interface, logging coherence |
| [v2.0.0](./releases/RELEASE_2.0.0.md) | Go backend, UI overhaul |
