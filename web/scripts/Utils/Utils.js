import {PlayersDrawing} from '../Drawings/PlayersDrawing.js';
import {HarvestablesDrawing} from '../Drawings/HarvestablesDrawing.js';
import {MobsDrawing} from '../Drawings/MobsDrawing.js';
import {ChestsDrawing} from '../Drawings/ChestsDrawing.js';
import {DungeonsDrawing} from '../Drawings/DungeonsDrawing.js';
import {MapDrawing} from '../Drawings/MapsDrawing.js';
import {WispCageDrawing} from '../Drawings/WispCageDrawing.js';
import {FishingDrawing} from '../Drawings/FishingDrawing.js';

import {HarvestablesDatabase} from '../Data/HarvestablesDatabase.js';
import {MobsDatabase} from '../Data/MobsDatabase.js';
import zonesDatabase from '../Data/ZonesDatabase.js';
// LocalizationDatabase removed - 86MB file, only used for mob name translation
// import {LocalizationDatabase} from '../Data/LocalizationDatabase.js';
import {EventCodes} from './EventCodes.js';
import {ItemsDatabase} from '../Data/ItemsDatabase.js';
import {SpellsDatabase} from '../Data/SpellsDatabase.js';

import {PlayersHandler} from '../Handlers/PlayersHandler.js';
import {WispCageHandler} from '../Handlers/WispCageHandler.js';
import {FishingHandler} from '../Handlers/FishingHandler.js';
import {MobsHandler} from '../Handlers/MobsHandler.js';
import {ChestsHandler} from '../Handlers/ChestsHandler.js';
import {HarvestablesHandler} from '../Handlers/HarvestablesHandler.js';
import {MapH} from '../Handlers/Map.js';

import {DrawingUtils} from './DrawingUtils.js';
import {DungeonsHandler} from "../Handlers/DungeonsHandler.js";
import {ItemsInfo} from "../Handlers/ItemsInfo.js";
import {CATEGORIES, EVENTS} from "../constants/LoggerConstants.js";
import {createRadarRenderer} from './RadarRenderer.js';
import {destroyEventQueue, getEventQueue} from './WebSocketEventQueue.js';

// MODULE STATE - Controlled by init/destroy
let isInitialized = false;
let radarRenderer = null;
let socket = null;
let reconnectTimeoutId = null;
let reconnectAttempts = 0;
let eventQueue = null;
let playerListIntervalId = null;
let cleanupIntervalId = null;

// Handlers (recreated on each init)
let harvestablesHandler = null;
let mobsHandler = null;
let playersHandler = null;
let chestsHandler = null;
let dungeonsHandler = null;
let wispCageHandler = null;
let fishingHandler = null;

// Drawings (recreated on each init)
let harvestablesDrawing = null;
let mobsDrawing = null;
let playersDrawing = null;
let chestsDrawing = null;
let dungeonsDrawing = null;
let wispCageDrawing = null;
let fishingDrawing = null;
let mapsDrawing = null;

// Utilities (recreated on each init)
let drawingUtils = null;
let itemsInfo = null;
let map = null;

// 📊 Global database state tracking
window.databasesReady = false;
window.databaseLoadingProgress = {
    items: false,
    spells: false,
    harvestables: false,
    mobs: false,
    zones: false,
    localization: false
};

