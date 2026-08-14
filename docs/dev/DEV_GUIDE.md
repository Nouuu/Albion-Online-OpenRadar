# OpenRadar Development Guide

Technical reference for contributors working on OpenRadar's Go backend and JavaScript frontend.

*Last verified against code: 2026-08-14.*

## Architecture overview

OpenRadar is a single-binary Go application that:

- Captures Albion Online network packets (UDP 5056) via `gopacket` and libpcap, on one or more interfaces simultaneously.
- Parses Photon Protocol18 packets into events, requests, and responses.
- Sends parsed data to the browser via a WebSocket on `/ws`.
- Serves a static SPA from embedded assets (`//go:embed`).

### Project structure

```
OpenRadar/
├── cmd/radar/                # Entry point, App struct, TUI dashboard wiring
├── internal/
│   ├── capture/              # Multi-interface manager + libpcap workers
│   ├── photon/               # Protocol18 deserializer, event codes, fixtures
│   ├── photonscan/           # Shared decode walk used by the pcap tools
│   ├── server/               # HTTP routes, WebSocket handler, settings APIs
│   ├── templates/            # Go templates + HTMX pages (embedded)
│   ├── ui/                   # Bubble Tea TUI dashboard
│   └── logger/               # JSONL structured logging
├── web/                      # Frontend (embedded at build)
│   ├── scripts/              # JavaScript modules (core, handlers, drawings, utils)
│   ├── styles/               # Tailwind + DaisyUI sources, fonts
│   ├── images/               # Maps, item and spell icons
│   ├── sounds/               # Alert audio
│   └── ao-bin-dumps/         # Game data, minified
├── tools/                    # Go tools (pcap, code generation) + TS asset scripts
├── embed_prod.go             # //go:embed directives (production)
├── embed_dev.go              # os.DirFS equivalents, build tag `dev`
└── Makefile
```

## Getting started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Go | 1.26+ | go.mod pins `go 1.26` |
| Npcap | 1.87+ | Windows packet capture |
| libpcap | latest | Linux: `apt install libpcap-dev` |
| Node.js | 20+ | tools and Vitest |
| Docker | latest | Linux cross-compile |

### Quick setup

```bash
git clone https://github.com/Nouuu/Albion-Online-OpenRadar.git
cd Albion-Online-OpenRadar

make install-tools   # air, golangci-lint, git-cliff
make assets          # CSS, vendors, gzip embeds
make dev             # hot-reload via air
```

Open `http://localhost:5001` in a browser. Launch Albion. Events should start flowing.

### LAN access

The radar is reachable from any device on the same LAN. The startup banner prints both URLs:

```
HTTP   Server: http://localhost:5001
HTTP   Server: http://192.168.1.42:5001  (LAN)
WS     WebSocket: ws://localhost:5001/ws
```

The frontend builds the WebSocket URL from `window.location`, so a phone or second laptop loading `http://<server-ip>:5001` gets a working radar without configuration. The capture interface settings UI is loopback-only: `POST /api/network/interfaces` returns 403 if `req.RemoteAddr` is not local. A LAN visitor sees a read-only view.

## Build system

### Makefile targets

Common targets:

| Target | Purpose |
|---|---|
| `make dev` | hot-reload via air |
| `make run` | run without hot-reload |
| `make test` | Go tests + Vitest |
| `make lint` | golangci-lint v2 + ESLint |
| `make lint-fix` | lint and auto-fix |
| `make assets` | install deps, build CSS, copy vendors, gzip embeds |
| `make restore-assets` | restore `web/ao-bin-dumps/*.json` from git, remove `*.gz` |
| `make update-ao-data` | refresh game data from upstream |
| `make refresh-assets` | refresh ao-data, icons, spells, map |
| `make gen-codes` | regenerate Go event/op code mirrors from current JS |
| `make refresh-codes` | fetch upstream, regenerate JS and Go mirrors |
| `make build-linux` | Linux binary via Docker |
| `make build-windows` | Windows `.exe` |
| `make all-in-one` | full release artifacts (both binaries, READMEs, checksums) |
| `make release-dry-run` | full build plus generated `RELEASE.md` for review |
| `make release` | create a draft GitHub release (requires `TAG=x.y.z`) |
| `make clean` | remove build artifacts |

### Asset embedding

`embed_prod.go` (package `assets`) wires the frontend into the Go binary:

```go
//go:embed all:web/images
var Images embed.FS

// Scripts omits `all:` so Go embed skips _*.test.js and __fixtures__/.
//go:embed web/scripts
var Scripts embed.FS

//go:embed all:web/ao-bin-dumps
var Data embed.FS

//go:embed all:web/sounds
var Sounds embed.FS

//go:embed all:web/styles
var Styles embed.FS

//go:embed all:internal/templates
var Templates embed.FS
```

