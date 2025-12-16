# Harvest Events - Technical Reference

## Current Implementation

Event 46 (HarvestableChangeState) is the source of truth for resource size changes.

### Event Handling

| Event | Code | Purpose |
|-------|------|---------|
| HarvestableChangeState | 46 | Size updates (decrement/regeneration) |
| HarvestFinished | 61 | Notification only (no action) |
| NewHarvestableObject | 40/59 | Resource spawn |

### Event 46 Logic

```javascript
HarvestUpdateEvent(Parameters) {
    const id = Parameters[0];
    const newSize = Parameters[1];

    // undefined = resource depleted
    if (newSize === undefined) {
        this.removeHarvestable(id);
        return;
    }

    // Accept ALL size changes (decrement AND regeneration)
    if (newSize !== harvestable.size) {
        harvestable.size = newSize;
    }
}
```

---

## Known Issue

Event 46 can be unreliable:
- Sometimes skips values (3 -> 1, missing 2)
- Sometimes doesn't decrement on first harvest
- Sometimes decrements by 2 at once

**Possible causes:**
- Event timing (batching, network latency)
- Packet loss
- Server doesn't always send Event 46 for each harvest

**Workaround:**
- `newSize === undefined` guarantees resource removal when depleted

---

## Pending Investigation

### Event 61 param[8] as backup

**Observation:** Event 46 can skip values (3->1 without hitting 2)

**Discovery:** Event 61 param[8] contains the correct remaining size

**Proposed test:**
```javascript
harvestFinished(Parameters) {
    const id = Parameters[3];
    const remainingSize = Parameters[8];

    const harvestable = this.harvestableList.find(h => h.id === id);
    if (!harvestable) return;

    // Correct size if Event 46 missed an update
    if (remainingSize !== undefined && remainingSize !== harvestable.size) {
        harvestable.size = remainingSize;
    }
}
```

---

## Resource Type Detection

### Living vs Static Resources

| mobileTypeId | Type | Description |
|--------------|------|-------------|
| `null` | STATIC | Event 38 batch spawn |
| `65535` | STATIC | Enchanted resource node |
| Real TypeID | LIVING | Creature (animal) |

### Type Resolution for Living Resources

The server's `typeNumber` is incorrect for living resources. Use `MobsDatabase.getResourceInfo(mobileTypeId)` to get the correct type.

```javascript
if (isLiving && window.mobsDatabase?.isLoaded) {
    const resourceInfo = window.mobsDatabase.getResourceInfo(mobileTypeId);
    stringType = resourceInfo?.type || this.GetStringType(type);
}
```

**Example:** A Fiber creature (mobileTypeId=530) sends `type:16` (Hide range) but should display as Fiber.

---

## Event Flow

```
[Albion Server]
    |
    | UDP 5056 (Photon)
    v
[Go Backend - pcap capture]
    |
    | WebSocket batch (16ms)
    v
[WebSocketEventQueue.js]
    |
    | parseMessage() -> immediate processing
    v
[HarvestablesHandler]
    |
    | Event 40/59: addHarvestable()
    | Event 46: HarvestUpdateEvent()
    | Event 61: harvestFinished() (log only)
    v
[harvestableList state]
    |
    v
[HarvestablesDrawing.invalidate()]
```

---

## Files

| File | Purpose |
|------|---------|
| `web/scripts/Handlers/HarvestablesHandler.js` | Event handling, state management |
| `web/scripts/Drawings/HarvestablesDrawing.js` | Canvas rendering |
| `web/scripts/Data/MobsDatabase.js` | Resource type lookup |