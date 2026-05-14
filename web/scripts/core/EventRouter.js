// EventRouter.js - WebSocket event routing to handlers
// Extracted from Utils.js during Phase 1B refactor

import {EventCodes} from '../utils/EventCodes.js';
import {OperationCodes} from '../utils/OperationCodes.js';
import {CATEGORIES} from '../constants/LoggerConstants.js';
import zonesDatabase from '../data/ZonesDatabase.js';

function syncMapIsBZ() {
    if (!map) return;
    map.isBZ = zonesDatabase.isBlackZone(map.id);
}

// Map change debouncing
const MAP_CHANGE_DEBOUNCE_MS = 4000;
const MIST_CHOICE_TTL_MS = 30000;
let lastMapChangeTime = 0;
let pendingMistChoice = null;

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

function persistMapToSession() {
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

function persistMistOverride(mistMapId, originZoneId) {
    try {
        sessionStorage.setItem('activeMistOverride', JSON.stringify({
            mistMapId,
            originZoneId,
            timestamp: Date.now()
        }));
    } catch (e) {
        window.logger?.warn(CATEGORIES.MAP, 'MistOverridePersistFailed', {error: e?.message});
    }
}

function clearMistOverridePersistence() {
    try {
        sessionStorage.removeItem('activeMistOverride');
    } catch (e) {
        window.logger?.warn(CATEGORIES.MAP, 'MistOverrideClearFailed', {error: e?.message});
    }
}

function resolveMistOriginId(previousMapId) {
    if (typeof previousMapId !== 'string' || previousMapId.length === 0) return null;
    if (!previousMapId.startsWith('@MISTS@')) return previousMapId;
    const prevOverride = zonesDatabase.getZone(previousMapId);
    return prevOverride && typeof prevOverride.originZoneId === 'string'
        ? prevOverride.originZoneId
        : null;
}

function consumePendingMistChoice() {
    if (!pendingMistChoice) return null;
    const age = Date.now() - pendingMistChoice.ts;
    const choice = age <= MIST_CHOICE_TTL_MS ? pendingMistChoice : null;
    pendingMistChoice = null;
    return choice;
}

function applyMapChange(newMapId, logEvent, extraLogFields = {}) {
    const previousMapId = map.id;
    map.id = newMapId;
    window.currentMapId = map.id;
    lastMapChangeTime = Date.now();
    if (typeof newMapId === 'string' && newMapId.startsWith('@MISTS@')) {
        const originId = resolveMistOriginId(previousMapId);
        const choice = consumePendingMistChoice();
        const forcedPvpType = choice ? (choice.lethal ? 'black' : 'yellow') : undefined;
        if (originId && zonesDatabase.setMistOverride(newMapId, originId, forcedPvpType)) {
            persistMistOverride(newMapId, originId);
        }
    } else {
        zonesDatabase.clearAllMistOverrides();
        clearMistOverridePersistence();
        pendingMistChoice = null;
    }
    syncMapIsBZ();
    radarRenderer?.setMap?.(map);
    persistMapToSession();
    window.logger?.info(CATEGORIES.MAP, logEvent, {
        previousMapId,
        newMapId: map.id,
        ...extraLogFields
    });
}

function decodeJoinPosition(p9) {
    if (p9 && p9.type === 'Buffer') {
        const dataView = new DataView(new Uint8Array(p9.data).buffer);
        updateLocalPlayerPosition(dataView.getFloat32(0, true), dataView.getFloat32(4, true));
        window.logger?.info(CATEGORIES.PLAYERS, 'OnResponse_JoinMap_BufferDecoded', {lpX, lpY});
        return;
    }
    if (Array.isArray(p9)) {
        updateLocalPlayerPosition(p9[0], p9[1]);
        window.logger?.info(CATEGORIES.PLAYERS, 'OnResponse_JoinMap_Array', {lpX, lpY});
        return;
    }
    window.logger?.error(CATEGORIES.PLAYERS, 'OnResponse_JoinMap_UnknownFormat', {
        param9: p9,
        param9Type: typeof p9
    });
}

function handleChangeClusterResponse(Parameters, clearHandlersCallback) {
    const newMapId = Parameters[0];
    if (typeof newMapId !== 'string' || newMapId.length === 0 || newMapId === map.id) {
        return;
    }
    applyMapChange(newMapId, 'ChangeClusterResponse');
    clearHandlersCallback();
}

function handleLegacyMapChangeResponse(Parameters) {
    const newMapId = Parameters[0];
    const now = Date.now();
    const timeSinceLastChange = now - lastMapChangeTime;
    if (timeSinceLastChange < MAP_CHANGE_DEBOUNCE_MS && map.id !== -1) {
        window.logger?.debug(CATEGORIES.MAP, 'MapChangeDebounced', {
            currentMapId: map.id,
            newMapId,
            timeSinceLastChange
        });
        return;
    }
    if (newMapId === map.id) return;
    applyMapChange(newMapId, 'MapChanged');
}

function handleJoinResponse(Parameters, clearHandlersCallback) {
    decodeJoinPosition(Parameters[9]);
    if (typeof Parameters[8] === 'string' && Parameters[8].length > 0) {
        applyMapChange(Parameters[8], 'MapChangedFromJoinMap');
    }
    clearHandlersCallback();
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

export function getLocalPlayerPosition() {
    return {x: lpX, y: lpY};
}

export function _debugGetPendingMistChoice() {
    return pendingMistChoice;
}

export function restoreMistOverrideFromSession() {
    try {
        const saved = sessionStorage.getItem('activeMistOverride');
        if (!saved) return;
        const data = JSON.parse(saved);
        if (data && typeof data.mistMapId === 'string' && typeof data.originZoneId === 'string') {
            zonesDatabase.setMistOverride(data.mistMapId, data.originZoneId);
            window.logger?.info(CATEGORIES.MAP, 'MistOverrideRestored', {
                mistMapId: data.mistMapId,
                originZoneId: data.originZoneId,
                age: Date.now() - (data.timestamp || 0)
            });
        }
    } catch (e) {
        window.logger?.warn(CATEGORIES.MAP, 'MistOverrideRestoreFailed', {error: e?.message});
    }
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
                syncMapIsBZ();
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

        // upstream 590 = UpdateEnemyWarBannerActive; local dispatch labels it "key_sync", semantics diverge.
        case 590:
            window.logger?.debug(CATEGORIES.NETWORK, 'key_sync', {Parameters});
            break;

        case EventCodes.MistsPlayerJoinedInfo: {
            const newMapId = Parameters[2];
            if (Parameters[3] === true && typeof newMapId === 'string' && newMapId.length > 0 && newMapId !== map.id) {
                applyMapChange(newMapId, 'MistsPlayerJoinedInfo', {originCluster: Parameters[4]});
            }
            break;
        }
    }
}

export function onRequest(Parameters) {
    // 22 = OperationCodes.Move. 21 = legacy pre-Protocol18 Move (upstream 21 is now GetShopTilesForCategory).
    if (Parameters[253] == 21 || Parameters[253] == OperationCodes.Move) {
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

    if (Parameters[253] == OperationCodes.MistsUseStaticEntrance && Parameters[1] == 8) {
        pendingMistChoice = {
            ts: Date.now(),
            lethal: Parameters[2] !== undefined,
        };
        window.logger?.info(CATEGORIES.MAP, 'MistChoicePending', {
            lethal: pendingMistChoice.lethal,
            mode: Parameters[2] ?? null,
        });
    }
}

export function onResponse(Parameters, clearHandlersCallback) {
    if (Parameters[253] == OperationCodes.ChangeCluster) {
        handleChangeClusterResponse(Parameters, clearHandlersCallback);
        return;
    }
    // upstream 35 = InventoryStack; this branch treats it as a map-change response, semantics diverge.
    if (Parameters[253] == 35) {
        handleLegacyMapChangeResponse(Parameters);
        return;
    }
    if (Parameters[253] == OperationCodes.Join) {
        handleJoinResponse(Parameters, clearHandlersCallback);
    }
}

export function reset() {
    lpX = 0.0;
    lpY = 0.0;
    window.lpX = 0;
    window.lpY = 0;
    lastMapChangeTime = 0;
    pendingMistChoice = null;

    // Clear references to prevent memory leaks
    handlers = null;
    map = null;
    radarRenderer = null;
}
