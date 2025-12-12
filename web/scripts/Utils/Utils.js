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

import imageCache from './ImageCache.js';
import {DrawingUtils} from './DrawingUtils.js';
import {DungeonsHandler} from "../Handlers/DungeonsHandler.js";
import {ItemsInfo} from "../Handlers/ItemsInfo.js";
import {CATEGORIES, EVENTS} from "../constants/LoggerConstants.js";
import {createRadarRenderer} from './RadarRenderer.js';
import {VirtualScroll} from './VirtualScroll.js';

// ✅ Canvas check for RadarRenderer initialization
const canvas = document.getElementById("drawCanvas");
const context = canvas ? canvas.getContext("2d") : null;

console.log('🔧 [Utils.js] Module loaded');


console.log('🔧 [Utils.js] Settings initialized (logger is managed by LoggerClient.js)');

// 📊 Global database state tracking
window.databasesReady = false;
window.databaseLoadingProgress = {
    items: false,
    spells: false,
    harvestables: false,
    mobs: false,
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

// 🚀 Start database initialization
initializeDatabases().catch(error => {
    console.error('❌ [Utils.js] Critical error during database initialization:', error);
    window.logger?.error(
        window.CATEGORIES?.ITEM_DATABASE || 'ITEM_DATABASE',
        'DatabaseInitCriticalError',
        { error: error.message }
    );
    showDatabaseError('System', error);
});

const harvestablesDrawing = new HarvestablesDrawing();
const dungeonsHandler = new DungeonsHandler();

var itemsInfo = new ItemsInfo();
itemsInfo.initItems();

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

// existing logEnemiesList button stays the same
window.addEventListener('load', () => {
    const logEnemiesList = document.getElementById('logEnemiesList');
    if (logEnemiesList) {
        logEnemiesList.addEventListener('click', () => {
            const mobList = mobsHandler.getMobList();
            window.logger?.debug(CATEGORIES.DEBUG, EVENTS.EnemiesList, { mobList: mobList });
        });
    }
});


const harvestablesHandler = new HarvestablesHandler(mobsHandler); // 🔗 Pass MobsHandler reference
const playersHandler = new PlayersHandler();


// 📊 Expose handlers globally for statistics and debug access
window.harvestablesHandler = harvestablesHandler;
window.mobsHandler = mobsHandler;
window.playersHandler = playersHandler;

// ♻️ MEMORY MANAGEMENT: Manual cleanup methods available on handlers
// Call harvestablesHandler.cleanupStaleEntities() etc. when needed
// Automatic cleanup disabled for now - needs lastUpdateTime to be updated on entity updates
console.log('[MemoryManager] Manual cleanup methods available on handlers');

const wispCageHandler = new WispCageHandler();
const wispCageDrawing = new WispCageDrawing();

const fishingHandler = new FishingHandler();
const fishingDrawing = new FishingDrawing();

const chestsDrawing = new ChestsDrawing();
const mobsDrawing = new MobsDrawing();
const playersDrawing = new PlayersDrawing();
const dungeonsDrawing = new DungeonsDrawing();
playersDrawing.updateItemsInfo(itemsInfo.iteminfo);

// 👥 Player list rendering with incremental updates
// Uses virtual scrolling for large lists (20+ players)

const VIRTUAL_SCROLL_THRESHOLD = 20;
let playerListScroller = null;
let lastRenderedPlayerIds = new Map(); // Track rendered players for incremental updates

/**
 * Render a single player card HTML (Tailwind-only)
 */
function renderPlayerCard(player) {
    const elapsedMs = Date.now() - player.detectedAt;
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const timeStr = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m`;

    // Mounted state for styling
    const isMounted = player.mounted;

    // Guild & Alliance badges
    const guildBadge = player.guildName
        ? `<span class="text-[11px] font-mono font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20">[${player.guildName}]</span>`
        : '<span class="text-[10px] text-white/30 italic">No Guild</span>';
    const allianceBadge = player.allianceName
        ? `<span class="text-[11px] font-mono font-medium text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">&lt;${player.allianceName}&gt;</span>`
        : '';

    // Faction
    const factionBadge = player.factionName
        ? `<span class="text-[10px] font-mono font-medium text-blue-400 uppercase tracking-wide">⚔ ${player.factionName}</span>`
        : '';

    // Average IP badge
    const avgItemPower = player.getAverageItemPower?.();
    const ipBadge = avgItemPower
        ? `<span class="text-[11px] font-mono font-bold text-warning bg-gradient-to-br from-warning/15 to-warning/5 px-2 py-0.5 rounded border border-warning/30">IP ${avgItemPower}</span>`
        : '';

    // Mounted badge
    const mountedBadge = isMounted
        ? `<span class="text-[9px] font-mono font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/25 uppercase tracking-wide">Mounted</span>`
        : '';

    // Equipment section - simplified image loading (no blocking)
    let equipHtml = '';
    if (Array.isArray(player.equipments) && player.equipments.length > 0 && window.itemsDatabase) {
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

                // Direct image with lazy loading - no blocking preload check
                const imgHtml = `<img src="${iconPath}" alt="${baseName}" class="w-6 h-6 object-contain drop-shadow-sm bg-surface/50 rounded" loading="lazy" onerror="this.style.display='none'">`;

                return `<div class="inline-flex items-center gap-1.5 bg-void/60 px-2 py-1 rounded border border-white/5 hover:border-white/10 transition-colors" title="${baseName} - ${tierStr}${enchantStr} - IP: ${ipStr}">${imgHtml}<span class="text-[10px] font-mono font-semibold text-white/80">${tierStr}${enchantStr}</span>${ipStr ? `<span class="text-[9px] font-mono font-bold text-warning">${ipStr}</span>` : ''}</div>`;
            }).filter(Boolean).join('');

            if (items) {
                equipHtml = `<div class="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-white/5">${items}</div>`;
            }
        }
    }

    // Spells section - simplified image loading (no blocking)
    let spellsHtml = '';
    if (Array.isArray(player.spells) && player.spells.length > 0 && window.spellsDatabase) {
        const validSpells = player.spells.filter(id => id && id > 0 && id !== 65535);
        if (validSpells.length > 0) {
            const spells = validSpells.map(spellIndex => {
                const spell = window.spellsDatabase.getSpellByIndex(spellIndex);
                if (!spell) return '';

                const iconPath = `/images/Spells/${spell.uiSprite || 'SPELL_GENERIC'}.webp`;

                // Direct image with lazy loading - no blocking preload check
                const imgHtml = `<img src="${iconPath}" alt="${spell.uniqueName}" class="w-5 h-5 object-contain bg-surface/50 rounded" loading="lazy" onerror="this.parentElement.style.display='none'">`;

                return `<div class="flex items-center justify-center bg-accent/10 p-1.5 rounded border border-accent/15 hover:bg-accent/15 hover:border-accent/25 transition-all" title="${spell.uniqueName}">${imgHtml}</div>`;
            }).filter(Boolean).join('');

            if (spells) {
                spellsHtml = `<div class="flex flex-wrap gap-1.5 mt-3">${spells}</div>`;
            }
        }
    }

    // Health bar
    let healthHtml = '';
    if (player.currentHealth > 0 && player.initialHealth > 0) {
        const pct = Math.round((player.currentHealth / player.initialHealth) * 100);
        const colorClass = pct > 60 ? 'bg-gradient-to-r from-success to-green-500'
                         : pct > 30 ? 'bg-gradient-to-r from-warning to-amber-500'
                         : 'bg-gradient-to-r from-danger to-red-500 animate-pulse';
        healthHtml = `<div class="flex items-center gap-2 mt-3"><div class="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden"><div data-health-bar class="h-full rounded-full transition-all duration-300 ${colorClass}" style="width: ${pct}%;"></div></div><span class="text-[10px] font-mono text-white/50 min-w-[2.5rem] text-right">${pct}%</span></div>`;
    }

    // ID display
    const idStr = `<div class="text-[10px] font-mono text-white/25 mt-3 pt-2 border-t border-white/5">ID: ${player.id}</div>`;

    // Build the card with proper structure
    const accentBarClass = isMounted ? 'bg-accent' : 'bg-danger';
    const hoverBorderClass = isMounted ? 'hover:border-accent/25' : 'hover:border-danger/25';

    return `<div class="group relative p-4 pl-5 bg-gradient-to-br from-elevated to-surface border border-white/5 rounded-lg transition-all duration-200 ${hoverBorderClass} hover:translate-x-0.5" data-player-id="${player.id}"><div class="absolute left-0 top-0 bottom-0 w-[3px] ${accentBarClass} opacity-90 group-hover:opacity-100 group-hover:w-1 transition-all"></div><div class="flex justify-between items-start gap-3"><div class="flex-1 min-w-0"><span class="block text-sm font-semibold text-white truncate">${player.nickname}</span><div class="flex flex-wrap items-center gap-1.5 mt-1">${guildBadge}${allianceBadge}</div></div><div class="flex flex-col items-end gap-1 shrink-0"><span data-time class="text-[10px] font-mono text-white/40">${timeStr}</span></div></div><div class="flex flex-wrap items-center gap-1.5 mt-2">${factionBadge}${ipBadge}${mountedBadge}</div>${equipHtml}${spellsHtml}${healthHtml}${idStr}</div>`;
}

/**
 * Update players list with incremental updates for small lists
 */
function updatePlayersIncremental(container, players) {
    // Clear empty state if present
    const emptyState = container.querySelector('[data-empty-state]');
    if (emptyState) {
        emptyState.remove();
    }

    const currentIds = new Set(players.map(p => p.id));

    // Remove players no longer in list
    container.querySelectorAll('[data-player-id]').forEach(card => {
        const id = parseInt(card.dataset.playerId);
        if (!currentIds.has(id)) {
            card.remove();
            lastRenderedPlayerIds.delete(id);
        }
    });

    // Update or add players
    players.forEach(player => {
        const existingCard = container.querySelector(`[data-player-id="${player.id}"]`);
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
            // Create new card
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderPlayerCard(player);
            container.appendChild(tempDiv.firstElementChild);
        }

        lastRenderedPlayerIds.set(player.id, { health: player.currentHealth });
    });
}

/**
 * Main update function - chooses between incremental and virtual scroll
 */
function updatePlayersList() {
    const container = document.getElementById('playersList');
    if (!container) return;

    const players = playersHandler.playersList;

    // Update count badge
    const countBadge = document.getElementById('playersCount');
    const countNum = document.getElementById('playersCountNum');
    if (countBadge && countNum) {
        if (players.length > 0) {
            countBadge.classList.remove('hidden');
            countBadge.classList.add('inline-flex');
            countNum.textContent = players.length;
        } else {
            countBadge.classList.add('hidden');
            countBadge.classList.remove('inline-flex');
        }
    }

    if (players.length === 0) {
        if (playerListScroller) {
            playerListScroller.destroy();
            playerListScroller = null;
        }
        lastRenderedPlayerIds.clear();
        container.innerHTML = `<div data-empty-state class="col-span-full flex flex-col items-center justify-center py-8 text-center"><svg class="w-10 h-10 text-white/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg><p class="text-sm text-white/40">No players detected yet</p><p class="text-xs text-white/25 font-mono mt-1">Scanning...</p></div>`;
        return;
    }

    // Disable virtual scroll - it breaks grid layout
    // Always use incremental updates for proper grid display
    if (playerListScroller) {
        playerListScroller.destroy();
        playerListScroller = null;
        container.style.height = '';
    }

    // Reset grid classes if they were removed
    if (!container.classList.contains('grid')) {
        container.className = 'grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin';
    }

    updatePlayersIncremental(container, players);
}