// 🔄 Retry logic with exponential backoff
async function loadDatabaseWithRetry(database, path, name, ...extraArgs) {
    const MAX_RETRIES = 3;
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
        try {
            await database.load(path, ...extraArgs);
            console.log(`✅ [Utils.js] ${name} database loaded successfully`);
            return { success: true, database };
        } catch (error) {
            retryCount++;
            const isLastAttempt = retryCount >= MAX_RETRIES;

            console.error(`❌ [Utils.js] Failed to load ${name} database (attempt ${retryCount}/${MAX_RETRIES})`, error);

            window.logger?.error(
                window.CATEGORIES?.ITEM_DATABASE || 'ITEM_DATABASE',
                `${name}DatabaseLoadFailed`,
                {
                    error: error.message,
                    attempt: retryCount,
                    maxRetries: MAX_RETRIES,
                    isLastAttempt
                }
            );

            if (isLastAttempt) {
                return { success: false, error, name };
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = 1000 * Math.pow(2, retryCount - 1);
            console.log(`⏳ [Utils.js] Retrying ${name} database in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// ⚠️ Error notification UI
function showDatabaseError(databaseName, error) {
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
        <div class="error-content">
            <h3>⚠️ Database Loading Failed</h3>
            <p>Unable to load <strong>${databaseName}</strong> database.</p>
            <p class="error-details">${error.message}</p>
            <div class="error-actions">
                <button onclick="location.reload()">Reload Page</button>
                <button onclick="this.parentElement.parentElement.parentElement.remove()">
                    Continue Anyway
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
}

// 🚀 Coordinated database initialization
async function initializeDatabases() {
    // Skip if already loaded (cached)
    if (window.databasesReady &&
        window.itemsDatabase &&
        window.spellsDatabase &&
        window.harvestablesDatabase &&
        window.mobsDatabase) {
        window.logger?.info(CATEGORIES.DEBUG, 'DatabasesCached', {});
        return;
    }

    console.log('🔧 [Utils.js] Starting coordinated database initialization...');

    const itemsDatabase = new ItemsDatabase();
    const spellsDatabase = new SpellsDatabase();
    const harvestablesDatabase = new HarvestablesDatabase();
    const mobsDatabase = new MobsDatabase();
    // LocalizationDatabase removed - 86MB file, saves ~200-400MB RAM
    // Mob names will show technical names (namelocatag) instead of translated names

    const promises = [
        loadDatabaseWithRetry(itemsDatabase, '/ao-bin-dumps/items.json', 'Items')
            .then(result => {
                if (result.success) {
                    window.databaseLoadingProgress.items = true;
                    window.itemsDatabase = result.database;
                }
                return result;
            }),

        loadDatabaseWithRetry(spellsDatabase, '/ao-bin-dumps/spells.json', 'Spells')
            .then(result => {
                if (result.success) {
                    window.databaseLoadingProgress.spells = true;
                    window.spellsDatabase = result.database;
                }
                return result;
            }),

        loadDatabaseWithRetry(harvestablesDatabase, '/ao-bin-dumps/harvestables.json', 'Harvestables')
            .then(result => {
                if (result.success) {
                    window.databaseLoadingProgress.harvestables = true;
                    window.harvestablesDatabase = result.database;
                }
                return result;
            }),

        loadDatabaseWithRetry(mobsDatabase, '/ao-bin-dumps/mobs.json', 'Mobs')
            .then(result => {
                if (result.success) {
                    window.databaseLoadingProgress.mobs = true;
                    window.mobsDatabase = result.database;
                }
                return result;
            }),

        loadDatabaseWithRetry(zonesDatabase, '/ao-bin-dumps/zones.json', 'Zones')
            .then(result => {
                if (result.success) {
                    window.databaseLoadingProgress.zones = true;
                    window.zonesDatabase = zonesDatabase;
                }
                return result;
            })
    ];

    const results = await Promise.all(promises);

    // Check for failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
        console.error(`❌ [Utils.js] ${failures.length} database(s) failed to load:`, failures);

        // Show error notification for each failed database
        failures.forEach(failure => {
            showDatabaseError(failure.name, failure.error);
        });
    }

    // Mark as ready even if some databases failed (graceful degradation)
    window.databasesReady = true;

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ [Utils.js] Database initialization complete: ${successCount}/${results.length} loaded successfully`);

    window.logger?.info(
        window.CATEGORIES?.ITEM_DATABASE || 'ITEM_DATABASE',
        'DatabasesInitComplete',
        {
            totalDatabases: results.length,
            successCount,
            failureCount: failures.length,
            progress: window.databaseLoadingProgress
        }
    );

    // Dispatch custom event for components that need to wait for databases
    window.dispatchEvent(new CustomEvent('databasesReady', {
        detail: {
            successCount,
            failures: failures.map(f => f.name)
        }
    }));
}

// MOVED TO initRadar() - databases loaded on demand
// initializeDatabases().catch(error => {
//     console.error('❌ [Utils.js] Critical error during database initialization:', error);
//     window.logger?.error(
//         window.CATEGORIES?.ITEM_DATABASE || 'ITEM_DATABASE',
//         'DatabaseInitCriticalError',
//         { error: error.message }
//     );
//     showDatabaseError('System', error);
// });

// Stale entity cleanup function
const STALE_ENTITY_MAX_AGE = 300000;

function cleanupStaleEntities() {
    const cleanedPlayers = playersHandler?.cleanupStaleEntities?.(STALE_ENTITY_MAX_AGE) || 0;
    const cleanedMobs = mobsHandler?.cleanupStaleEntities?.(STALE_ENTITY_MAX_AGE) || 0;
    const cleanedHarvestables = harvestablesHandler?.cleanupStaleEntities?.(STALE_ENTITY_MAX_AGE) || 0;

    const activePlayerIds = new Set(playersHandler?.getFilteredPlayers?.().map(p => p.id) || []);
    let cleanedRenderCache = 0;
    for (const id of lastRenderedPlayerIds.keys()) {
        if (!activePlayerIds.has(id)) {
            lastRenderedPlayerIds.delete(id);
            cleanedRenderCache++;
        }
    }

    if (cleanedPlayers || cleanedMobs || cleanedHarvestables || cleanedRenderCache) {
        window.logger?.debug(CATEGORIES.DEBUG, 'StaleEntityCleanup', {
            players: cleanedPlayers, mobs: cleanedMobs,
            harvestables: cleanedHarvestables, renderCache: cleanedRenderCache
        });
    }
}

// PUBLIC API - Called by PageController
export async function initRadar() {
    if (isInitialized) {
        window.logger?.warn(CATEGORIES.DEBUG, 'RadarAlreadyInitialized', {});
        return;
    }

    window.logger?.info(CATEGORIES.DEBUG, 'RadarInitializing', {});

    try {
        await initializeDatabases();

        drawingUtils = new DrawingUtils();
        itemsInfo = new ItemsInfo();
        itemsInfo.initItems();
        map = new MapH(-1);

        restoreMapFromSession();

        dungeonsHandler = new DungeonsHandler();
        chestsHandler = new ChestsHandler();
        mobsHandler = new MobsHandler();
        harvestablesHandler = new HarvestablesHandler(mobsHandler);
        playersHandler = new PlayersHandler();
        wispCageHandler = new WispCageHandler();
        fishingHandler = new FishingHandler();

        mapsDrawing = new MapDrawing();
        harvestablesDrawing = new HarvestablesDrawing();
        mobsDrawing = new MobsDrawing();
        playersDrawing = new PlayersDrawing();
        chestsDrawing = new ChestsDrawing();
        dungeonsDrawing = new DungeonsDrawing();
        wispCageDrawing = new WispCageDrawing();
        fishingDrawing = new FishingDrawing();

        playersDrawing.updateItemsInfo(itemsInfo.iteminfo);

        window.harvestablesHandler = harvestablesHandler;
        window.mobsHandler = mobsHandler;
        window.playersHandler = playersHandler;

        connectWebSocket();

        eventQueue = getEventQueue();
        eventQueue.setFlushCallback((messageType, params) => {
            switch (messageType) {
                case 'request':
                    onRequest(params);
                    break;
                case 'event':
                    onEvent(params);
                    break;
                case 'response':
                    onResponse(params);
                    break;
            }
        });

        initializeRadarRenderer();

        playerListIntervalId = setInterval(updatePlayersList, 1500);
        cleanupIntervalId = setInterval(cleanupStaleEntities, 60000);

        document.getElementById("button")?.addEventListener("click", ClearHandlers);

        isInitialized = true;
        window.logger?.info(CATEGORIES.DEBUG, 'RadarInitialized', {});

    } catch (error) {
        window.logger?.error(CATEGORIES.DEBUG, 'RadarInitFailed', {error: error.message});
        if (window.toast) window.toast.error('Failed to initialize radar');
        throw error;
    }
}

export function destroyRadar() {
    if (!isInitialized) {
        window.logger?.warn(CATEGORIES.DEBUG, 'RadarNotInitialized', {});
        return;
    }

    window.logger?.info(CATEGORIES.DEBUG, 'RadarDestroying', {});

    if (playerListIntervalId) {
        clearInterval(playerListIntervalId);
        playerListIntervalId = null;
    }
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
    }

    if (radarRenderer) {
        radarRenderer.stop();
        radarRenderer = null;
    }

    destroyEventQueue();
    eventQueue = null;

    cleanupSocket();
    ClearHandlers();

    harvestablesHandler = null;
    mobsHandler = null;
    playersHandler = null;
    chestsHandler = null;
    dungeonsHandler = null;
    wispCageHandler = null;
    fishingHandler = null;

    harvestablesDrawing = null;
    mobsDrawing = null;
    playersDrawing = null;
    chestsDrawing = null;
    dungeonsDrawing = null;
    wispCageDrawing = null;
    fishingDrawing = null;
    mapsDrawing = null;

    drawingUtils = null;
    itemsInfo = null;
    map = null;

    window.harvestablesHandler = null;
    window.mobsHandler = null;
    window.playersHandler = null;
    window.radarRenderer = null;

    _playerElements = null;
    _lastPlayerCounts = {hostile: -1, faction: -1, passive: -1};
    lastRenderedPlayerIds.clear();

    lpX = 0.0;
    lpY = 0.0;
    window.lpX = 0;
    window.lpY = 0;

    isInitialized = false;
    window.logger?.info(CATEGORIES.DEBUG, 'RadarDestroyed', {});
}

// === LEGACY CODE BELOW - Commented out for PageController ===
// All initialization now happens in initRadar()

// harvestablesDrawing = new HarvestablesDrawing();
// dungeonsHandler = new DungeonsHandler();
// itemsInfo = new ItemsInfo();
// itemsInfo.initItems();
// map = new MapH(-1);
// mapsDrawing = new MapDrawing();

// 🛡️ Debounce map changes to prevent flickering from duplicate/retransmitted packets
let lastMapChangeTime = 0;
const MAP_CHANGE_DEBOUNCE_MS = 500; // Ignore map changes within 500ms of the previous one

// 🔄 Restore map from sessionStorage if available
function restoreMapFromSession() {
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
                window.currentMapId = map.id; // Expose for zone-aware features

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
}

// chestsHandler = new ChestsHandler();
// mobsHandler = new MobsHandler();
// window.addEventListener('load', () => { ... });
// harvestablesHandler = new HarvestablesHandler(mobsHandler);
// playersHandler = new PlayersHandler();
// window.harvestablesHandler = harvestablesHandler;
// window.mobsHandler = mobsHandler;
// window.playersHandler = playersHandler;
// console.log('[MemoryManager] Manual cleanup methods available on handlers');
// wispCageHandler = new WispCageHandler();
// wispCageDrawing = new WispCageDrawing();
// fishingHandler = new FishingHandler();
// fishingDrawing = new FishingDrawing();
// chestsDrawing = new ChestsDrawing();
// mobsDrawing = new MobsDrawing();
// playersDrawing = new PlayersDrawing();
// dungeonsDrawing = new DungeonsDrawing();
// playersDrawing.updateItemsInfo(itemsInfo.iteminfo);

// 👥 Player list rendering with incremental updates
let lastRenderedPlayerIds = new Map();

/**
 * Render a single player card HTML (Tailwind-only)
 * @param {Player} player - The player object
 * @param {string} threatType - 'hostile', 'faction', or 'passive' (based on zone context)
 */
function renderPlayerCard(player, threatType = null) {
    const elapsedMs = Date.now() - player.detectedAt;
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const timeStr = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m`;

    // Mounted state for styling
    const isMounted = player.mounted;

    // Guild & Alliance badges
    const guildBadge = player.guildName
        ? `<span class="text-[11px] font-mono font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20">[${player.guildName}]</span>`
        : '<span class="text-[10px] text-base-content/30 italic">No Guild</span>';
    const allianceBadge = player.allianceName
        ? `<span class="text-[11px] font-mono font-medium text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">&lt;${player.allianceName}&gt;</span>`
        : '';

    // Faction city name lookup
    const factionCityNames = ['', 'Martlock', 'Lymhurst', 'Bridgewatch', 'Fort Sterling', 'Thetford', 'Caerleon'];
    const factionCityName = player.isFactionPlayer?.() ? factionCityNames[player.faction] : null;

    // Average IP badge
    const avgItemPower = player.getAverageItemPower?.();
    const ipBadge = avgItemPower
        ? `<span class="text-[11px] font-mono font-bold text-warning bg-gradient-to-br from-warning/15 to-warning/5 px-2 py-0.5 rounded border border-warning/30">IP ${avgItemPower}</span>`
        : '';

    // Mounted badge
    const mountedBadge = isMounted
        ? `<span class="text-[9px] font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/25 uppercase tracking-wide">Mounted</span>`
        : '';

    // Player type badge - use threatType from zone context if provided, else fall back to player faction
    let playerTypeBadge = '';
    let playerTypeColor = 'error';
    const effectiveType = threatType || (player.isPassive?.() ? 'passive' : player.isFactionPlayer?.() ? 'faction' : 'hostile');

    if (effectiveType === 'passive') {
        playerTypeBadge = `<span class="text-[9px] font-mono font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/25 uppercase tracking-wide">Passive</span>`;
        playerTypeColor = 'success';
    } else if (effectiveType === 'faction') {
        const cityLabel = factionCityName ? `⚔ ${factionCityName}` : 'Faction';
        playerTypeBadge = `<span class="text-[9px] font-mono font-semibold text-info bg-info/10 px-1.5 py-0.5 rounded border border-info/25 uppercase tracking-wide">${cityLabel}</span>`;
        playerTypeColor = 'info';
    } else {
        playerTypeBadge = `<span class="text-[9px] font-mono font-semibold text-error bg-error/10 px-1.5 py-0.5 rounded border border-error/25 uppercase tracking-wide">Hostile</span>`;
    }

    // Equipment section - controlled by settingItems
    let equipHtml = '';
    if (window.settingsSync?.getBool('settingItems') && Array.isArray(player.equipments) && player.equipments.length > 0 && window.itemsDatabase) {
        const validEquipments = player.equipments
            .map((itemId, index) => ({ itemId, index }))
            .filter(({ itemId, index }) => (index <= 4 || index === 8) && itemId && itemId > 0);

        if (validEquipments.length > 0) {
            const items = validEquipments.map(({ itemId }) => {
                const item = window.itemsDatabase.getItemById(itemId);
                if (!item) return '';

                const tierStr = item.tier > 0 ? `T${item.tier}` : '';
                const enchantStr = item.enchant > 0 ? `.${item.enchant}` : '';
                const ipStr = item.itempower > 0 ? item.itempower : '';
                const baseName = item.name.split('@')[0];
                const iconPath = `/images/Items/${baseName}.webp`;

                // Server returns fallback for missing images, browser handles HTTP cache (24h)
                return `<div class="inline-flex items-center gap-1.5 bg-base-100/60 px-2 py-1 rounded hover:bg-base-100/80 transition-colors" title="${baseName} - ${tierStr}${enchantStr} - IP: ${ipStr}"><img src="${iconPath}" alt="${baseName}" class="w-6 h-6 object-contain drop-shadow-sm bg-base-200/50 rounded" loading="lazy"><span class="text-[10px] font-mono font-semibold text-base-content/80">${tierStr}${enchantStr}</span>${ipStr ? `<span class="text-[9px] font-mono font-bold text-warning">${ipStr}</span>` : ''}</div>`;
            }).filter(Boolean).join('');

            if (items) {
                equipHtml = `<div class="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-base-content/[0.03]">${items}</div>`;
            }
        }
    }

    // Spells section - controlled by settingShowSpells
    let spellsHtml = '';
    if (window.settingsSync?.getBool('settingShowSpells') && Array.isArray(player.spells) && player.spells.length > 0 && window.spellsDatabase) {
        const validSpells = player.spells.filter(id => id && id > 0 && id !== 65535);
        if (validSpells.length > 0) {
            const spells = validSpells.map(spellIndex => {
                const spell = window.spellsDatabase.getSpellByIndex(spellIndex);
                if (!spell) return '';

                // Server returns fallback for missing images, browser handles HTTP cache (24h)
                const iconPath = `/images/Spells/${spell.uiSprite || 'SPELL_GENERIC'}.webp`;
                return `<div class="flex items-center justify-center bg-primary/10 p-1.5 rounded hover:bg-primary/15 transition-all" title="${spell.uniqueName}"><img src="${iconPath}" alt="${spell.uniqueName}" class="w-5 h-5 object-contain bg-base-200/50 rounded" loading="lazy"></div>`;
            }).filter(Boolean).join('');

            if (spells) {
                spellsHtml = `<div class="flex flex-wrap gap-1.5 mt-3">${spells}</div>`;
            }
        }
    }

    // Health bar - controlled by settingShowPlayerHealthBar
    let healthHtml = '';
    if (window.settingsSync?.getBool('settingShowPlayerHealthBar') && player.currentHealth > 0 && player.initialHealth > 0) {
        const pct = Math.round((player.currentHealth / player.initialHealth) * 100);
        const colorClass = pct > 60 ? 'bg-gradient-to-r from-success to-green-500'
                         : pct > 30 ? 'bg-gradient-to-r from-warning to-amber-500'
                         : 'bg-gradient-to-r from-error to-red-500 animate-pulse';
        healthHtml = `<div class="flex items-center gap-2 mt-3"><div class="flex-1 h-1.5 bg-base-content/5 rounded-full overflow-hidden"><div data-health-bar class="h-full rounded-full transition-all duration-300 ${colorClass}" style="width: ${pct}%;"></div></div><span class="text-[10px] font-mono text-base-content/50 min-w-[2.5rem] text-right">${pct}%</span></div>`;
    }

    // ID display
    const idStr = `<div class="text-[10px] font-mono text-base-content/25 mt-3 pt-2 border-t border-base-content/[0.03]">ID: ${player.id}</div>`;

    // Build the card with proper structure - use player type color for accent bar
    const accentBarClass = `bg-${playerTypeColor}`;

    return `<div class="group relative p-4 pl-5 bg-gradient-to-br from-base-300 to-base-200 rounded-lg transition-all duration-200 hover:from-base-300/90 hover:to-base-200/90 hover:translate-x-0.5" data-player-id="${player.id}"><div class="absolute left-0 top-0 bottom-0 w-[3px] ${accentBarClass} opacity-90 group-hover:opacity-100 group-hover:w-1 transition-all"></div><div class="flex justify-between items-start gap-3"><div class="flex-1 min-w-0"><span class="block text-sm font-semibold text-base-content truncate">${player.nickname}</span><div class="flex flex-wrap items-center gap-1.5 mt-1">${guildBadge}${allianceBadge}</div></div><div class="flex flex-col items-end gap-1 shrink-0">${playerTypeBadge}<span data-time class="text-[10px] font-mono text-base-content/40">${timeStr}</span></div></div><div class="flex flex-wrap items-center gap-1.5 mt-2">${ipBadge}${mountedBadge}</div>${equipHtml}${spellsHtml}${healthHtml}${idStr}</div>`;
}

/**
 * Update a section's player list with incremental updates
 * @param {HTMLElement} listContainer - The container element
 * @param {Player[]} players - Array of players
 * @param {string} threatType - 'hostile', 'faction', or 'passive' (zone-aware type)
 */
function updateSectionPlayers(listContainer, players, threatType) {
    const currentIds = new Set(players.map(p => p.id));

    // Remove players no longer in this section
    listContainer.querySelectorAll('[data-player-id]').forEach(card => {
        const id = parseInt(card.dataset.playerId);
        if (!currentIds.has(id)) {
            card.remove();
            lastRenderedPlayerIds.delete(id);
        }
    });

    // Update or add players
    players.forEach(player => {
        const existingCard = listContainer.querySelector(`[data-player-id="${player.id}"]`);
        const lastRender = lastRenderedPlayerIds.get(player.id);

        if (existingCard && lastRender) {
            // Update timestamp
            const timeEl = existingCard.querySelector('[data-time]');
            if (timeEl) {
                const elapsedSec = Math.floor((Date.now() - player.detectedAt) / 1000);
                timeEl.textContent = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m`;
            }
            // Update health bar if changed
            if (player.currentHealth !== lastRender.health) {
                const healthBar = existingCard.querySelector('[data-health-bar]');
                if (healthBar && player.initialHealth > 0) {
                    const pct = Math.round((player.currentHealth / player.initialHealth) * 100);
                    healthBar.style.width = `${pct}%`;
                }
            }
        } else {
            // Create new card with zone-aware threat type
            const template = document.createElement('template');
            template.innerHTML = renderPlayerCard(player, threatType).trim();
            listContainer.appendChild(template.content.firstChild);
        }

        lastRenderedPlayerIds.set(player.id, { health: player.currentHealth });
    });
}

