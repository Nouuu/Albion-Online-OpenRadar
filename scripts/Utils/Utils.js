import { PlayersDrawing } from '../Drawings/PlayersDrawing.js';
import { HarvestablesDrawing } from '../Drawings/HarvestablesDrawing.js';
import { MobsDrawing } from '../Drawings/MobsDrawing.js';
import { ChestsDrawing } from '../Drawings/ChestsDrawing.js';
import { DungeonsDrawing } from '../Drawings/DungeonsDrawing.js';
import { MapDrawing } from '../Drawings/MapsDrawing.js';
import { WispCageDrawing } from '../Drawings/WispCageDrawing.js';
import { FishingDrawing } from '../Drawings/FishingDrawing.js';

import { EventCodes } from './EventCodes.js';

import { PlayersHandler } from '../Handlers/PlayersHandler.js';
import { WispCageHandler } from '../Handlers/WispCageHandler.js';
import { FishingHandler } from '../Handlers/FishingHandler.js';

// Check if canvas elements exist (only on drawing page)
var canvasMap = document.getElementById("mapCanvas");
var contextMap = canvasMap ? canvasMap.getContext("2d") : null;

var canvasGrid = document.getElementById("gridCanvas");
var contextGrid = canvasGrid ? canvasGrid.getContext("2d") : null;

var canvas = document.getElementById("drawCanvas");
var context = canvas ? canvas.getContext("2d") : null;

var canvasFlash = document.getElementById("flashCanvas");
var contextFlash = canvasFlash ? canvasFlash.getContext("2d") : null;

var canvasOurPlayer = document.getElementById("ourPlayerCanvas");
var contextOurPlayer = canvasOurPlayer ? canvasOurPlayer.getContext("2d") : null;

var canvasItems = document.getElementById("thirdCanvas");
var contextItems = canvasItems ? canvasItems.getContext("2d") : null;

import { Settings } from './Settings.js';

console.log('🔧 [Utils.js] Module loaded');

const settings = new Settings();

const { CATEGORIES, EVENTS } = window;

console.log('🔧 [Utils.js] Settings initialized (logger is managed by LoggerClient.js)');
// 🔄 Dynamic Settings Update: Listen for localStorage changes
// This allows settings to update in real-time without page reload
window.addEventListener('storage', (event) => {
    if (event.key && event.key.startsWith('setting')) {
        window.logger?.info(CATEGORIES.SETTINGS, EVENTS.DynamicUpdate, { key: event.key, value: event.newValue });
        settings.update();
    }
});

// 🔄 Custom event for same-page localStorage changes
// (storage event doesn't fire on the same page that made the change)
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    const event = new Event('localStorageChange');
    event.key = key;
    event.newValue = value;
    originalSetItem.apply(this, arguments);

    if (key.startsWith('setting')) {
        window.logger?.info(CATEGORIES.SETTINGS, EVENTS.SamePageUpdate, { key: key, value: value });
        settings.update();
    }
};



const harvestablesDrawing = new HarvestablesDrawing(settings);
const dungeonsHandler = new DungeonsHandler(settings);

var itemsInfo = new ItemsInfo();
var mobsInfo = new MobsInfo();

itemsInfo.initItems();
mobsInfo.initMobs();


var map = new MapH(-1);
const mapsDrawing = new MapDrawing(settings);

const chestsHandler = new ChestsHandler(settings);
const mobsHandler = new MobsHandler(settings);
mobsHandler.updateMobInfo(mobsInfo.moblist);

// existing logEnemiesList button stays the same
window.addEventListener('load', () => {
    const logEnemiesList = document.getElementById('logEnemiesList');
    if (logEnemiesList) {
        logEnemiesList.addEventListener('click', () => {
            const mobList = mobsHandler.getMobList();
            window.logger?.debug(CATEGORIES.DEBUG, EVENTS.EnemiesList, { mobList: mobList });
        });
    }

    // Clear TypeID Cache button
    const clearTypeIDCache = document.getElementById('clearTypeIDCache');
    if (clearTypeIDCache) clearTypeIDCache.addEventListener('click', () => {
        try {
            // Show what's in cache BEFORE clearing
            const cached = localStorage.getItem('cachedStaticResourceTypeIDs');
            if (cached) {
                const entries = JSON.parse(cached);
                window.logger?.info(CATEGORIES.CACHE, EVENTS.ClearingTypeIDCache, {
                    entriesCount: entries.length,
                    entries: entries.map(([typeId, info]) => ({
                        typeId: typeId,
                        type: info.type,
                        tier: info.tier
                    }))
                });
            } else {
                window.logger?.info(CATEGORIES.CACHE, EVENTS.CacheAlreadyEmpty, {});
            }

            // Clear in-memory cache in MobsHandler
            mobsHandler.clearCachedTypeIDs();

            // Confirm
            const shouldReload = confirm('✅ TypeID Cache cleared (in-memory + localStorage)!\n\n🔄 Reload the page to start fresh?\n\n(Recommended: Yes)');
            if (shouldReload) {
                window.location.reload();
            }
        } catch (e) {
            window.logger?.error(CATEGORIES.CACHE, EVENTS.ClearCacheFailed, { error: e.message });
            alert('❌ Failed to clear cache: ' + e.message);
        }
    });

    // Show TypeID Cache button (debug)
    const showTypeIDCache = document.getElementById('showTypeIDCache');
    if (showTypeIDCache) showTypeIDCache.addEventListener('click', () => {
        mobsHandler.showCachedTypeIDs();
    });
});


