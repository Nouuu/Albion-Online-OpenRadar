# Release 2.1.0, Memory + Performance + Picture-in-Picture

The polish release that ended the v2.0 stabilization tail. Memory leaks hunted down, every frame squeezed, and a native browser Picture-in-Picture mode added so the radar floats above the game without an external overlay.

Closes #17 (initial optimizations) and #20 (Black Zone detection).

## Highlights

### Picture-in-Picture mode (#19)

Native browser PiP using `canvas.captureStream()`. One-click activation from the radar header, always-on-top above fullscreen games, automatic cleanup on page navigation, 30 FPS streaming. No iframe, no external window, no manual frame copying. The PiP overlay is the same 4-layer canvas the radar uses internally, composited and streamed to the PiP element.

### Performance, real-world impact

| Metric | Before | After |
|---|---|---|
| Long session RAM | ~4 GB | ~500 MB stable |
| Navigation memory leaks | growing | stable |
| Max long task | 1781 ms | 282 ms |
| Avg heap size | 1200 MB | 20 MB |
| RAF budget violations | 0.3% | 0.0% |
| Max GC spike | 80.3 ms | 12.4 ms |
| FPS | 30-60 | 162.8 |

The numbers come from a 30-minute session profile: navigate, harvest, fight, swap zones, idle. The leak rate dropped from "the page eats your laptop" to "stable until you close it".

### SPA lifecycle management

`PageController.js` orchestrates page init and destroy callbacks. Every page has an init that wires its handlers and a destroy that clears them. Race-condition guard waits for an ongoing destroy before re-initializing. Net effect: navigate the SPA forever without RAM accumulation.

`WebSocketManager.js` for the connection itself: exponential backoff (1s, 2s, 4s, capped at 30s), graceful disconnect on navigation (no "Connection lost" toast), full listener cleanup on every disconnect.

### Event queue optimization

`WebSocketEventQueue.js` introduces three behaviors:

- **Coalescing** by entity id for events 3 (Move), 6 (HealthUpdate), 91 (RegenerationHealth). Multiple updates for the same entity in the same frame collapse to the latest value.
- **Throttling**: event 6 capped at 50 ms, event 91 at 100 ms.
- **RAF-based flush**: events batched and processed on the next animation frame instead of synchronously.

Hot events on a busy fight could flood the handler chain at 200+ events per second; the queue keeps the handler under control without dropping data.

### Stale entity cleanup

Every detection handler now runs `cleanupStaleEntities(maxAgeMs)` on a timer:

| Handler | Max age | Soft limit |
|---|---|---|
| Players | 5 min | 100 |
| Mobs | 2 min | unlimited |
| Resources | 2 min | unlimited |

Entities that stop updating (player walked off, mob despawned, resource depleted) drop off the radar without a leak. Combined with `lastUpdateTime` enforcement on every entity, this fixes the slow-growth memory pattern of v2.0.

### Event listener leak prevention

93+ cleanup references across 14 files. Every `addEventListener` has a matching `removeEventListener` in a `destroy()` method. Every `setInterval`/`setTimeout` is paired with a `clearInterval`/`clearTimeout`. Every `requestAnimationFrame` handle gets a `cancelAnimationFrame` on tear-down. SPA navigation no longer accumulates orphan listeners.

### ImageCache LRU

| Cache | Max size | Purpose |
|---|---|---|
| Resources | 500 | resource node icons |
| Items | 300 | equipment, consumables |
| Maps | 50 | zone backgrounds |
| Flags | 100 | faction flags |

LRU eviction caps each cache and prevents the unbounded growth that v2.0 had during long sessions.

### Zone-aware alerts (#20)

`ZonesDatabase.js` resolves a zone id to its PvP type: `safe`, `yellow`, `red`, `black`. Threat alerts use this type:

- Safe zones: no alerts.
- Yellow / Red: alert when a player is faction 255 (hostile flag).
- Black: every other player is a threat regardless of faction.

The radar UI surfaces the type with a colored indicator (skull, swords, diamond, shield) and the zone name plus tier. Out goes the silent confusion of "why did the alarm go off in town", in goes "the radar knows where you are".

### Bug fixes inside the same PR

- **Faction detection**: read `Parameters[53]` instead of `Parameters[11]`. Players were silently misclassified for months.
- **City zone alert suppression**: no more sound or flash in town.
- **Black Zone player detection**: every player triggers correctly.
- **Overlay local player**: blue dot finally renders in overlay mode.
- **Resource type detection**: living resources no longer show as the wrong type.

### Logger batching

2-second flush interval, max 500-entry buffer, graceful shutdown with a final flush. The previous synchronous-write path was a hot-path stall during fights.

### CDN-free frontend

Lucide icons, HTMX, and Google Fonts moved from CDN to local. JetBrains Mono (400, 500) and Space Grotesk (400, 500, 700) ship as `woff2` files. The radar runs without internet once Albion is connected.

### Smaller binary

| Asset | Before | After |
|---|---|---|
| Game data | 130 MB | 2.3 MB |
| Maps | 50 MB | ~25 MB |
| Item icons | 27 MB | ~17 MB |

The 84 MB localization file is gone. Minified JSONs keep only what the radar needs. Total embedded data dropped from ~210 MB to ~45 MB.

## New components

| Component | Purpose |
|---|---|
| `PageController.js` | SPA lifecycle orchestrator |
| `WebSocketManager.js` | robust WS with backoff and cleanup |
| `PictureInPictureManager.js` | native PiP |
| `ZonesDatabase.js` | zone-PvP type lookup |
| `WebSocketEventQueue.js` | coalescing + throttling + RAF flush |

## Player detection summary

| Type | Color | Alert |
|---|---|---|
| Passive | green `#00ff88` | no |
| Faction (1-6) | orange `#ffa500` | no |
| Hostile (255) | red `#ff0000` | flash + sound |

## Verification

- Windows long-session test (30+ minutes): RAM stable around 500 MB.
- Navigation stress test (rapid SPA swaps): no listener accumulation.
- Canvas with hundreds of entities: no frame drop, no RAM growth.
- Picture-in-Picture: enable, navigate, return, PiP cleanly torn down and re-enabled.
- WebSocket: drop the server, watch reconnect with exponential backoff.

## Known limitations carried into v2.2

- Player live positions stay encrypted (XOR + AES). Out of scope without a Photon MITM proxy.
- Some Black Zone map tiles missing for zone IDs 4000+.
- Detection refactor only complete for Resources, Mobs, Players, Zones; Dungeons, Chests, Mists, Fishing remain partial.
