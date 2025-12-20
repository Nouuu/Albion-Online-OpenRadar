// EventRouter.js - WebSocket event routing to handlers
// Extracted from Utils.js during Phase 1B refactor

import {EventCodes} from '../utils/EventCodes.js';
import {CATEGORIES} from '../constants/LoggerConstants.js';

// Map change debouncing
const MAP_CHANGE_DEBOUNCE_MS = 4000;
let lastMapChangeTime = 0;

// Local player position (relative coords)
let lpX = 0.0;
let lpY = 0.0;

// Expose globally for debug access
window.lpX = lpX;
window.lpY = lpY;

// Dependency references (set via init)
let handlers = null;
let map = null;
let radarRenderer = null;

// Helper: Update local player position (DRY pattern)
function updateLocalPlayerPosition(x, y) {
    lpX = x;
    lpY = y;
    window.lpX = lpX;
    window.lpY = lpY;
    handlers?.playersHandler?.updateLocalPlayerPosition(lpX, lpY);
    radarRenderer?.setLocalPlayerPosition?.(lpX, lpY);
}

// Helper function to get event name (for debugging)
function getEventName(eventCode) {
    const eventNames = {
        1: 'Leave',
        2: 'JoinFinished',
        3: 'Move',
        4: 'Teleport',
        5: 'ChangeEquipment',
        6: 'HealthUpdate',
        7: 'HealthUpdates',
        15: 'Damage',
        21: 'Request_Move',
        29: 'NewCharacter',
        35: 'ClusterChange',
        38: 'NewSimpleHarvestableObject',
        39: 'NewSimpleHarvestableObjectList',
        40: 'NewHarvestableObject',
        46: 'HarvestableChangeState',
        71: 'NewMob',
        72: 'MobChangeState',
        91: 'RegenerationHealthChanged',
        101: 'NewHarvestableObject',
        102: 'NewSimpleHarvestableObjectList',
        103: 'HarvestStart',
        104: 'HarvestCancel',
        105: 'HarvestFinished',
        137: 'GetCharacterStats',
        201: 'NewSimpleItem',
        202: 'NewEquipmentItem',
    };
    return eventNames[eventCode] || `Unknown_${eventCode}`;
}

export function init(deps) {
    handlers = deps.handlers;
    map = deps.map;
    radarRenderer = deps.radarRenderer;
}

export function setRadarRenderer(renderer) {
    radarRenderer = renderer;
}

export function setMap(mapRef) {
    map = mapRef;
}

export function getLocalPlayerPosition() {
    return {x: lpX, y: lpY};
}

export function restoreMapFromSession() {
    if (!map) return;

    try {
        const savedMap = sessionStorage.getItem('lastMapDisplayed');
        window.logger?.debug(CATEGORIES.MAP, 'SessionRestoreAttempt', {
            hasData: !!savedMap
        });

        if (savedMap) {
            const data = JSON.parse(savedMap);

            if (data.mapId !== undefined && data.mapId !== null && data.mapId !== -1) {
                map.id = data.mapId;
                map.hX = data.hX || 0;
                map.hY = data.hY || 0;
                map.isBZ = data.isBZ || false;
                window.currentMapId = map.id;

                window.logger?.info(CATEGORIES.MAP, 'MapRestoredFromSession', {
                    mapId: map.id,
                    age: Date.now() - (data.timestamp || 0)
                });
            }
        }
    } catch (e) {
        window.logger?.warn(CATEGORIES.MAP, 'SessionRestoreFailed', {error: e?.message});
    }
}