const harvestablesHandler = new HarvestablesHandler(settings, mobsHandler); // 🔗 Pass MobsHandler reference
const playersHandler = new PlayersHandler(settings);


// 📊 Expose handlers globally for statistics and debug access
window.harvestablesHandler = harvestablesHandler;
window.mobsHandler = mobsHandler;

const wispCageHandler = new WispCageHandler(settings);
const wispCageDrawing = new WispCageDrawing(settings);

const fishingHandler = new FishingHandler(settings);
const fishingDrawing = new FishingDrawing(settings);

const chestsDrawing = new ChestsDrawing(settings);
const mobsDrawing = new MobsDrawing(settings);
const playersDrawing = new PlayersDrawing(settings);
const dungeonsDrawing = new DungeonsDrawing(settings);
playersDrawing.updateItemsInfo(itemsInfo.iteminfo);


let lpX = 0.0;
let lpY = 0.0;

// 🌍 Expose lpX/lpY globally for DEEP DEBUG access
window.lpX = lpX;
window.lpY = lpY;

var flashTime = -1;

const drawingUtils = new DrawingUtils();
drawingUtils.initCanvas(canvas, context);
drawingUtils.initGridCanvas(canvasGrid, contextGrid);
drawingUtils.InitOurPlayerCanvas(canvasOurPlayer, contextOurPlayer);


const socket = new WebSocket('ws://localhost:5002');


socket.addEventListener('open', () => {
  window.logger?.info(CATEGORIES.WEBSOCKET, EVENTS.Connected, { page: 'Utils' });
});

socket.addEventListener('message', (event) => {
  var data = JSON.parse(event.data);

  // Extract the string and dictionary from the object
  var extractedString = data.code;

  var extractedDictionary = JSON.parse(data.dictionary);

  // 🐛 DEBUG: Log ALL network packets to see request/response/event distribution
  if (!window.__packetTypeCount) window.__packetTypeCount = {};
  if (!window.__packetTypeCount[extractedString]) window.__packetTypeCount[extractedString] = 0;
  window.__packetTypeCount[extractedString]++;

  // Log every 50 packets to track what we're receiving
  const totalPackets = Object.values(window.__packetTypeCount).reduce((a, b) => a + b, 0);
  if (totalPackets % 100 === 0) {
    window.logger?.info(CATEGORIES.PACKET_RAW, 'PacketTypeDistribution', {
      totalPackets,
      distribution: window.__packetTypeCount,
      note: 'Tracking all packet types from network'
    });
  }

  switch (extractedString)
  {
    case "request":
        // 🐛 DEBUG: Log first 5 requests to see their structure
        if (!window.__requestLogCount) window.__requestLogCount = 0;
        window.__requestLogCount++;

        if (window.__requestLogCount <= 5) {
          window.logger?.warn(CATEGORIES.PACKET_RAW, 'Request_Packet_Sample', {
            requestNumber: window.__requestLogCount,
            parameters: extractedDictionary["parameters"],
            note: 'Sample request packet for analysis'
          });
        }

        onRequest(extractedDictionary["parameters"]);
        break;

    case "event":
        // 🔍 DEBUG: Log full extractedDictionary to find Photon Event Code
        if (!window.__eventDictLogCount) window.__eventDictLogCount = 0;
        window.__eventDictLogCount++;

        if (window.__eventDictLogCount <= 3) {
            window.logger?.warn(CATEGORIES.PACKET_RAW, 'Event_Full_Dictionary', {
                eventNumber: window.__eventDictLogCount,
                fullDictionary: extractedDictionary,
                dictionaryKeys: Object.keys(extractedDictionary),
                note: 'Full extractedDictionary to find Photon Event Code'
            });
        }

        // 🔍 DEBUG: Log Photon Event Codes 2 and 3 to identify player vs entity moves
        const photonCode = extractedDictionary["code"];
        if (photonCode === 2 || photonCode === 3) {
            if (!window.__photonCodeCount) window.__photonCodeCount = {2: 0, 3: 0};
            window.__photonCodeCount[photonCode]++;

            if (window.__photonCodeCount[photonCode] <= 5) {
                const params = extractedDictionary["parameters"];
                window.logger?.warn(CATEGORIES.PACKET_RAW, `Photon_Event_Code_${photonCode}`, {
                    count: window.__photonCodeCount[photonCode],
                    photonCode: photonCode,
                    id: params[0],
                    hasBuffer: params[1]?.type === 'Buffer',
                    bufferLength: params[1]?.data?.length,
                    param252: params[252],
                    allParamKeys: Object.keys(params),
                    note: `Photon Event Code ${photonCode} analysis - first 5 occurrences`
                });
            }
        }

        onEvent(extractedDictionary["parameters"]);
        break;

    case "response":
        // 🐛 DEBUG: Log first 5 responses to see their structure
        if (!window.__responseLogCount) window.__responseLogCount = 0;
        window.__responseLogCount++;

        if (window.__responseLogCount <= 5) {
          window.logger?.warn(CATEGORIES.PACKET_RAW, 'Response_Packet_Sample', {
            responseNumber: window.__responseLogCount,
            parameters: extractedDictionary["parameters"],
            note: 'Sample response packet for analysis'
          });
        }

        onResponse(extractedDictionary["parameters"]);
        break;
  }
});

