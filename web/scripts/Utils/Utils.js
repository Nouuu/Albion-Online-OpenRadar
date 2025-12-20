import {PlayersDrawing} from '../Drawings/PlayersDrawing.js';
import {HarvestablesDrawing} from '../Drawings/HarvestablesDrawing.js';
import {MobsDrawing} from '../Drawings/MobsDrawing.js';
import {ChestsDrawing} from '../Drawings/ChestsDrawing.js';
import {DungeonsDrawing} from '../Drawings/DungeonsDrawing.js';
import {MapDrawing} from '../Drawings/MapsDrawing.js';
import {WispCageDrawing} from '../Drawings/WispCageDrawing.js';
import {FishingDrawing} from '../Drawings/FishingDrawing.js';

import {PlayersHandler} from '../Handlers/PlayersHandler.js';
import {WispCageHandler} from '../Handlers/WispCageHandler.js';
import {FishingHandler} from '../Handlers/FishingHandler.js';
import {MobsHandler} from '../Handlers/MobsHandler.js';
import {ChestsHandler} from '../Handlers/ChestsHandler.js';
import {HarvestablesHandler} from '../Handlers/HarvestablesHandler.js';
import {MapH} from '../Handlers/Map.js';
import {DungeonsHandler} from '../Handlers/DungeonsHandler.js';
import {ItemsInfo} from '../Handlers/ItemsInfo.js';

import {DrawingUtils} from './DrawingUtils.js';
import {CATEGORIES} from '../constants/LoggerConstants.js';
import {createRadarRenderer} from './RadarRenderer.js';
import {destroyEventQueue, getEventQueue} from './WebSocketEventQueue.js';
import pictureInPictureManager from './PictureInPictureManager.js';

import * as WebSocketManager from '../core/WebSocketManager.js';
import * as DatabaseLoader from '../core/DatabaseLoader.js';
import * as EventRouter from '../core/EventRouter.js';
import * as PlayerListRenderer from '../radar/PlayerListRenderer.js';

let isInitialized = false;
let isDestroying = false;
let radarRenderer = null;
let eventQueue = null;
let playerListIntervalId = null;
let cleanupIntervalId = null;
let buttonClickHandler = null;
let lastPlayerListHash = '';

let handlers = {
    harvestables: null, mobs: null, players: null, chests: null,
    dungeons: null, wispCage: null, fishing: null
};

let drawings = {
    harvestables: null, mobs: null, players: null, chests: null,
    dungeons: null, wispCage: null, fishing: null, maps: null
};

let drawingUtils = null;
let itemsInfo = null;
let map = null;

const STALE_ENTITY_MAX_AGE = 300000;

function cleanupStaleEntities() {
    const cleanedPlayers = handlers.players?.cleanupStaleEntities?.(STALE_ENTITY_MAX_AGE) || 0;
    const cleanedMobs = handlers.mobs?.cleanupStaleEntities?.(STALE_ENTITY_MAX_AGE) || 0;
    const cleanedHarvestables = handlers.harvestables?.cleanupStaleEntities?.(STALE_ENTITY_MAX_AGE) || 0;

    const activePlayerIds = new Set(handlers.players?.getFilteredPlayers?.().map(p => p.id) || []);
    const cleanedRenderCache = PlayerListRenderer.cleanupStaleCache(activePlayerIds);

    if (cleanedPlayers || cleanedMobs || cleanedHarvestables || cleanedRenderCache) {
        window.logger?.debug(CATEGORIES.SYSTEM, 'StaleEntityCleanup', {
            players: cleanedPlayers,
            mobs: cleanedMobs,
            harvestables: cleanedHarvestables,
            renderCache: cleanedRenderCache
        });
    }
}

function initializeRadarRenderer() {
    const canvas = document.getElementById('drawCanvas');
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
        window.logger?.debug(CATEGORIES.MAP, 'NoCanvasFound', {});
        return false;
    }

    if (radarRenderer) {
        radarRenderer.stop();
    }

    radarRenderer = createRadarRenderer({
        handlers: {
            harvestablesHandler: handlers.harvestables,
            mobsHandler: handlers.mobs,
            playersHandler: handlers.players,
            chestsHandler: handlers.chests,
            dungeonsHandler: handlers.dungeons,
            wispCageHandler: handlers.wispCage,
            fishingHandler: handlers.fishing
        },
        drawings: {
            mapsDrawing: drawings.maps,
            harvestablesDrawing: drawings.harvestables,
            mobsDrawing: drawings.mobs,
            playersDrawing: drawings.players,
            chestsDrawing: drawings.chests,
            dungeonsDrawing: drawings.dungeons,
            wispCageDrawing: drawings.wispCage,
            fishingDrawing: drawings.fishing
        },
        drawingUtils
    });

    radarRenderer.initialize();
    radarRenderer.setMap(map);
    window.radarRenderer = radarRenderer;
    radarRenderer.start();

    window.logger?.info(CATEGORIES.MAP, 'RadarRendererStarted', {});
    return true;
}

function clearHandlers(preserveSession = false) {
    handlers.chests.chestsList = [];
    handlers.dungeons.dungeonList = [];
    handlers.fishing.Clear();
    handlers.harvestables.Clear();
    handlers.mobs.Clear();
    handlers.players.Clear();
    handlers.wispCage.Clear();

    if (!preserveSession) {
        try {
            sessionStorage.removeItem('lastMapDisplayed');
        } catch (e) {
            window.logger?.warn(CATEGORIES.MAP, 'SessionStorageClearFailed', {error: e?.message});
        }
    }
}