export function onEvent(Parameters) {
    const id = parseInt(Parameters[0]);
    const eventCode = Parameters[252];

    // Raw packet logging
    window.logger?.debug(CATEGORIES.NETWORK, `Event_${eventCode}`, {
        id,
        eventCode,
        allParameters: Parameters
    });

    // Detailed event logging (skip verbose events)
    if (eventCode !== 91) {
        const paramDetails = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key) && key !== '252' && key !== '0') {
                paramDetails[`param[${key}]`] = Parameters[key];
            }
        }

        window.logger?.debug(CATEGORIES.NETWORK, `Event_${eventCode}_ID_${id}`, {
            id,
            eventCode,
            eventName: getEventName(eventCode),
            parameterCount: Object.keys(Parameters).length,
            parameters: paramDetails
        });
    }

    const {
        playersHandler, mobsHandler, harvestablesHandler, chestsHandler,
        dungeonsHandler, fishingHandler, wispCageHandler
    } = handlers;

    switch (eventCode) {
        case EventCodes.Leave:
            playersHandler.removePlayer(id);
            mobsHandler.removeMist(id);
            mobsHandler.removeMob(id);
            dungeonsHandler.removeDungeon(id);
            chestsHandler.removeChest(id);
            fishingHandler.removeFish(id);
            wispCageHandler.removeCage(id);
            break;

        case EventCodes.Move:
            const posX = Parameters[4];
            const posY = Parameters[5];
            mobsHandler.updateMistPosition(id, posX, posY);
            mobsHandler.updateMobPosition(id, posX, posY);
            break;

        case EventCodes.NewCharacter:
            playersHandler.handleNewPlayerEvent(id, Parameters);
            break;

        case EventCodes.NewSimpleHarvestableObjectList:
            harvestablesHandler.newSimpleHarvestableObject(Parameters);
            break;

        case EventCodes.NewHarvestableObject:
            harvestablesHandler.newHarvestableObject(id, Parameters);
            break;

        case EventCodes.HarvestableChangeState:
            harvestablesHandler.HarvestUpdateEvent(Parameters);
            break;

        case EventCodes.HarvestStart:
        case EventCodes.HarvestCancel:
            // Handled by HarvestablesHandler via database validation
            break;

        case EventCodes.HarvestFinished:
            harvestablesHandler.harvestFinished(Parameters);
            break;

        case EventCodes.InventoryPutItem:
        case EventCodes.InventoryDeleteItem:
        case EventCodes.InventoryState:
        case EventCodes.NewSimpleItem:
        case EventCodes.NewEquipmentItem:
        case EventCodes.NewJournalItem:
        case EventCodes.UpdateFame:
        case EventCodes.UpdateMoney:
            // Inventory/economy events - not currently used
            break;

        case EventCodes.MobChangeState:
            mobsHandler.updateEnchantEvent(Parameters);
            break;

        case EventCodes.RegenerationHealthChanged: {
            const mobInfo = mobsHandler.debugLogMobById(Parameters[0]);
            window.logger?.debug(CATEGORIES.MOBS, 'regen_health_changed', {
                eventCode: 91,
                id: Parameters[0],
                mobInfo,
                allParameters: Parameters
            });
        }
            playersHandler.UpdatePlayerHealth(Parameters);
            mobsHandler.updateMobHealthRegen(Parameters);
            break;

        case EventCodes.HealthUpdate: {
            const mobInfo = mobsHandler.debugLogMobById(Parameters[0]);
            window.logger?.debug(CATEGORIES.MOBS, 'health_update', {
                eventCode: 6,
                id: Parameters[0],
                mobInfo,
                allParameters: Parameters
            });
        }
            playersHandler.UpdatePlayerLooseHealth(Parameters);
            mobsHandler.updateMobHealth(Parameters);
            break;

        case EventCodes.HealthUpdates:
            window.logger?.debug(CATEGORIES.MOBS, 'bulk_hp_update', {
                eventCode: 7,
                allParameters: Parameters
            });
            mobsHandler.updateMobHealthBulk(Parameters);
            break;

        case EventCodes.CharacterEquipmentChanged:
            playersHandler.updateItems(id, Parameters);
            break;

        case EventCodes.NewMob:
            mobsHandler.NewMobEvent(Parameters);
            break;

        case EventCodes.Mounted:
            playersHandler.handleMountedPlayerEvent(id, Parameters);
            break;

        case EventCodes.NewRandomDungeonExit:
            dungeonsHandler.dungeonEvent(Parameters);
            break;

        case EventCodes.NewLootChest:
            chestsHandler.addChestEvent(Parameters);
            break;

        case EventCodes.NewCagedObject:
            wispCageHandler.newCageEvent(Parameters);
            break;

        case EventCodes.CagedObjectStateUpdated:
            wispCageHandler.cageOpenedEvent(Parameters);
            break;

        case EventCodes.NewFishingZoneObject:
            fishingHandler.newFishEvent(Parameters);
            break;

        case EventCodes.FishingFinished:
            fishingHandler.fishingEnd(Parameters);
            break;

        case EventCodes.ChangeFlaggingFinished:
            playersHandler.updatePlayerFaction(Parameters[0], Parameters[1]);
            break;

        case 590:
            window.logger?.debug(CATEGORIES.NETWORK, 'key_sync', {Parameters});
            break;
    }
}