// Cache DOM references to avoid repeated lookups
let _playerElements = null;
let _lastPlayerCounts = { hostile: -1, faction: -1, passive: -1 };

function getPlayerListElements() {
    if (!_playerElements) {
        _playerElements = {
            container: document.getElementById('playersList'),
            // Stats component container
            playerStats: document.getElementById('playerStats'),
            // Stats component individual containers (for filtering visibility)
            statHostileContainer: document.getElementById('statHostileContainer'),
            statFactionContainer: document.getElementById('statFactionContainer'),
            statPassiveContainer: document.getElementById('statPassiveContainer'),
            // Stats component values
            statHostile: document.getElementById('statHostile'),
            statFaction: document.getElementById('statFaction'),
            statPassive: document.getElementById('statPassive'),
            // Sections
            hostileSection: document.getElementById('playersHostile'),
            factionSection: document.getElementById('playersFaction'),
            passiveSection: document.getElementById('playersPassive'),
            emptyState: document.getElementById('playersEmpty'),
            // Lists within sections
            hostileList: document.getElementById('hostileList'),
            factionList: document.getElementById('factionList'),
            passiveList: document.getElementById('passiveList'),
            // Count labels
            hostileCount: document.getElementById('hostileCount'),
            factionCount: document.getElementById('factionCount'),
            passiveCount: document.getElementById('passiveCount')
        };
    }
    return _playerElements;
}