`embed_dev.go` carries the `dev` build tag and reads the same trees from disk, which is what `-dev` mode serves. The
missing `all:` on `Scripts` is load-bearing: Go embed's default rule drops `_`-prefixed paths, which is why every test
file is named `_<name>.test.js`. A CI guard in `.github/workflows/ci.yml` rejects unprefixed `*.test.js`, and
`embed_prod_test.go` walks the embed FS to confirm nothing leaked.

`web/styles/tailwind.css` is generated, not committed. `make assets` builds it before any release build.

### Linux capability

Packet capture without root needs:

```bash
sudo setcap cap_net_raw,cap_net_admin=eip ./OpenRadar-linux
```

## Backend internals

### Entry point (`cmd/radar/main.go`)

`App` centralizes the runtime: logger, HTTP server, WebSocket handler, capture manager, TUI dashboard. Boot flow:

1. Parse CLI flags (`-dev`, `-ip`, `-version`).
2. `capture.ReadConfig(appDir)` loads `network.json`. Migration from the legacy `ip.txt` runs once if present.
3. `logger.New(logsDir, cfg.Logging.ServerLogsEnabled)` so the first events route correctly without waiting for the frontend.
4. `capture.NewManager(ctx)` plus `manager.Reconfigure(target)` to open every selected interface.
5. If `cfg.Logging.PcapRecording`, `manager.StartRecording(filepath.Join(logsDir, "captures"))`.
6. HTTP server starts; WebSocket handler attaches.
7. TUI dashboard renders the live state.
8. Wait for SIGINT/SIGTERM. Graceful shutdown drains the wait group, closes handles after.

### Multi-interface capture (`internal/capture/`)

The manager owns an active capturer set keyed by interface name. `Reconfigure` adds and removes capturers in a single critical section, additions before removals so the radar never loses every handle during a swap. See `docs/technical/CAPTURE_INTERFACES.md` for the architecture, categorization rules, and ExitLag NDIS LWF behavior.

### Photon parser (`internal/photon/`)

| File | Purpose |
|---|---|
| `deserializer.go` | Protocol18 entry point |
| `packet.go` | Photon packet header |
| `events.go` | event, request, response post-processing |
| `readers.go` | binary readers with position tracking |
| `types.go`, `typecodes.go` | Protocol type constants and structs |
| `eventcodes/` | Go mirror of `web/scripts/utils/EventCodes.js` (generated) |
| `operationcodes/` | Go mirror of `web/scripts/utils/OperationCodes.js` (generated) |

Event codes are JS-authored and Go-generated. Refresh flow:

1. Fetch upstream raw URLs (never trust vendored copies).
2. Update `web/scripts/utils/EventCodes.js` and `OperationCodes.js`.
3. `make refresh-codes` regenerates the Go packages.
4. `make test` to catch dispatch regressions.

### HTTP server (`internal/server/http.go`)

Single server on port 5001 handling both HTTP and WebSocket:

| Route | Purpose |
|---|---|
| `/`, `/home`, `/players`, `/resources`, `/enemies`, `/chests`, `/ignorelist`, `/settings` | SPA pages (Go templates) |
| `/ws` | WebSocket upgrade |
| `/images/`, `/sounds/` | static assets |
| `/scripts/`, `/styles/`, `/ao-bin-dumps/` | static assets with gzip variants |
| `/api/network/interfaces`, `/api/network/state`, `/api/network/refresh` | capture interface management |
| `/api/settings/logging` | logging and pcap toggles |

`/images/Items/` and `/images/Spells/` fall back to `_default.webp` on a miss, so an unknown item id renders a
placeholder instead of a broken image.

Production mode embeds assets; `-dev` mode reads from disk for hot iteration.

### Caching contract

`embed.FS` reports a zero modtime, so there is no `Last-Modified` to revalidate against. Duration caching therefore
served the previous release's data at the same URL after every upgrade (#146). The rule since #147:

| Response | Headers |
|---|---|
| static assets | `Cache-Control: no-cache` plus a build-scoped `ETag` (`version-buildTime`, distinct `-gz` variant), 304 via `http.ServeContent` |
| HTML pages | `Cache-Control: no-cache`, `Vary: Hx-Request` |
| `/api/**` | `Cache-Control: no-store` |

The ETag is empty when the build carries no version, which is the case for a bare `go build`. Use the Makefile targets
(they pass `-ldflags -X main.Version=...`) when testing anything cache-related.

### WebSocket (`internal/server/websocket.go`)

