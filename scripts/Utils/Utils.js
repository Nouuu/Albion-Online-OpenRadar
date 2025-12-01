import {PlayersDrawing} from '../Drawings/PlayersDrawing.js';
import {HarvestablesDrawing} from '../Drawings/HarvestablesDrawing.js';
import {MobsDrawing} from '../Drawings/MobsDrawing.js';
import {ChestsDrawing} from '../Drawings/ChestsDrawing.js';
import {DungeonsDrawing} from '../Drawings/DungeonsDrawing.js';
import {MapDrawing} from '../Drawings/MapsDrawing.js';
import {WispCageDrawing} from '../Drawings/WispCageDrawing.js';
import {FishingDrawing} from '../Drawings/FishingDrawing.js';

import {HarvestablesDatabase} from '../Data/HarvestablesDatabase.js';
import { EventCodes } from './EventCodes.js';
import { ItemsDatabase } from '../Data/ItemsDatabase.js';
import { SpellsDatabase } from '../Data/SpellsDatabase.js';
import { HarvestablesDatabase } from '../Data/HarvestablesDatabase.js';

import {PlayersHandler} from '../Handlers/PlayersHandler.js';
import {WispCageHandler} from '../Handlers/WispCageHandler.js';
import {FishingHandler} from '../Handlers/FishingHandler.js';
import {MobsHandler} from '../Handlers/MobsHandler.js';
import {ChestsHandler} from '../Handlers/ChestsHandler.js';
import {HarvestablesHandler} from '../Handlers/HarvestablesHandler.js';
import {MapH} from '../Handlers/Map.js';

import imageCache from './ImageCache.js';
import {DrawingUtils} from './DrawingUtils.js';
import {DungeonsHandler} from "../Handlers/DungeonsHandler.js";
import {ItemsInfo} from "../Handlers/ItemsInfo.js";
import {MobsInfo} from "../Handlers/MobsInfo.js";
import {CATEGORIES, EVENTS} from "../constants/LoggerConstants.js";
import {createRadarRenderer} from './RadarRenderer.js';
import settingsSync from './SettingsSync.js';

// ✅ Canvas check for RadarRenderer initialization
const canvas = document.getElementById("drawCanvas");
const context = canvas ? canvas.getContext("2d") : null;

console.log('🔧 [Utils.js] Module loaded');


console.log('🔧 [Utils.js] Settings initialized (logger is managed by LoggerClient.js)');

// 📊 Initialize Items Database
const itemsDatabase = new ItemsDatabase();
(async () => {
    await itemsDatabase.load('/ao-bin-dumps/items.json');
    window.itemsDatabase = itemsDatabase; // Expose globally for handlers
    console.log('📊 [Utils.js] Items database loaded and ready');
})();

// 📊 Initialize Spells Database
const spellsDatabase = new SpellsDatabase();
(async () => {
    await spellsDatabase.load('/ao-bin-dumps/spells.json');
    window.spellsDatabase = spellsDatabase; // Expose globally for handlers
    console.log('✨ [Utils.js] Spells database loaded and ready');
})();

// 📊 Initialize Harvestables Database
const harvestablesDatabase = new HarvestablesDatabase();
(async () => {
    try {
        await harvestablesDatabase.load('/ao-bin-dumps/harvestables.json');
        window.harvestablesDatabase = harvestablesDatabase; // Expose globally for handlers
        console.log('🌾 [Utils.js] Harvestables database loaded and ready');
    } catch (error) {
        window.logger?.error(
            window.CATEGORIES?.ITEM_DATABASE || 'ITEM_DATABASE',
            'HarvestablesDatabaseInitFailed',
            {
                error: error.message,
                fallback: 'Using event-driven detection only'
            }
        );
        console.error('❌ [Utils.js] Failed to load Harvestables database:', error);
    }
})();

console.log('🔧 [Utils.js] Items, Spells & Harvestables databases initialization started (async)');

const harvestablesDrawing = new HarvestablesDrawing();
const dungeonsHandler = new DungeonsHandler();

var itemsInfo = new ItemsInfo();
var mobsInfo = new MobsInfo();

itemsInfo.initItems();
mobsInfo.initMobs();


var map = new MapH(-1);
const mapsDrawing = new MapDrawing();