function updatePlayersList() {
    const els = getPlayerListElements();
    if (!els.container) return;

    const playersByType = playersHandler.getPlayersByType();
    const counts = {
        hostile: playersByType.hostile.length,
        faction: playersByType.faction.length,
        passive: playersByType.passive.length
    };
    const total = counts.hostile + counts.faction + counts.passive;

    // Get filter settings (same as PlayersHandler.getFilteredPlayers)
    const showHostile = window.settingsSync?.getBool('settingDangerousPlayers') ?? true;
    const showFaction = window.settingsSync?.getBool('settingFactionPlayers') ?? true;
    const showPassive = window.settingsSync?.getBool('settingPassivePlayers') ?? true;

    // Update stats component values and visibility
    const countsChanged = counts.hostile !== _lastPlayerCounts.hostile ||
        counts.faction !== _lastPlayerCounts.faction ||
        counts.passive !== _lastPlayerCounts.passive;

    if (countsChanged) {
        _lastPlayerCounts = {...counts};
        if (els.statHostile) els.statHostile.textContent = counts.hostile;
        if (els.statFaction) els.statFaction.textContent = counts.faction;
        if (els.statPassive) els.statPassive.textContent = counts.passive;
    }

    // Show/hide individual stat containers based on filter settings
    if (els.statHostileContainer) els.statHostileContainer.classList.toggle('hidden', !showHostile);
    if (els.statFactionContainer) els.statFactionContainer.classList.toggle('hidden', !showFaction);
    if (els.statPassiveContainer) els.statPassiveContainer.classList.toggle('hidden', !showPassive);

    // Show stats container only when there are players AND at least one type is visible
    const hasVisibleStats = (showHostile || showFaction || showPassive) && total > 0;
    if (els.playerStats) {
        els.playerStats.classList.toggle('hidden', !hasVisibleStats);
    }

    // Show/hide empty state
    if (els.emptyState) {
        els.emptyState.classList.toggle('hidden', total > 0);
    }

    // Set data-sections for CSS grid rules (1-2 sections: max 2 cols, 3 sections: 1 col)
    const visibleSections = (counts.hostile > 0 ? 1 : 0) +
                           (counts.faction > 0 ? 1 : 0) +
                           (counts.passive > 0 ? 1 : 0);
    els.container.dataset.sections = visibleSections;

    // Update hostile section
    if (els.hostileSection && els.hostileList) {
        if (counts.hostile > 0) {
            els.hostileSection.classList.remove('hidden');
            if (els.hostileCount) els.hostileCount.textContent = `(${counts.hostile})`;
            requestAnimationFrame(() => updateSectionPlayers(els.hostileList, playersByType.hostile, 'hostile'));
        } else {
            els.hostileSection.classList.add('hidden');
            els.hostileList.innerHTML = '';
        }
    }

    // Update faction section
    if (els.factionSection && els.factionList) {
        if (counts.faction > 0) {
            els.factionSection.classList.remove('hidden');
            if (els.factionCount) els.factionCount.textContent = `(${counts.faction})`;
            requestAnimationFrame(() => updateSectionPlayers(els.factionList, playersByType.faction, 'faction'));
        } else {
            els.factionSection.classList.add('hidden');
            els.factionList.innerHTML = '';
        }
    }

    // Update passive section
    if (els.passiveSection && els.passiveList) {
        if (counts.passive > 0) {
            els.passiveSection.classList.remove('hidden');
            if (els.passiveCount) els.passiveCount.textContent = `(${counts.passive})`;
            requestAnimationFrame(() => updateSectionPlayers(els.passiveList, playersByType.passive, 'passive'));
        } else {
            els.passiveSection.classList.add('hidden');
            els.passiveList.innerHTML = '';
        }
    }

    // Clear render cache for players no longer in any section
    if (total === 0 && lastRenderedPlayerIds.size > 0) {
        lastRenderedPlayerIds.clear();
    }
}