let lpX = 0.0;
let lpY = 0.0;

// 🌍 Expose lpX/lpY globally for DEEP DEBUG access
window.lpX = lpX;
window.lpY = lpY;

const drawingUtils = new DrawingUtils();

// 🔄 WebSocket with auto-reconnect
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max delay
const INITIAL_RECONNECT_DELAY = 1000; // 1 second initial delay

// Connection status tracking
window.wsConnectionStatus = 'disconnected'; // 'connected', 'disconnected', 'connecting'

function updateConnectionStatus(status) {
  window.wsConnectionStatus = status;
  document.dispatchEvent(new CustomEvent('wsStatusChange', { detail: { status } }));
}

function connectWebSocket() {
  updateConnectionStatus('connecting');
  // Close existing socket if any
  if (socket) {
    socket.close();
  }

  console.log('🔌 [Utils.js] Connecting to WebSocket...');
  socket = new WebSocket('ws://localhost:5001/ws');

  socket.addEventListener('open', () => {
    reconnectAttempts = 0; // Reset counter on successful connection
    updateConnectionStatus('connected');
    window.logger?.info(CATEGORIES.WEBSOCKET, EVENTS.Connected, {
      page: 'Utils',
      reconnected: reconnectAttempts > 0
    });
    console.log('✅ [Utils.js] WebSocket connected successfully');
  });

  socket.addEventListener('close', () => {
    updateConnectionStatus('disconnected');
    window.logger?.warn(CATEGORIES.WEBSOCKET, 'Disconnected', { page: 'Utils' });
    console.warn('⚠️ [Utils.js] WebSocket disconnected, will attempt to reconnect...');
    scheduleReconnect();
  });

  socket.addEventListener('error', (error) => {
    window.logger?.error(CATEGORIES.WEBSOCKET, 'ConnectionError', {
      page: 'Utils',
      error: error.message
    });
    console.error('❌ [Utils.js] WebSocket error:', error);
  });

  socket.addEventListener('message', handleWebSocketMessage);
}

function scheduleReconnect() {
  reconnectAttempts++;
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
    MAX_RECONNECT_DELAY
  );

  console.log(`🔄 [Utils.js] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})...`);

  setTimeout(() => {
    connectWebSocket();
  }, delay);
}

function handleWebSocketMessage(event) {
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
}

// 🚀 Start WebSocket connection
connectWebSocket();

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

// Initialize radar on load
initializeRadarRenderer();

// 👥 Update player list UI every 1.5 seconds
setInterval(updatePlayersList, 1500);



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