// 🔄 Restore map from sessionStorage if available
(function restoreMapFromSession() {
    try {
        const savedMap = sessionStorage.getItem('lastMapDisplayed');
        window.logger?.debug(CATEGORIES.MAP, 'SessionRestoreAttempt', {
            hasData: !!savedMap,
            rawData: savedMap
        });

        if (savedMap) {
            const data = JSON.parse(savedMap);

            // Validate data structure (mapId can be string or number)
            if (data.mapId !== undefined && data.mapId !== null && data.mapId !== -1) {
                map.id = data.mapId;
                map.hX = data.hX || 0;
                map.hY = data.hY || 0;
                map.isBZ = data.isBZ || false;

                window.logger?.info(CATEGORIES.MAP, 'MapRestoredFromSession', {
                    mapId: map.id,
                    mapIdType: typeof map.id,
                    age: Date.now() - (data.timestamp || 0)
                });
            } else {
                window.logger?.debug(CATEGORIES.MAP, 'SessionMapInvalid', {
                    mapId: data.mapId,
                    mapIdType: typeof data.mapId,
                    reason: 'mapId is undefined, null, or -1'
                });
            }
        }
    } catch (e) {
        window.logger?.warn(CATEGORIES.MAP, 'SessionRestoreFailed', { error: e?.message });
    }
})();

