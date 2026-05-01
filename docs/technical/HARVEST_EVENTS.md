# Harvest events

How OpenRadar processes harvestable resource lifecycle events and resolves the tier displayed on the radar.

*Last verified against code: 2026-05-01.*

## Event handling

Harvestables emit three event codes during their lifetime.

| Event | Code | Purpose |
|---|---|---|
| `NewHarvestableObject` | 40 / 59 | Resource spawn (single, batch). |
| `HarvestableChangeState` | 46 | Size update (decrement, regeneration, depletion). |
| `HarvestFinished` | 61 | End-of-harvest notification. Logged only. |

Events 46, 59, 61 are explicitly excluded from the WebSocketEventQueue coalescing list. Coalescing harvest events would lose intermediate size states.

## Event 46 logic

Event 46 is the source of truth for resource size changes:

```javascript
HarvestUpdateEvent(Parameters) {
    const id = Parameters[0];
    const newSize = Parameters[1];

    if (newSize === undefined) {
        this.removeHarvestable(id);
        return;
    }

    if (newSize !== harvestable.size) {
        harvestable.size = newSize;
    }
}
```

Both decrement (harvest) and increment (regeneration) cases pass through the same path. The `undefined` branch removes the resource from the radar when the server signals depletion.

### Known unreliability

Event 46 occasionally skips values (size 3 -> 1, missing 2), fails to fire on the first harvest, or decrements by more than one at once. Likely causes are batching, network latency, or server-side aggregation. The `undefined === depleted` check guarantees removal even when intermediate updates are lost.

## Living vs static resources

`mobileTypeId` is the source of truth for the living/static split. The legacy `size` heuristic was unreliable.

| `mobileTypeId` | Type | Source |
|---|---|---|
| `null` | STATIC | event 38 batch spawn |
| `65535` | STATIC | enchanted resource node |
| pure-static sentinels (`-1`, others) | STATIC | event 40/59 spawn |
| real TypeID | LIVING | creature (animal, critter) |

`HarvestablesDrawing.invalidate` consults `shouldRenderStaticResource` when `mobileTypeId` is a pure-static sentinel and `shouldRenderLivingResource` otherwise. `MobsDrawing.invalidate` always consults `shouldRenderLivingResource` for `LivingHarvestable` and `LivingSkinnable` entries. Both helpers live in `web/scripts/utils/LivingResourceFilter.js` via shared `resolveSettingsCell`.

The spawn-time filter that previously dropped living resources at handler level was removed (see HARV-2/HARV-4 history). Filtering now happens per-frame at the drawing layer.

## Resource type resolution for living resources

The server's `typeNumber` carried in the event is incorrect for living resources. Use `MobsDatabase.getResourceInfo(mobileTypeId)` to resolve the displayed type:

```javascript
if (isLiving && window.mobsDatabase?.isLoaded) {
    const resourceInfo = window.mobsDatabase.getResourceInfo(mobileTypeId);
    stringType = resourceInfo?.type || this.GetStringType(type);
}
```

Example: a Fiber creature with `mobileTypeId=530` arrives as `type=16` (Hide range) on the wire but renders as Fiber on the radar.

## Living resource tier resolution

The tier displayed on the radar for a living resource (Fiber critter, Hide mob, Wood/Rock/Ore critter) must match the tier shown by the in-game tooltip. That tooltip equals the tier of the resource looted once the mob dies. Both values are exposed on the wire as `event 40 Parameters[7]` for harvestable spawns.

The combat tier stored in `mobs.json` upstream (`@tier`) is **not** the harvest tier. `@tier` is HP, damage, fame, combat difficulty. The harvest tier the game shows on a living mob is derived from the combat tier and the loot type. Cross-validation against 6469 pcap NewMob events plus 5889 session-log events confirmed the OFFSET=16 assumption that backs the type resolution; the previous `t-1` shift was a compensation for OFFSET=15 drift and was removed.

The resolution rule is implemented in `web/scripts/utils/LivingResourceTier.js` as a pure function:

```
harvest_tier(mob) = mob.t                          // null mob or mob.t fallback
```

In the current build (post PR #92), `getLivingHarvestTier` reduces to `mob?.t ?? 0`. The earlier `max(min_tier(loot_type), combat_tier - 1)` rule was retired once OFFSET=16 cleared the drift. The pure function and its tests stay in place to make a future shift trivial to add back if a new game revision reintroduces the divergence.

`MobsHandler.AddEnemy` calls `getLivingHarvestTier(dbInfo)` before storing `mob.tier`. `HarvestablesHandler` reads `Parameters[7]` directly when present, no rule needed.

## Event flow

```
Albion server
    | UDP 5056 (Photon)
    v
internal/capture (gopacket, pcap)
    | WebSocket batch (16 ms)
    v
WebSocketManager.js -> WebSocketEventQueue.js
    | parseMessage -> EventRouter.onEvent
    v
HarvestablesHandler / MobsHandler
    | event 40/59  -> addHarvestable / AddEnemy
    | event 46     -> HarvestUpdateEvent (size change or removal)
    | event 61     -> harvestFinished (log only)
    v
harvestableList / mobsList state
    v
HarvestablesDrawing.invalidate / MobsDrawing.invalidate
    | per-frame settings gate via LivingResourceFilter
    v
Canvas (drawCanvas layer)
```

## Files

| File | Purpose |
|---|---|
| `web/scripts/handlers/HarvestablesHandler.js` | event 40/46/59/61 handling, state |
| `web/scripts/handlers/MobsHandler.js` | living resource handling via NewMob (event 123) |
| `web/scripts/drawings/HarvestablesDrawing.js` | static resource rendering |
| `web/scripts/drawings/MobsDrawing.js` | living resource and mob rendering |
| `web/scripts/utils/LivingResourceFilter.js` | per-frame settings gate (static + living) |
| `web/scripts/utils/LivingResourceTier.js` | tier resolution pure function |
| `web/scripts/data/MobsDatabase.js` | resource type lookup, `getResourceInfo(mobileTypeId)` |