export function onRequest(Parameters) {
    // Player moving - Operation 21 is for LOCAL PLAYER ONLY
    if (Parameters[253] == 21) {
        if (Array.isArray(Parameters[1]) && Parameters[1].length === 2) {
            updateLocalPlayerPosition(Parameters[1][0], Parameters[1][1]);
            window.logger?.debug(CATEGORIES.PLAYERS, 'Operation21_LocalPlayer', {lpX, lpY});
        }
        // Legacy Buffer handling
        else if (Parameters[1] && Parameters[1].type === 'Buffer') {
            const uint8Array = new Uint8Array(Parameters[1].data);
            const dataView = new DataView(uint8Array.buffer);
            updateLocalPlayerPosition(dataView.getFloat32(0, true), dataView.getFloat32(4, true));
        } else {
            window.logger?.error(CATEGORIES.PLAYERS, 'OnRequest_Move_UnknownFormat', {
                param1: Parameters[1],
                param1Type: typeof Parameters[1]
            });
        }
    }
}

export function onResponse(Parameters, clearHandlersCallback) {
    // Player change cluster
    if (Parameters[253] == 35) {
        const newMapId = Parameters[0];
        const now = Date.now();
        const timeSinceLastChange = now - lastMapChangeTime;

        // Debounce: Ignore rapid map changes
        if (timeSinceLastChange < MAP_CHANGE_DEBOUNCE_MS && map.id !== -1) {
            window.logger?.debug(CATEGORIES.MAP, 'MapChangeDebounced', {
                currentMapId: map.id,
                newMapId,
                timeSinceLastChange
            });
            return;
        }

        // Skip if same map ID
        if (newMapId === map.id) {
            return;
        }

        const previousMapId = map.id;
        map.id = newMapId;
        lastMapChangeTime = now;
        window.currentMapId = map.id;

        window.logger?.info(CATEGORIES.MAP, 'MapChanged', {
            previousMapId,
            newMapId: map.id
        });

        if (radarRenderer) {
            radarRenderer.setMap(map);
        }

        // Save to sessionStorage
        try {
            sessionStorage.setItem('lastMapDisplayed', JSON.stringify({
                mapId: map.id,
                hX: map.hX,
                hY: map.hY,
                isBZ: map.isBZ,
                timestamp: Date.now()
            }));
        } catch (e) {
            window.logger?.warn(CATEGORIES.MAP, 'SessionStorageFailed', {error: e?.message});
        }
    }
    // All data on the player joining the map (us)
    else if (Parameters[253] == 2) {
        // Decode position from Buffer or Array
        if (Parameters[9] && Parameters[9].type === 'Buffer') {
            const uint8Array = new Uint8Array(Parameters[9].data);
            const dataView = new DataView(uint8Array.buffer);
            updateLocalPlayerPosition(dataView.getFloat32(0, true), dataView.getFloat32(4, true));
            window.logger?.info(CATEGORIES.PLAYERS, 'OnResponse_JoinMap_BufferDecoded', {lpX, lpY});
        } else if (Array.isArray(Parameters[9])) {
            updateLocalPlayerPosition(Parameters[9][0], Parameters[9][1]);
            window.logger?.info(CATEGORIES.PLAYERS, 'OnResponse_JoinMap_Array', {lpX, lpY});
        } else {
            window.logger?.error(CATEGORIES.PLAYERS, 'OnResponse_JoinMap_UnknownFormat', {
                param9: Parameters[9],
                param9Type: typeof Parameters[9]
            });
        }

        map.isBZ = Parameters[103] == 2;
        clearHandlersCallback();
    } else if (Parameters[253] == 137) {
        // Character stats response - not currently used
    }
}

export function reset() {
    lpX = 0.0;
    lpY = 0.0;
    window.lpX = 0;
    window.lpY = 0;
    lastMapChangeTime = 0;

    // Clear references to prevent memory leaks
    handlers = null;
    map = null;
    radarRenderer = null;
}