const chestsHandler = new ChestsHandler();
const mobsHandler = new MobsHandler();
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
            const entries = settingsSync.getJSON('cachedStaticResourceTypeIDs');
            if (!entries) {
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


const harvestablesHandler = new HarvestablesHandler(mobsHandler); // 🔗 Pass MobsHandler reference
const playersHandler = new PlayersHandler();


// 📊 Expose handlers globally for statistics and debug access
window.harvestablesHandler = harvestablesHandler;
window.mobsHandler = mobsHandler;

const wispCageHandler = new WispCageHandler();
const wispCageDrawing = new WispCageDrawing();

const fishingHandler = new FishingHandler();
const fishingDrawing = new FishingDrawing();

const chestsDrawing = new ChestsDrawing();
const mobsDrawing = new MobsDrawing();
const playersDrawing = new PlayersDrawing();
const dungeonsDrawing = new DungeonsDrawing();
playersDrawing.updateItemsInfo(itemsInfo.iteminfo);

// 👥 Full player list UI update (called periodically to refresh timestamps)
function updatePlayersList() {
    const playersListElement = document.getElementById('playersList');

    if (playersListElement) {
        const players = playersHandler.playersList;

        if (players.length === 0) {
            playersListElement.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 italic">No players detected yet...</p>';
        } else {
            // Sort by detection time (newest first) - already limited in PlayersHandler
            playersListElement.innerHTML = players.map(player => {
                const elapsedMs = Date.now() - player.detectedAt;
                const elapsedSec = Math.floor(elapsedMs / 1000);
                const timeStr = elapsedSec < 60
                    ? `${elapsedSec}s ago`
                    : `${Math.floor(elapsedSec / 60)}m ago`;

                // Guild & Alliance (lighter colors for readability)
                const guildStr = player.guildName ? `<span class="text-yellow-700t dark:text-yellow-200 font-semibold">[${player.guildName}]</span>` : '<span class="text-gray-500 dark:text-gray-400 text-xs italic">No Guild</span>';
                const allianceStr = player.allianceName ? `<span class="text-purple-700 dark:text-purple-200 font-semibold">&lt;${player.allianceName}&gt;</span>` : '';

                // Faction
                const factionStr = player.factionName ? `<span class="text-blue-500 dark:text-blue-400 text-xs font-medium">⚔️ ${player.factionName}</span>` : '';

                // Equipment details with item icons and names
                let equipDetailsStr = '';
                if (Array.isArray(player.equipments) && player.equipments.length > 0 && window.itemsDatabase) {
                    const validEquipments = player.equipments
                        .map((itemId, index) => ({ itemId, index }))
                        .filter(({itemId, index}) => (index <= 4 || index === 8) && itemId && itemId > 0);

                    if (validEquipments.length > 0) {
                        const itemsList = validEquipments.map(({itemId}) => {
                            const item = window.itemsDatabase.getItemById(itemId);
                            if (item) {
                                const tierStr = item.tier > 0 ? `T${item.tier}` : '';
                                const enchantStr = item.enchant > 0 ? `.${item.enchant}` : '';
                                const ipStr = item.itempower > 0 ? `${item.itempower}` : '';

                                // Extract base item name (without @enchant suffix)
                                const baseName = item.name.split('@')[0];
                                const iconPath = `/images/Items/${baseName}.png`;

                                // 🔄 Check if image is already loaded in cache before displaying
                                const preloadedImage = imageCache.GetPreloadedImage(iconPath, "Items");

                                let imgHtml = '';
                                if (preloadedImage) {
                                    // Image loaded successfully - display it
                                    imgHtml = `<img src="${iconPath}" alt="${baseName}" class="w-8 h-8 object-contain">`;
                                } else if (preloadedImage === undefined) {
                                    // Not loaded yet - preload in background, show placeholder
                                    imageCache.preloadImageAndAddToList(iconPath, "Items").catch(() => {});
                                    imgHtml = '<div class="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>';
                                }
                                // else preloadedImage === null (404) -> don't display, don't retry

                                const tooltipText = `${baseName} - ${tierStr}${enchantStr} - IP: ${ipStr}`;
                                return `
                                    <div class="inline-flex items-center gap-2 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600" title="${tooltipText}">
                                        ${imgHtml}
                                        <span class="text-xs font-semibold text-gray-900 dark:text-gray-100">${tierStr}${enchantStr}</span>
                                        <span class="text-xs text-orange-700 dark:text-orange-300 font-bold">IP ${ipStr}</span>
                                    </div>
                                `;
                            }
                            return '';
                        }).filter(s => s).join(' ');

                        equipDetailsStr = `<div class="mt-3"><div class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">🛡️ Equipment:</div><div class="flex flex-wrap gap-2">${itemsList}</div></div>`;
                    }
                }

                // Spells details with icons (passive abilities from equipment)
                let spellDetailsStr = '';
                if (Array.isArray(player.spells) && player.spells.length > 0 && window.spellsDatabase) {
                    // Filter: Remove empty slots (0, 65535) and keep only valid spell indices
                    const validSpells = player.spells.filter(spellId => spellId && spellId > 0 && spellId !== 65535);

                    if (validSpells.length > 0) {
                        const spellsList = validSpells.map(spellIndex => {
                            const spell = window.spellsDatabase.getSpellByIndex(spellIndex);
                            if (spell) {
                                // Use uisprite for icon, fallback to generic spell icon
                                const iconName = spell.uiSprite || 'SPELL_GENERIC';
                                const iconPath = `/images/Spells/${iconName}.png`;
                                const tooltipText = spell.uniqueName;

                                // 🔄 Check cache before displaying spell icon
                                const preloadedSpell = imageCache.GetPreloadedImage(iconPath, "Items");

                                let spellImgHtml = '';
                                if (preloadedSpell) {
                                    // Spell icon loaded successfully
                                    spellImgHtml = `<img src="${iconPath}" alt="${spell.uniqueName}" class="w-8 h-8 object-contain">`;
                                } else if (preloadedSpell === undefined) {
                                    // Not loaded yet - preload in background
                                    imageCache.preloadImageAndAddToList(iconPath, "Items").catch(() => {});
                                    spellImgHtml = '<div class="w-8 h-8 bg-purple-300 dark:bg-purple-600 rounded animate-pulse"></div>';
                                }
                                // else preloadedSpell === null (404) -> don't display

                                return `
                                    <div class="inline-flex items-center justify-center bg-purple-50 dark:bg-purple-900/30 p-1 rounded-md border border-purple-200 dark:border-purple-700" title="${tooltipText}">
                                        ${spellImgHtml}
                                    </div>
                                `;
                            }
                            return '';
                        }).filter(s => s).join(' ');

                        spellDetailsStr = `<div class="mt-3"><div class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">✨ Spells:</div><div class="flex flex-wrap gap-2">${spellsList}</div></div>`;
                    }
                }

                // Health bar (inline styles to guarantee colors)
                let healthStr = '';
                if (player.currentHealth > 0 && player.initialHealth > 0) {
                    const healthPercent = Math.round((player.currentHealth / player.initialHealth) * 100);
                    const healthColor = healthPercent > 60 ? '#22c55e' : (healthPercent > 30 ? '#eab308' : '#ef4444');
                    healthStr = `
                        <div class="mt-2.5">
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-gray-700 dark:text-gray-300 font-medium min-w-[25px]">HP:</span>
                                <div class="flex-1 h-3 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden border border-gray-400 dark:border-gray-500">
                                    <div class="h-full transition-all" style="width: ${healthPercent}%; background-color: ${healthColor};"></div>
                                </div>
                                <span class="text-xs text-gray-700 dark:text-gray-300 font-bold min-w-[40px] text-right">${healthPercent}%</span>
                            </div>
                        </div>
                    `;
                }

                // Mounted status (icon more visible)
                const mountedIcon = player.mounted ? '<span class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded font-medium">🐴 Mounted</span>' : '';

                // Average Item Power (ilvl) - more visible
                const avgItemPower = player.getAverageItemPower();
                const itemPowerStr = avgItemPower ? `<span class="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded font-bold">⚔️ ${avgItemPower}</span>` : '';

                return `
                    <div class="mb-3 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex-1 min-w-0">
                                <!-- Player Name & Mounted Status -->
                                <div class="flex items-center gap-2 mb-2">
                                    <p class="text-base font-bold text-gray-900 dark:text-white truncate">
                                        👤 ${player.nickname}
                                    </p>
                                    ${mountedIcon}
                                </div>

                                <!-- Guild & Alliance (separate line) -->
                                <div class="flex flex-wrap gap-2 mb-2">
                                    ${guildStr}
                                    ${allianceStr}
                                </div>

                                <!-- Faction & IP (separate line with spacing) -->
                                <div class="flex flex-wrap gap-2 items-center mb-2">
                                    ${factionStr}
                                    ${itemPowerStr}
                                </div>

                                <!-- Equipment & Spells Details -->
                                ${equipDetailsStr}
                                ${spellDetailsStr}

                                <!-- Health Bar -->
                                ${healthStr}
                            </div>

                            <!-- Timestamp -->
                            <div class="flex flex-col items-end gap-1">
                                <span class="text-xs text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">${timeStr}</span>
                                <span class="text-xs text-gray-500 dark:text-gray-500 font-mono">ID: ${player.id}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

let lpX = 0.0;
let lpY = 0.0;

// 🌍 Expose lpX/lpY globally for DEEP DEBUG access
window.lpX = lpX;
window.lpY = lpY;

const drawingUtils = new DrawingUtils();

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

// Helper function to get event name (for debugging)
function getEventName(eventCode) {
    const eventNames = {
        1: 'Leave',
        2: 'JoinFinished',
        3: 'Move',  // ✅ CORRECTED - Move = 3 according to EventCodes.js
        4: 'Teleport',
        5: 'ChangeEquipment',
        6: 'HealthUpdate',
        7: 'HealthUpdates',
        15: 'Damage',
        21: 'Request_Move',  // ⚠️ Probably a request (onRequest), not an event
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
        // Add others as you discover them
    };
    return eventNames[eventCode] || `Unknown_${eventCode}`;
}

function onEvent(Parameters)
{
    const id = parseInt(Parameters[0]);
    const eventCode = Parameters[252];

    // 📦 DEBUG RAW: Log all raw packets (very verbose, for deep debugging only)
    // Note: debugRawPacketsConsole controls console output, debugRawPacketsServer controls server logging
    window.logger?.debug(CATEGORIES.PACKET_RAW, `Event_${eventCode}`, {
        id,
        eventCode,
        allParameters: Parameters
    });

    // 🔍 DEBUG ALL EVENTS: Log event with details if debug enabled
    // Allows identifying patterns and parameter <-> event correspondence
    if (eventCode !== 91) { // Skip RegenerationHealthChanged as it's too verbose
        const paramDetails = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key) && key !== '252' && key !== '0') { // Skip eventCode and id already logged
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
    // Player moving - Operation 21 is for LOCAL PLAYER ONLY
    if (Parameters[253] == 21)
    {
        // ✅ Update lpX/lpY with EVERY Operation 21
        // Operation 21 is ONLY for local player position tracking
        if (Array.isArray(Parameters[1]) && Parameters[1].length === 2) {
            const location = Parameters[1];

            // Update local player position (RELATIVE coords)
            lpX = location[0];
            lpY = location[1];
            window.lpX = lpX;
            window.lpY = lpY;
            playersHandler.updateLocalPlayerPosition(lpX, lpY);

            // Sync with RadarRenderer
            if (radarRenderer) {
                radarRenderer.setLocalPlayerPosition(lpX, lpY);
            }

            // 📊 LOG: Local player position updated
            window.logger?.debug(CATEGORIES.PLAYER, 'Operation21_LocalPlayer', {
                lpX: lpX,
                lpY: lpY,
                note: '✅ Local player position updated via Operation 21'
            });
        }
        // Legacy Buffer handling (kept for compatibility)
        else if (Parameters[1] && Parameters[1].type === 'Buffer') {
            const uint8Array = new Uint8Array(Parameters[1].data);
            const dataView = new DataView(uint8Array.buffer);
            lpX = dataView.getFloat32(0, true);
            lpY = dataView.getFloat32(4, true);
            window.lpX = lpX;
            window.lpY = lpY;
            playersHandler.updateLocalPlayerPosition(lpX, lpY);

            // Sync with RadarRenderer
            if (radarRenderer) {
                radarRenderer.setLocalPlayerPosition(lpX, lpY);
            }
        }
        else {
            window.logger?.error(CATEGORIES.PLAYER, 'OnRequest_Move_UnknownFormat', {
                param1: Parameters[1],
                param1Type: typeof Parameters[1],
                note: '❌ Parameters[1] format unknown!'
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

        // Sync with RadarRenderer
        if (radarRenderer) {
            radarRenderer.setMap(map);
        }

        // 💾 Save to sessionStorage
        try {
            sessionStorage.setItem('lastMapDisplayed', JSON.stringify({
                mapId: map.id,
                hX: map.hX,
                hY: map.hY,
                isBZ: map.isBZ,
                timestamp: Date.now()
            }));
            window.logger?.debug(CATEGORIES.MAP, 'MapSavedToSession', { mapId: map.id });
        } catch (e) {
            window.logger?.warn(CATEGORIES.MAP, 'SessionStorageFailed', { error: e?.message });
        }
    }
    // All data on the player joining the map (us)
    else if (Parameters[253] == 2)
    {
        // 🔍 CRITICAL: Verify Parameters[9] format (Array vs Buffer)
        // const param9Type = Array.isArray(Parameters[9]) ? 'array' :
        //                   (Parameters[9]?.type === 'Buffer' ? 'buffer' : typeof Parameters[9]);

        // If Buffer, decode it (browser-compatible)
        if (Parameters[9] && Parameters[9].type === 'Buffer') {
            const uint8Array = new Uint8Array(Parameters[9].data);
            const dataView = new DataView(uint8Array.buffer);
            lpX = dataView.getFloat32(0, true);  // little-endian
            lpY = dataView.getFloat32(4, true);
            window.lpX = lpX;  // Sync global
            window.lpY = lpY;

            // ✅ Sync playersHandler.localPlayer with lpX/lpY
            playersHandler.updateLocalPlayerPosition(lpX, lpY);

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

            // ✅ Sync playersHandler.localPlayer with lpX/lpY
            playersHandler.updateLocalPlayerPosition(lpX, lpY);

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

// 🎨 Initialize RadarRenderer (unified rendering system)
let radarRenderer = null;

// Debug: Check canvas availability
window.logger?.info(CATEGORIES.MAP, 'CanvasCheck', {
    hasCanvas: !!canvas,
    hasContext: !!context,
    canvasId: canvas?.id || 'none',
    note: 'Checking canvas availability for RadarRenderer'
});

// Only initialize RadarRenderer if canvas elements exist (drawing page)
if (canvas && context) {
    radarRenderer = createRadarRenderer('main', {
        handlers: {
            harvestablesHandler,
            mobsHandler,
            playersHandler,
            chestsHandler,
            dungeonsHandler,
            wispCageHandler,
            fishingHandler
        },
        drawings: {
            mapsDrawing,
            harvestablesDrawing,
            mobsDrawing,
            playersDrawing,
            chestsDrawing,
            dungeonsDrawing,
            wispCageDrawing,
            fishingDrawing
        },
        drawingUtils
    });

    radarRenderer.initialize();
    radarRenderer.setMap(map);

    // Expose globally for debugging
    window.radarRenderer = radarRenderer;

    // ✨ START THE NEW UNIFIED RENDERING SYSTEM
    radarRenderer.start();

    window.logger?.info(CATEGORIES.MAP, 'RadarRendererStarted', {
        note: '✅ New unified RadarRenderer is now active!'
    });
} else {
    // ❌ NO CANVAS - Cannot initialize radar (should only happen on non-radar pages)
    window.logger?.error(CATEGORIES.MAP, 'NoCanvasFound', {
        note: 'Canvas elements not found - radar cannot be initialized',
        hasCanvas: !!canvas,
        hasContext: !!context
    });
}

// 👥 Update player list UI every 5 seconds (for timestamp refresh)
setInterval(updatePlayersList, 5000);



document.getElementById("button")?.addEventListener("click", function () {
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
    wispCageHandler.Clear();
    // 🗑️ Clear session map cache
    try {
        sessionStorage.removeItem('lastMapDisplayed');
        window.logger?.debug(CATEGORIES.MAP, 'SessionMapCleared');
    } catch (e) {
        window.logger?.warn(CATEGORIES.MAP, 'SessionStorageClearFailed', { error: e?.message });
    }
}