let lpX = 0.0;
let lpY = 0.0;

// 🌍 Expose lpX/lpY globally for DEEP DEBUG access
window.lpX = lpX;
window.lpY = lpY;

// drawingUtils = new DrawingUtils();  // MOVED TO initRadar()

// 🔄 WebSocket with auto-reconnect
const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

// Connection status tracking
window.wsConnectionStatus = 'disconnected';

function updateConnectionStatus(status) {
  const previousStatus = window.wsConnectionStatus;
  window.wsConnectionStatus = status;
  document.dispatchEvent(new CustomEvent('wsStatusChange', { detail: { status } }));

  // Show toast notifications for status changes
  if (window.toast && previousStatus !== status) {
    if (status === 'connected') {
      window.toast.success('Connected to radar backend');
    } else if (status === 'disconnected' && previousStatus === 'connected') {
      window.toast.error('Connection lost');
    }
  }
}

// Named handlers for proper cleanup
function onSocketOpen() {
  reconnectAttempts = 0;
  updateConnectionStatus('connected');
  console.log('✅ [Utils.js] WebSocket connected');
}

function onSocketClose() {
  updateConnectionStatus('disconnected');
  console.warn('⚠️ [Utils.js] WebSocket disconnected');
  scheduleReconnect();
}

function onSocketError(error) {
  console.error('❌ [Utils.js] WebSocket error:', error);
}