// Helper function pour obtenir le nom de l'événement (pour debug)
function getEventName(eventCode) {
    const eventNames = {
        1: 'Leave',
        2: 'JoinFinished',
        3: 'Move',  // ✅ CORRIGÉ - Move = 3 selon EventCodes.js
        4: 'Teleport',
        5: 'ChangeEquipment',
        6: 'HealthUpdate',
        7: 'HealthUpdates',
        15: 'Damage',
        21: 'Request_Move',  // ⚠️ Probablement une requête (onRequest), pas un événement
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
        // Ajoutez d'autres au fur et à mesure de la découverte
    };
    return eventNames[eventCode] || `Unknown_${eventCode}`;
}

function onEvent(Parameters)
{
    const id = parseInt(Parameters[0]);
    const eventCode = Parameters[252];

    // 📦 DEBUG RAW: Log tous les paquets bruts (très verbeux, pour debug profond uniquement)
    // Note: debugRawPacketsConsole contrôle l'affichage console, debugRawPacketsServer contrôle l'envoi au serveur
    window.logger?.debug(CATEGORIES.PACKET_RAW, `Event_${eventCode}`, {
        id,
        eventCode,
        allParameters: Parameters
    });

    // 🔍 DEBUG ALL EVENTS: Log événement avec détails si debug activé
    // Permet d'identifier les patterns et correspondances paramètres <-> événements
    if (eventCode !== 91) { // Skip RegenerationHealthChanged car trop verbeux
        const paramDetails = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key) && key !== '252' && key !== '0') { // Skip eventCode et id déjà loggés
                paramDetails[`param[${key}]`] = Parameters[key];
            }
        }

        window.logger?.debug(CATEGORIES.EVENT_DETAIL, `Event_${eventCode}_ID_${id}`, {
            id,
            eventCode,
            eventName: getEventName(eventCode),
            parameterCount: Object.keys(Parameters).length,
            parameters: paramDetails
        });
    }

    switch (eventCode)
    {
        // DEBUG

        /*case 506:
            console.log("MistsPlayerJoinedInfo");
            console.log(Parameters);
            break;

        case 474:
            console.log("CarriedObjectUpdate");
            console.log(Parameters);
            break;

        case 530:
            console.log("TemporaryFlaggingStatusUpdate ");
            console.log(Parameters);
            break;*/

        // END DEBUG

        case EventCodes.Leave:
            playersHandler.removePlayer(id);
            mobsHandler.removeMist(id);
            mobsHandler.removeMob(id);
            dungeonsHandler.RemoveDungeon(id);
            chestsHandler.removeChest(id);
            fishingHandler.RemoveFish(id);
            wispCageHandler.RemoveCage(id);
            break;

        case EventCodes.Move:
            // 🔬 DEEP DEBUG: Log ALL parameters for tracked players when debugPlayers is enabled
            if (settings.debugPlayers && window.__knownPlayerIds && window.__knownPlayerIds.has(id)) {
                const allParams = {};
                for (let i = 0; i <= 252; i++) {
                    if (Parameters[i] !== undefined) {
                        allParams[`param[${i}]`] = Parameters[i];
                    }
                }

                window.logger?.warn(CATEGORIES.PLAYER, 'DEEP_DEBUG_Move', {
                    id,
                    timestamp: Date.now(),
                    lpX: window.lpX || 'not set',
                    lpY: window.lpY || 'not set',
                    allParameters: allParams,
                    parameterCount: Object.keys(allParams).length
                });
            }

            // 🎯 Move events: Server deserializes all positions and sends clean data
            // Client receives param[4]=posX and param[5]=posY (already deserialized server-side)

            let posX = 0;
            let posY = 0;

            // ✅ Validate position values (reject corrupted data)
            const isValidPosition = (x, y) => {
                return typeof x === 'number' && typeof y === 'number' &&
                       isFinite(x) && isFinite(y) &&
                       Math.abs(x) < 10000 && Math.abs(y) < 10000 &&
                       !(x === 0 && y === 0);  // ✅ 0,0 is NOT valid (uninitialized)
            };

            // ✅ Use server-deserialized positions (param[4]=posX, param[5]=posY)
            if (Parameters[4] !== undefined && Parameters[5] !== undefined) {
                const serverPosX = Parameters[4];
                const serverPosY = Parameters[5];

                if (isValidPosition(serverPosX, serverPosY)) {
                    posX = serverPosX;
                    posY = serverPosY;

                    // 🔍 DEBUG: Log first 5 Move events
                    if (!window.__moveEventDeserializedCount) window.__moveEventDeserializedCount = 0;
                    window.__moveEventDeserializedCount++;

                    if (window.__moveEventDeserializedCount <= 5) {
                        window.logger?.info(CATEGORIES.PLAYER, 'Move_PositionsReceived', {
                            id,
                            posX: serverPosX,
                            posY: serverPosY,
                            count: window.__moveEventDeserializedCount,
                            note: '✅ Clean positions from server'
                        });
                    }
                } else {
                    // Invalid positions received from server
                    window.logger?.warn(CATEGORIES.PLAYER, 'Move_InvalidPositions', {
                        id,
                        posX: serverPosX,
                        posY: serverPosY,
                        note: '⚠️ Server sent invalid positions'
                    });
                }
            } else {
                // Missing position data from server
                if (!window.__missingPositionsCount) window.__missingPositionsCount = 0;
                window.__missingPositionsCount++;

                if (window.__missingPositionsCount <= 5) {
                    window.logger?.error(CATEGORIES.PLAYER, 'Move_MissingPositions', {
                        id,
                        param4: Parameters[4],
                        param5: Parameters[5],
                        count: window.__missingPositionsCount,
                        note: '❌ Server did not send positions - check server deserialization'
                    });
                }
            }

            // ✅ SERVER-SIDE DESERIALIZATION: All positions correctly deserialized
            // Server sends clean param[4]=posX, param[5]=posY for Move events
            // No need for client-side Buffer parsing or workarounds

            if (isValidPosition(posX, posY)) {
                // Track Move event frequency per ID
                if (!window.__moveEventCount) window.__moveEventCount = {};
                if (!window.__moveEventCount[id]) window.__moveEventCount[id] = 0;
                window.__moveEventCount[id]++;

                // After 100 Move events total, determine local player ID
                const totalMoveEvents = Object.values(window.__moveEventCount).reduce((a, b) => a + b, 0);
                
                // 🐛 DEBUG: Log every 50 valid Move events to track progress
                if (totalMoveEvents % 50 === 0 && totalMoveEvents < 150) {
                    window.logger?.info(CATEGORIES.PLAYER, 'MoveEventTracking', {
                        totalMoveEvents,
                        topEntities: Object.entries(window.__moveEventCount)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([id, count]) => ({id: parseInt(id), count})),
                        note: 'Tracking Move events to detect local player'
                    });
                }
                
                if (totalMoveEvents === 100 && !window.__localPlayerId) {
                    // Find ID with most Move events = local player
                    let maxCount = 0;
                    let localId = null;
                    for (let [entityId, count] of Object.entries(window.__moveEventCount)) {
                        if (count > maxCount) {
                            maxCount = count;
                            localId = parseInt(entityId);
                        }
                    }
                    
                    if (localId && maxCount > 50) { // Local player should have >50% of Move events
                        window.__localPlayerId = localId;
                        window.logger?.info(CATEGORIES.PLAYER, 'LocalPlayerDetected', {
                            localPlayerId: localId,
                            moveEventCount: maxCount,
                            totalMoveEvents: totalMoveEvents,
                            note: 'Detected local player from Move event frequency'
                        });
                    }
                }

                // If this is local player, update lpX/lpY
                if (window.__localPlayerId && id === window.__localPlayerId) {
                    const oldLpX = lpX;
                    const oldLpY = lpY;
                    lpX = posX;
                    lpY = posY;
                    window.lpX = lpX;  // Sync global
                    window.lpY = lpY;
                    
                    // 🐛 DEBUG: Log EVERY lpX/lpY update to see what's happening
                    if (!window.__lpXUpdateCount) window.__lpXUpdateCount = 0;
                    window.__lpXUpdateCount++;
                    
                    if (window.__lpXUpdateCount % 100 === 1) {
                        window.logger?.info(CATEGORIES.PLAYER, 'LocalPlayerPositionUpdated', {
                            lpX,
                            lpY,
                            deltaX: posX - oldLpX,
                            deltaY: posY - oldLpY,
                            updateCount: window.__lpXUpdateCount,
                            source: 'Move event (EventCode 3)',
                            note: 'lpX/lpY updated from local player Move events'
                        });
                    }
                    
                    // Log first update
                    if (!window.__lpXInitialized) {
                        window.__lpXInitialized = true;
                        window.logger?.info(CATEGORIES.PLAYER, 'LocalPlayerPositionInitialized', {
                            lpX,
                            lpY,
                            source: 'Move event (EventCode 3)',
                            note: 'lpX/lpY initialized from local player Move events'
                        });
                    }
                }

                // ✅ Update ALL entities with validated positions
                // Server deserializes positions for ALL entities (players, mobs, NPCs)
                playersHandler.updatePlayerPosition(id, posX, posY, Parameters);
                mobsHandler.updateMistPosition(id, posX, posY);
                mobsHandler.updateMobPosition(id, posX, posY);
            } else {
                // Log corrupted Move events
                if (!window.__corruptedMoveCount) window.__corruptedMoveCount = 0;
                window.__corruptedMoveCount++;

                if (window.__corruptedMoveCount % 100 === 1) {
                    window.logger?.warn(CATEGORIES.PLAYER, 'MoveEvent_CorruptedPosition', {
                        id,
                        posX,
                        posY,
                        params4: Parameters[4],
                        params5: Parameters[5],
                        corruptedCount: window.__corruptedMoveCount,
                        note: 'Rejected corrupted position - keeping previous position'
                    });
                }
            }
            break;

        case EventCodes.NewCharacter:
            const ttt = playersHandler.handleNewPlayerEvent(Parameters, map.isBZ);
            flashTime = ttt < 0 ? flashTime : ttt;

            // 🔬 DEEP DEBUG: Track player IDs for exhaustive logging
            const playerName = Parameters[1];
            if (playerName && typeof playerName === 'string' && playerName.length > 0 && Parameters[2]) {
                // This is likely a player (has name and characterType)
                if (!window.__knownPlayerIds) window.__knownPlayerIds = new Set();
                if (!window.__knownPlayerIds.has(id)) {
                    window.__knownPlayerIds.add(id);

                    window.logger?.info(CATEGORIES.PLAYER, 'DEEP_DEBUG_PlayerTracked', {
                        id,
                        name: playerName,
                        totalTracked: window.__knownPlayerIds.size,
                        note: 'Player added to DEEP DEBUG tracking list'
                    });
                }
            }
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
            if (Parameters[3]) {
                harvestablesHandler.onHarvestStart(Parameters[3]);
            }
            break;

        case EventCodes.HarvestCancel:
            harvestablesHandler.onHarvestCancel();
            break;

        case EventCodes.HarvestFinished:
            harvestablesHandler.harvestFinished(Parameters);
            break;

        // Inventory events
        case EventCodes.InventoryPutItem:
            // 📦 Inventory updates
            break;

        case EventCodes.InventoryDeleteItem:
            // 🗑️ Item removed from inventory
            break;

        case EventCodes.InventoryState:
            // 📋 Full inventory state
            break;

        case EventCodes.NewSimpleItem:
            if (Parameters[1] && Parameters[2]) {
                harvestablesHandler.onNewSimpleItem(Parameters[1], Parameters[2]);
            }
            break;

        case EventCodes.NewEquipmentItem:
            // ⚔️ Equipment updates
            break;

        case EventCodes.NewJournalItem:
            // 📖 Journal updates
            break;

        case EventCodes.UpdateFame:
            // 📊 Fame tracking (not used for resource counting - see NewSimpleItem instead)
            // Parameters[2] = fame gained (varies with gear/food bonuses, but NOT premium)
            break;

        case EventCodes.UpdateMoney:
            // 💰 Money updates
            break;

        case EventCodes.MobChangeState:
            mobsHandler.updateEnchantEvent(Parameters);
            break;

        case EventCodes.RegenerationHealthChanged:
            // 🐛 DEBUG: Log health regeneration events
            {
                const mobInfo = mobsHandler.debugLogMobById(Parameters[0]);
                window.logger?.debug(CATEGORIES.MOB_HEALTH, EVENTS.RegenerationHealthChanged, {
                    eventCode: 91,
                    id: Parameters[0],
                    mobInfo,
                    params2: Parameters[2],
                    params3: Parameters[3],
                    allParameters: Parameters
                });
            }
            playersHandler.UpdatePlayerHealth(Parameters);
            mobsHandler.updateMobHealthRegen(Parameters);  // Update mob HP
            break;

        case EventCodes.HealthUpdate:
            // 🐛 DEBUG: Log health update events
            {
                const mobInfo = mobsHandler.debugLogMobById(Parameters[0]);
                window.logger?.debug(CATEGORIES.MOB_HEALTH, EVENTS.HealthUpdate, {
                    eventCode: 6,
                    id: Parameters[0],
                    mobInfo,
                    params3: Parameters[3],
                    allParameters: Parameters
                });
            }
            playersHandler.UpdatePlayerLooseHealth(Parameters);
            mobsHandler.updateMobHealth(Parameters);  // Update mob HP
            break;

        case EventCodes.HealthUpdates:
            // 🐛 DEBUG: Log bulk health updates (multiple entities at once)
            {
                window.logger?.debug(CATEGORIES.MOB_HEALTH, EVENTS.BulkHPUpdate, {
                    eventCode: 7,
                    allParameters: Parameters
                });
            }
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

        case EventCodes.NewMistsCagedWisp:
            wispCageHandler.NewCageEvent(Parameters);
            break;

        case EventCodes.MistsWispCageOpened:
            wispCageHandler.CageOpenedEvent(Parameters);
            break;

        // TODO
        case EventCodes.NewFishingZoneObject:
            fishingHandler.NewFishEvent(Parameters);
            break;

        // TODO
        case EventCodes.FishingFinished:
            fishingHandler.FishingEnd(Parameters);
            break;

        case 590:
            // Key sync event (debug)
            {
                window.logger?.debug(CATEGORIES.PACKET_RAW, EVENTS.KeySync, { Parameters });
            }
            break;

        /*default:
            console.log("default");
            console.log(Parameters);*/
    }
};