Two-phase broadcast (RLock for send, Lock for cleanup), 100 client soft limit, graceful close on shutdown. Messages carry the dispatched code and the parameters object as JSON.

## Frontend internals

### SPA navigation

HTMX swaps page partials without full reloads. `PageController.registerPage(name, {init, destroy})` orchestrates init/destroy cycles. Every handler installs listeners via `addListener(el, evt, fn)` and removes them on `destroy()` to prevent the listener leaks that bit the Jan 2026 churn.

### WebSocket client

`web/scripts/core/WebSocketManager.js` opens the connection. URL is built from `window.location`:

```js
const wsScheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsScheme}//${location.host}/ws`;
```

This is what makes LAN access work without configuration. `WebSocketEventQueue.js` parses, coalesces hot events (Move 3, HealthUpdate 6, RegenerationHealth 91), and flushes on requestAnimationFrame.

`EventRouter.js` dispatches each event on `Parameters[252]` to the matching handler. Operations dispatch on `Parameters[253]`.

### Handlers and drawings

Every handler stores entities in an Array accessed via `.find()`, never a Map. Every entity holds `lastUpdateTime`. Every handler has a `cleanupStaleEntities(maxAgeMs)`.

Handler skeleton:

```js
class XHandler {
    constructor() { this.entityList = []; }
    addEntity(id, ...) {
        if (this.entityList.find(e => e.id === id)) return;
        this.entityList.push(new Entity(id, ...));
    }
    cleanupStaleEntities(maxAgeMs = 120000) {
        const now = Date.now();
        this.entityList = this.entityList.filter(e => (now - e.lastUpdateTime) < maxAgeMs);
    }
}
```

Drawing skeleton: extends `DrawingUtils`. `interpolate(entities, lpX, lpY, t)` calls `interpolateEntity` per entry. `invalidate(ctx, entities)` reads settings via `settingsSync.getBool(...)` and draws via inherited `DrawCustomImage`, `drawFilledCircle`, `transformPoint`.

Page registration: in the page gohtml `<script>`, import `registerPage` and `reinitCurrentPage` from `PageController`. Guard the registration with a `window._<name>Registered` flag to avoid double-register on SPA navigation. Call `window.onGlobalsReady(() => reinitCurrentPage())`.

Imports:

| What | Pattern |
|---|---|
| Singleton (`settingsSync`, `imageCache`) | `import settingsSync from './utils/SettingsSync.js'` (default) |
| Class (`DrawingUtils`, `CATEGORIES`) | `import {DrawingUtils} from './utils/DrawingUtils.js'` (named) |
| Logger | global `window.logger?.debug(CATEGORIES.X, 'event', {data})` |
| Database | global `window.itemsDatabase`, `window.mobsDatabase`, `window.harvestablesDatabase` |

Files by feature:

| Feature | Handler | Drawing |
|---|---|---|
| Players | `PlayersHandler.js` | `PlayersDrawing.js` |
| Mobs / living | `MobsHandler.js` | `MobsDrawing.js` |
| Static resources | `HarvestablesHandler.js` | `HarvestablesDrawing.js` |
| Chests | `ChestsHandler.js` | `ChestsDrawing.js` |
| Dungeons | `DungeonsHandler.js` | `DungeonsDrawing.js` |
| Fishing | `FishingHandler.js` | `FishingDrawing.js` |
| Wisp cages | `WispCageHandler.js` | `WispCageDrawing.js` |
| Mists feu follets | `MobsHandler.mistList` (shared) | `MistsWispDrawing.js` |
| Network settings | `NetworkSettingsHandler.js` | (no drawing) |

Canvas layers (`CanvasManager.js`): `mapCanvas` (background), `drawCanvas` (entities), `ourPlayerCanvas` (static blue dot), `uiCanvas` (zone, stats, threat border). Layer order is bottom to top.

### Settings persistence

`localStorage` is the runtime store. The backend is the persisted source of truth for the network and logging settings:

- `GET /api/network/state` populates the capture interface checkboxes on settings page load.
- `GET /api/settings/logging` populates the logging and pcap recording checkboxes.
- `POST` to either endpoint writes `network.json` atomically via `capture.MutateConfig` and applies the runtime change.

## Testing

### Go tests

```bash
go test ./...
go test -race ./...
```

Real Photon payloads live in `internal/photon/testdata/` as small `.pcap` fragments. Tests read them via `gopacket` at test time and assert on decoded events.

Capture procedure for new fixtures:

1. `tcpdump -i <iface> -w capture.pcap 'udp port 5056'` during a live session.
2. Anonymize via `tools/anonymize-pcap` (scrubs MAC, IP, timestamps). It decodes the capture and removes the parameters known to carry a nickname, a guild name, an alliance tag, an account identifier or a machine model, so every name in the capture goes, not only your own. Add `--scrub-string` for anything the field table does not cover, or `--no-scrub` to keep the payloads as they are. Flags come before the two paths. The run prints a replacement count per value, and a zero means the value was never found.
3. Audit the result with `tools/photon-strings`, which lists every string the capture carries grouped by message kind, Albion code and parameter index. A name still readable there means the field table needs a new entry.
4. Extract per-scenario fragments via `tools/photon-dump` (outputs both pcap fragments and WS-level JSON fixtures matching EventRouter dispatch format).
5. Commit the small anonymized fragment.

### Frontend tests

Vitest 4.x with happy-dom 20.x (NOT jsdom). Tests are co-located next to source as `_<name>.test.js`. The underscore prefix is mandatory: `embed_prod.go` uses `//go:embed web/scripts` (without `all:`) so Go embed's default rule excludes `_*.test.js` from the production binary.