function cleanupSocket() {
  if (socket) {
    socket.removeEventListener('open', onSocketOpen);
    socket.removeEventListener('close', onSocketClose);
    socket.removeEventListener('error', onSocketError);
    socket.removeEventListener('message', handleWebSocketMessage);
    socket.close();
    socket = null;
  }
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
}

function connectWebSocket() {
  updateConnectionStatus('connecting');
  cleanupSocket();

  console.log('🔌 [Utils.js] Connecting to WebSocket...');
  socket = new WebSocket('ws://localhost:5001/ws');
  socket.addEventListener('open', onSocketOpen);
  socket.addEventListener('close', onSocketClose);
  socket.addEventListener('error', onSocketError);
  socket.addEventListener('message', handleWebSocketMessage);
}

function scheduleReconnect() {
  reconnectAttempts++;
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
    MAX_RECONNECT_DELAY
  );
  console.log(`🔄 [Utils.js] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})...`);
  reconnectTimeoutId = setTimeout(connectWebSocket, delay);
}

// WebSocket Event Queue - MOVED TO initRadar()
// eventQueue = getEventQueue();
// eventQueue.setFlushCallback((messageType, params) => {
//     switch (messageType) {
//         case 'request': onRequest(params); break;
//         case 'event': onEvent(params); break;
//         case 'response': onResponse(params); break;
//     }
// });