function onRequest(Parameters)
{
    // Player moving
    if (Parameters[253] == 21)
    {
        // 🔍 CRITICAL: Verify Parameters[1] format every 100 moves
        if (!window.__moveRequestCount) window.__moveRequestCount = 0;
        window.__moveRequestCount++;

        // If Buffer, decode it (browser-compatible)
        if (Parameters[1] && Parameters[1].type === 'Buffer') {
            const uint8Array = new Uint8Array(Parameters[1].data);
            const dataView = new DataView(uint8Array.buffer);
            lpX = dataView.getFloat32(0, true);  // little-endian
            lpY = dataView.getFloat32(4, true);
            window.lpX = lpX;  // Sync global
            window.lpY = lpY;

            if (window.__moveRequestCount % 100 === 1) {
                window.logger?.warn(CATEGORIES.PLAYER, 'OnRequest_Move_BufferDecoded', {
                    bufferLength: uint8Array.length,
                    decodedLpX: lpX,
                    decodedLpY: lpY,
                    moveCount: window.__moveRequestCount,
                    note: '⚠️ Parameters[1] was Buffer - decoded as floats'
                });
            }
        }
        // If Array, use directly
        else if (Array.isArray(Parameters[1])) {
            lpX = Parameters[1][0];
            lpY = Parameters[1][1];
            window.lpX = lpX;  // Sync global
            window.lpY = lpY;

            if (window.__moveRequestCount % 100 === 1) {
                window.logger?.info(CATEGORIES.PLAYER, 'OnRequest_Move_Array', {
                    lpX: lpX,
                    lpY: lpY,
                    moveCount: window.__moveRequestCount,
                    note: '✅ Parameters[1] is Array - using values directly'
                });
            }
        }
        // Unknown format
        else {
            window.logger?.error(CATEGORIES.PLAYER, 'OnRequest_Move_UnknownFormat', {
                param1: Parameters[1],
                param1Type: typeof Parameters[1],
                moveCount: window.__moveRequestCount,
                note: '❌ Parameters[1] format unknown - lpX/lpY may be corrupted!'
            });
        }
    }
}