export async function initRadar() {
    if (isInitialized) {
        window.logger?.warn(CATEGORIES.SYSTEM, 'RadarAlreadyInitialized', {});
        return;
    }

    while (isDestroying) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    window.logger?.info(CATEGORIES.SYSTEM, 'RadarInitializing', {});

    try {
        await DatabaseLoader.load();

        drawingUtils = new DrawingUtils();
        itemsInfo = new ItemsInfo();
        itemsInfo.initItems();
        map = new MapH(-1);

        handlers.dungeons = new DungeonsHandler();
        handlers.chests = new ChestsHandler();
        handlers.mobs = new MobsHandler();
        handlers.harvestables = new HarvestablesHandler(handlers.mobs);
        handlers.players = new PlayersHandler();
        handlers.wispCage = new WispCageHandler();
        handlers.fishing = new FishingHandler();

        drawings.maps = new MapDrawing();
        drawings.harvestables = new HarvestablesDrawing();
        drawings.mobs = new MobsDrawing();
        drawings.players = new PlayersDrawing();
        drawings.chests = new ChestsDrawing();
        drawings.dungeons = new DungeonsDrawing();
        drawings.wispCage = new WispCageDrawing();
        drawings.fishing = new FishingDrawing();
        drawings.players.updateItemsInfo(itemsInfo.iteminfo);

        window.harvestablesHandler = handlers.harvestables;
        window.mobsHandler = handlers.mobs;
        window.playersHandler = handlers.players;

        EventRouter.init({
            handlers: {
                playersHandler: handlers.players,
                mobsHandler: handlers.mobs,
                harvestablesHandler: handlers.harvestables,
                chestsHandler: handlers.chests,
                dungeonsHandler: handlers.dungeons,
                fishingHandler: handlers.fishing,
                wispCageHandler: handlers.wispCage
            },
            map,
            radarRenderer: null
        });

        EventRouter.restoreMapFromSession();

        WebSocketManager.setMessageCallback((data) => {
            eventQueue.queueRawMessage(data);
        });
        WebSocketManager.connect();

        eventQueue = getEventQueue();
        eventQueue.setFlushCallback((messageType, params) => {
            switch (messageType) {
                case 'request':
                    EventRouter.onRequest(params);
                    break;
                case 'event':
                    EventRouter.onEvent(params);
                    break;
                case 'response':
                    EventRouter.onResponse(params, () => clearHandlers());
                    break;
            }
        });

        initializeRadarRenderer();
        EventRouter.setRadarRenderer(radarRenderer);

        playerListIntervalId = setInterval(() => {
            const players = handlers.players?.getFilteredPlayers?.() || [];
            const hash = `${players.length}:` + players.map(p => `${p.id}:${p.currentHealth}:${p.mounted ? 1 : 0}`).join(',');
            if (hash !== lastPlayerListHash) {
                lastPlayerListHash = hash;
                PlayerListRenderer.update(handlers.players);
            }
        }, 1500);
        cleanupIntervalId = setInterval(cleanupStaleEntities, 60000);

        const buttonElement = document.getElementById('button');
        if (buttonElement) {
            buttonClickHandler = () => clearHandlers();
            buttonElement.addEventListener('click', buttonClickHandler);
        }

        isInitialized = true;
        window.logger?.info(CATEGORIES.SYSTEM, 'RadarInitialized', {});

        if (pictureInPictureManager.isSupported()) {
            pictureInPictureManager.initialize(radarRenderer.canvasManager);
            window.pipManager = pictureInPictureManager;
            document.dispatchEvent(new CustomEvent('pipManagerReady'));
            window.logger?.info(CATEGORIES.SYSTEM, 'PiPManagerInitialized', {});
        }

    } catch (error) {
        window.logger?.error(CATEGORIES.SYSTEM, 'RadarInitFailed', {error: error.message});
        if (window.toast) window.toast.error('Failed to initialize radar');
        throw error;
    }
}

export function destroyRadar() {
    if (!isInitialized) {
        window.logger?.warn(CATEGORIES.SYSTEM, 'RadarNotInitialized', {});
        return;
    }

    isDestroying = true;
    window.logger?.info(CATEGORIES.SYSTEM, 'RadarDestroying', {});

    const buttonElement = document.getElementById('button');
    if (buttonElement && buttonClickHandler) {
        buttonElement.removeEventListener('click', buttonClickHandler);
        buttonClickHandler = null;
    }

    if (playerListIntervalId) {
        clearInterval(playerListIntervalId);
        playerListIntervalId = null;
    }
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
    }

    if (window.pipManager) {
        pictureInPictureManager.destroy();
        window.pipManager = null;
    }

    if (radarRenderer) {
        radarRenderer.stop();
        radarRenderer = null;
    }

    destroyEventQueue();
    eventQueue = null;

    WebSocketManager.disconnect();
    clearHandlers(true);

    Object.keys(handlers).forEach(k => handlers[k] = null);
    Object.keys(drawings).forEach(k => drawings[k] = null);
    drawingUtils = null;
    itemsInfo = null;
    map = null;

    window.harvestablesHandler = null;
    window.mobsHandler = null;
    window.playersHandler = null;
    window.radarRenderer = null;

    PlayerListRenderer.reset();
    EventRouter.reset();
    lastPlayerListHash = '';

    isInitialized = false;
    isDestroying = false;
    window.logger?.info(CATEGORIES.SYSTEM, 'RadarDestroyed', {});
}

window.addEventListener('beforeunload', () => {
    if (isInitialized) destroyRadar();
});