function handleWebSocketMessage(event) {
    eventQueue.queueRawMessage(event.data);
}

// Start WebSocket connection - MOVED TO initRadar()
// connectWebSocket();

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
            // HarvestStart events are now handled by HarvestablesHandler.js
            // using database validation instead of event-driven detection.
            // See docs/project/RESOURCE_DETECTION_REFACTOR.md for details.
            break;

        case EventCodes.HarvestCancel:
            // HarvestCancel events are now handled by HarvestablesHandler.js
            // using database validation instead of event-driven detection.
            // See docs/project/RESOURCE_DETECTION_REFACTOR.md for details.
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
            // NewSimpleItem events are now handled by HarvestablesHandler.js
            // using database validation instead of event-driven detection.
            // See docs/project/RESOURCE_DETECTION_REFACTOR.md for details.
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

        case EventCodes.FishingFinished:
            fishingHandler.FishingEnd(Parameters);
            break;

        case EventCodes.ChangeFlaggingFinished:
            playersHandler.updatePlayerFaction(Parameters[0], Parameters[1]);
            break;

        case 590:
            // Key sync event (debug)
            {
                window.logger?.debug(CATEGORIES.PACKET_RAW, EVENTS.KeySync, { Parameters });
            }
            break;
    }
}


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
        const newMapId = Parameters[0];
        const now = Date.now();
        const timeSinceLastChange = now - lastMapChangeTime;

        // 🛡️ Debounce: Ignore map changes that arrive too quickly after a previous one
        // This prevents flickering from duplicate/retransmitted packets
        if (timeSinceLastChange < MAP_CHANGE_DEBOUNCE_MS && map.id !== -1) {
            window.logger?.debug(CATEGORIES.MAP, 'MapChangeDebounced', {
                currentMapId: map.id,
                newMapId: newMapId,
                timeSinceLastChange: timeSinceLastChange,
                debounceMs: MAP_CHANGE_DEBOUNCE_MS,
                note: '⏳ Map change ignored (debounce)'
            });
            return;
        }

        // 🛡️ Skip if same map ID (no actual change)
        if (newMapId === map.id) {
            window.logger?.debug(CATEGORIES.MAP, 'MapChangeSameId', {
                mapId: newMapId,
                note: '↔️ Same map ID, skipping update'
            });
            return;
        }

        // ✅ Accept the map change
        const previousMapId = map.id;
        map.id = newMapId;
        lastMapChangeTime = now;
        window.currentMapId = map.id; // Expose for zone-aware features

        window.logger?.info(CATEGORIES.MAP, 'MapChanged', {
            previousMapId: previousMapId,
            newMapId: map.id,
            timeSinceLastChange: timeSinceLastChange
        });

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