function onResponse(Parameters)
{
    // Player change cluster
    if (Parameters[253] == 35)
    {
        map.id = Parameters[0];
    }
    // All data on the player joining the map (us)
    else if (Parameters[253] == 2)
    {
        // 🔍 CRITICAL: Verify Parameters[9] format (Array vs Buffer)
        const param9Type = Array.isArray(Parameters[9]) ? 'array' :
                          (Parameters[9]?.type === 'Buffer' ? 'buffer' : typeof Parameters[9]);

        // If Buffer, decode it (browser-compatible)
        if (Parameters[9] && Parameters[9].type === 'Buffer') {
            const uint8Array = new Uint8Array(Parameters[9].data);
            const dataView = new DataView(uint8Array.buffer);
            lpX = dataView.getFloat32(0, true);  // little-endian
            lpY = dataView.getFloat32(4, true);
            window.lpX = lpX;  // Sync global
            window.lpY = lpY;

            // Convert to hex for logging
            const bufferHex = Array.from(uint8Array)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            window.logger?.warn(CATEGORIES.PLAYER, 'OnResponse_JoinMap_BufferDecoded', {
                bufferLength: uint8Array.length,
                bufferHex: bufferHex,
                decodedLpX: lpX,
                decodedLpY: lpY,
                note: '⚠️ Parameters[9] was Buffer - decoded as floats'
            });
        }
        // If Array, use directly
        else if (Array.isArray(Parameters[9])) {
            lpX = Parameters[9][0];
            lpY = Parameters[9][1];
            window.lpX = lpX;  // Sync global
            window.lpY = lpY;

            window.logger?.info(CATEGORIES.PLAYER, 'OnResponse_JoinMap_Array', {
                lpX: lpX,
                lpY: lpY,
                note: '✅ Parameters[9] is Array - using values directly'
            });
        }
        // Unknown format
        else {
            window.logger?.error(CATEGORIES.PLAYER, 'OnResponse_JoinMap_UnknownFormat', {
                param9: Parameters[9],
                param9Type: typeof Parameters[9],
                note: '❌ Parameters[9] format unknown - lpX/lpY may be corrupted!'
            });
        }

        // TODO bz portals does not trigger this event, so when change map check if map id is portal in event 35 above ^
        // And clear everything too
        map.isBZ = Parameters[103] == 2;

        ClearHandlers();
    }
    // GetCharacterStats response (event 137)
    else if (Parameters[253] == 137)
    {
        // Character stats received
    }
};