```bash
npm test
npm run test:watch
npm run test:coverage
```

Fixtures: `web/scripts/__fixtures__/ws/<handler>/<scenario>.json`, derived from real Photon captures via `tools/photon-dump`. Synthetic fixtures are allowed for scenarios not observable in the corpus (stale cleanup with `Date.now()` offset, settings injection).

Real game data must back every test that touches the database layer. Load it via `web/scripts/__fixtures__/realDatabases.js` (`installRealDatabasesOnWindow()`). Mocked database answers hide the class of bugs where the mock lies in sync with a wrong assertion.

### End-to-end

None yet. An end-to-end suite that boots the binary and drives the browser is on the roadmap, not in the repo. Until it
lands, SPA lifecycle regressions are caught by the handler and renderer unit tests plus a manual pass.

## Common tasks

### Add a new event handler

1. Confirm the event code in upstream `EventCodes.cs`. Update `web/scripts/utils/EventCodes.js` if needed, run `make refresh-codes`.
2. Write the failing test using a pcap-derived fixture under `web/scripts/__fixtures__/ws/<handler>/`.
3. Implement the handler in `web/scripts/handlers/<X>Handler.js` following the skeleton above.
4. Add a case in `web/scripts/core/EventRouter.js` `onEvent`.
5. Implement the drawing in `web/scripts/drawings/<X>Drawing.js`.
6. Wire into `Utils.js` startup if the handler exposes a global.

### Update game data

```bash
make update-ao-data       # JSON dumps from upstream
make download-icons       # item icons
make download-spells      # spell icons
make download-map         # world map tiles
make refresh-assets       # all of the above
```

### Add a new HTTP API

In `internal/server/http.go` (or a sibling `*_api.go` file):

```go
mux.HandleFunc("GET /api/my-endpoint", s.handleMyEndpoint)
```

Use the Go 1.22+ method-pattern routing. Place the handler in a dedicated `<feature>_api.go` file when the surface goes beyond a single endpoint.

## Troubleshooting

### "No network interfaces found"

- Windows: install Npcap from https://npcap.com.
- Linux: install `libpcap-dev`.

### "Permission denied" (Linux)

```bash
sudo setcap cap_net_raw,cap_net_admin=eip ./OpenRadar-linux
```

Or run with `sudo` (not recommended).

### Hot-reload not working

```bash
go install github.com/air-verse/air@latest
```

`make install-tools` covers air, golangci-lint, and git-cliff.

### Live test shows no change after editing JS

Go embed serves the JS that was present at the last `go build`. Either run with `-dev` (reads from disk) or rebuild the binary.

### Phone on LAN cannot reach the radar

- Confirm Albion firewall rules allow inbound 5001 on the host.
- Check the LAN URL printed by the startup banner; if `(LAN)` is missing, the adapter IP is not RFC1918 or not on a `wifi`/`ethernet` interface.
- WebSocket URL is built from `window.location`, so a misrouted DNS or proxy can produce the symptom.

## Performance notes

Three mechanisms keep a long session from degrading:

- `ImageCache` evicts least-recently-used entries per cache once `MAX_ITEMS` is passed.
- `WebSocketEventQueue` coalesces the hot events (Move 3, HealthUpdate 6, RegenerationHealth 91) and flushes on
  `requestAnimationFrame`, so a burst cannot outrun the render loop.
- Every handler drops its listeners in `destroy()`, which is what stops the SPA leak class.

Binary size, measured on 2026-08-14 with `-ldflags "-s -w"`: 12 MB of code, 61 MB shipped once assets are embedded.
Images dominate the difference.