/**
 * Initialize or reinitialize the RadarRenderer
 * Called on initial page load and when navigating back to radar via SPA
 */
function initializeRadarRenderer() {
    const canvas = document.getElementById("drawCanvas");
    const context = canvas ? canvas.getContext("2d") : null;

    // Debug: Check canvas availability
    window.logger?.info(CATEGORIES.MAP, 'CanvasCheck', {
        hasCanvas: !!canvas,
        hasContext: !!context,
        canvasId: canvas?.id || 'none',
        hasExistingRenderer: !!radarRenderer,
        note: 'Checking canvas availability for RadarRenderer'
    });

    // Only initialize RadarRenderer if canvas elements exist (drawing page)
    if (canvas && context) {
        // Stop existing renderer if any
        if (radarRenderer) {
            radarRenderer.stop();
            console.log('🔄 [Utils.js] Stopping existing RadarRenderer for reinit');
        }

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

        return true;
    } else {
        // ❌ NO CANVAS - Cannot initialize radar (should only happen on non-radar pages)
        window.logger?.debug(CATEGORIES.MAP, 'NoCanvasFound', {
            note: 'Canvas elements not found - radar page not active',
            hasCanvas: !!canvas,
            hasContext: !!context
        });

        return false;
    }
}

// Initialize radar on load - MOVED TO initRadar()
// initializeRadarRenderer();

// 👥 Update player list UI every 1.5 seconds - MOVED TO initRadar()
// playerListIntervalId = setInterval(updatePlayersList, 1500);

// 🧹 Automatic stale entity cleanup every 60 seconds (5 min max age) - MOVED TO initRadar()
// cleanupIntervalId = setInterval(cleanupStaleEntities, 60000);

// 🧹 Cleanup intervals on page unload - handled by destroyRadar()
function cleanupIntervals() {
    if (playerListIntervalId) clearInterval(playerListIntervalId);
    if (cleanupIntervalId) clearInterval(cleanupIntervalId);
    playerListIntervalId = null;
    cleanupIntervalId = null;
    _playerElements = null;
    _lastPlayerCounts = { hostile: -1, faction: -1, passive: -1 };
    if (radarRenderer) radarRenderer.stop();
    cleanupSocket();
    destroyEventQueue();
}

// beforeunload cleanup - kept for browser tab close
window.addEventListener('beforeunload', cleanupIntervals);

// htmx cleanup - now handled by PageController
// document.body.addEventListener('htmx:beforeSwap', (e) => {
//     if (e.detail.target?.id === 'page-content') cleanupIntervals();
// });

// button click - MOVED TO initRadar()
// document.getElementById("button")?.addEventListener("click", function () {
//     ClearHandlers();
// });

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