requestAnimationFrame(gameLoop);

function render()
{

    context.clearRect(0, 0, canvas.width, canvas.height);
    contextMap.clearRect(0, 0, canvasMap.width, canvasMap.height);
    contextFlash.clearRect(0, 0, canvasFlash.width, canvasFlash.height);

    mapsDrawing.Draw(contextMap, map);

    // Unified cluster detection + drawing (merge static harvestables + living resources)
    let __clustersForInfo = null;
    if (settings.overlayCluster) {
        try {
            // Prepare merged list: static harvestables + living resources from mobs
            const staticList = harvestablesHandler.harvestableList || [];
            const livingList = (mobsHandler && mobsHandler.mobsList) ?
                mobsHandler.mobsList.filter(mob => mob.type === EnemyType.LivingHarvestable || mob.type === EnemyType.LivingSkinnable)
                : [];

            // Merge arrays (no deep copy needed) - detectClusters expects objects with hX/hY/tier/name/type/size
            const merged = staticList.concat(livingList);

            const clusters = drawingUtils.detectClusters(merged, settings.overlayClusterRadius, settings.overlayClusterMinSize);

            // Draw only rings now (behind resources)
            for (const cluster of clusters) {
                if (drawingUtils && typeof drawingUtils.drawClusterRingsFromCluster === 'function') {
                    drawingUtils.drawClusterRingsFromCluster(context, cluster);
                } else if (drawingUtils && typeof drawingUtils.drawClusterIndicatorFromCluster === 'function') {
                    // fallback to legacy method
                    drawingUtils.drawClusterIndicatorFromCluster(context, cluster);
                }
            }

            // keep clusters for later to draw info boxes above everything
            __clustersForInfo = clusters;
        } catch (e) {
            // ❌ ERROR (toujours loggé) - Erreur critique de calcul de clusters
            window.logger?.error(CATEGORIES.CLUSTER, EVENTS.ComputeFailed, e);
        }
    }

    harvestablesDrawing.invalidate(context, harvestablesHandler.harvestableList);

    mobsDrawing.invalidate(context, mobsHandler.mobsList, mobsHandler.mistList);
    chestsDrawing.invalidate(context, chestsHandler.chestsList);
    wispCageDrawing.Draw(context, wispCageHandler.cages);
    fishingDrawing.Draw(context, fishingHandler.fishes);
    dungeonsDrawing.Draw(context, dungeonsHandler.dungeonList);
    playersDrawing.invalidate(context, playersHandler.playersInRange);

    // Draw cluster info boxes on top of all elements if any
    if (__clustersForInfo && __clustersForInfo.length) {
        for (const cluster of __clustersForInfo) {
            try {
                if (drawingUtils && typeof drawingUtils.drawClusterInfoBox === 'function') {
                    drawingUtils.drawClusterInfoBox(context, cluster);
                } else if (drawingUtils && typeof drawingUtils.drawClusterIndicatorFromCluster === 'function') {
                    // fallback: draw both (legacy)
                    drawingUtils.drawClusterIndicatorFromCluster(context, cluster);
                }
            } catch (e) {
                // ❌ ERROR (toujours loggé) - Erreur critique de rendu de cluster
                window.logger?.error(CATEGORIES.CLUSTER, EVENTS.DrawInfoBoxFailed, e);
            }
        }
    }

    // Flash
    if (settings.settingFlash && flashTime >= 0)
    {
        contextFlash.rect(0, 0, 500, 500);
        contextFlash.rect(20, 20, 460, 460);

        contextFlash.fillStyle = 'red';
        contextFlash.fill('evenodd');
    }
}


var previousTime = performance.now();

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}



function update() {

    const currentTime = performance.now();
    const deltaTime = currentTime - previousTime;
    const t = Math.min(1, deltaTime / 100);

    // 🐛 DEBUG: Log local player position every 5 seconds
    if (!window.__lastLpXLogTime || (currentTime - window.__lastLpXLogTime) > 5000) {
        window.logger?.info(CATEGORIES.PLAYER, 'LocalPlayerPosition', {
            lpX,
            lpY,
            localPlayerId: window.__localPlayerId,
            isInitialized: window.__lpXInitialized || false,
            note: 'Current lpX/lpY values'
        });
        window.__lastLpXLogTime = currentTime;
    }

    if (settings.showMapBackground)
        mapsDrawing.interpolate(map, lpX, lpY, t);

    harvestablesHandler.removeNotInRange(lpX, lpY);
    harvestablesDrawing.interpolate(harvestablesHandler.harvestableList, lpX, lpY, t);


    mobsDrawing.interpolate(mobsHandler.mobsList, mobsHandler.mistList, lpX, lpY, t);


    chestsDrawing.interpolate(chestsHandler.chestsList, lpX, lpY, t);
    wispCageDrawing.Interpolate(wispCageHandler.cages, lpX, lpY, t);
    fishingDrawing.Interpolate(fishingHandler.fishes, lpX, lpY, t);
    dungeonsDrawing.interpolate(dungeonsHandler.dungeonList, lpX, lpY, t);
    playersDrawing.interpolate(playersHandler.playersInRange, lpX, lpY, t);

    // Flash
    if (flashTime >= 0)
    {
        flashTime -= t;
    }

    previousTime = currentTime;
}

function drawItems() {

    contextItems.clearRect(0, 0, canvasItems.width, canvasItems.height);

    if (settings.settingItems)
    {
        playersDrawing.drawItems(contextItems, canvasItems, playersHandler.playersInRange, settings.settingItemsDev);
    }

}
const intervalItems = 500;
setInterval(drawItems, intervalItems);

function checkLocalStorage()
{
    settings.update(settings);
    setDrawingViews();
}

const interval = 300;
setInterval(checkLocalStorage, interval)



document.getElementById("button").addEventListener("click", function () {
    ClearHandlers();
});

function ClearHandlers()
{
    chestsHandler.chestsList = [];
    dungeonsHandler.dungeonList = [];
    fishingHandler.Clear();
    harvestablesHandler.Clear();
    mobsHandler.Clear();
    playersHandler.Clear();
    wispCageHandler.CLear();
}

setDrawingViews();

function setDrawingViews() {
    const mainWindowMarginXValue = localStorage.getItem("mainWindowMarginX");
    const mainWindowMarginYValue = localStorage.getItem("mainWindowMarginY");
    const itemsWindowMarginXValue = localStorage.getItem("itemsWindowMarginX");
    const itemsWindowMarginYValue = localStorage.getItem("itemsWindowMarginY");
    const settingItemsBorderValue = localStorage.getItem("settingItemsBorder");
    const buttonMarginXValue = localStorage.getItem("buttonMarginX");
    const buttonMarginYValue = localStorage.getItem("buttonMarginY");

    const itemsWidthValue = localStorage.getItem("itemsWidth");
    const itemsHeightValue = localStorage.getItem("itemsHeight");

    // Check if the values exist in local storage and handle them
    if (mainWindowMarginXValue !== null) {
        document.getElementById('bottomCanvas').style.left = mainWindowMarginXValue + "px";
        document.getElementById('drawCanvas').style.left = mainWindowMarginYValue + "px";
    }

    if (mainWindowMarginYValue !== null) {
        document.getElementById('drawCanvas').style.top = mainWindowMarginYValue + "px";
        document.getElementById('bottomCanvas').style.top = mainWindowMarginYValue + "px";
    }

    if (itemsWindowMarginXValue !== null) {
        document.getElementById('thirdCanvas').style.left = itemsWindowMarginXValue + "px";
    }

    if (itemsWindowMarginYValue !== null) {
        document.getElementById('thirdCanvas').style.top = itemsWindowMarginYValue + "px";
    }

    if (itemsWidthValue !== null) {
        document.getElementById('thirdCanvas').style.width = itemsWidthValue + "px";
    }

    if (itemsHeightValue !== null) {
        document.getElementById('thirdCanvas').style.height = itemsHeightValue + "px";
    }

    if (settingItemsBorderValue !== null) {
        // Apply border based on the settingItemsBorderValue
        if (settingItemsBorderValue === "true") {

            document.getElementById('thirdCanvas').style.border = "2px solid grey";
        } else {

            document.getElementById('thirdCanvas').style.border = "none";
        }
    }

    if (buttonMarginXValue !== null) {
        document.getElementById('button').style.left = buttonMarginXValue + "px";
    }

    if (buttonMarginYValue !== null) {
        document.getElementById('button').style.top = buttonMarginYValue + "px";
    }



}