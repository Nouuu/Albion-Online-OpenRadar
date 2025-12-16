import { CanvasManager } from './CanvasManager.js';
import {CATEGORIES, EVENTS} from "../constants/LoggerConstants.js";
import settingsSync from "./SettingsSync.js";

export class RadarRenderer {
    constructor(viewType, dependencies) {
        this.viewType = viewType; // 'main' or 'overlay'

        this.handlers = dependencies.handlers;
        this.drawings = dependencies.drawings;
        this.drawingUtils = dependencies.drawingUtils;

        // Canvas management
        this.canvasManager = new CanvasManager(viewType);
        this.contexts = {};

        // Game state
        this.lpX = 0; // Local player X position
        this.lpY = 0; // Local player Y position
        this.map = null; // Current map

        // Frame timing
        this.previousTime = performance.now();
        this.animationFrameId = null;

        // 🎯 Performance optimization: FPS throttling + cluster cache
        this.TARGET_FPS = 30; // Limit to 30 FPS instead of 60
        this.FRAME_TIME = 1000 / this.TARGET_FPS;
        this.CLUSTER_UPDATE_INTERVAL = 2000; // Recalculate clusters every 2 seconds
        this.lastFrameTime = 0;
        this.lastClusterUpdate = 0;
        this.cachedClusters = null;
    }

    /**
     * Initialize the renderer (setup canvases)
     */
    initialize() {
        const { contexts } = this.canvasManager.initialize();
        this.contexts = contexts;

        window.logger?.info(CATEGORIES.MAP, 'RadarRendererInitialized', { viewType: this.viewType });
    }

    /**
     * Update local player position
     * @param {number} x - Player X coordinate
     * @param {number} y - Player Y coordinate
     */
    setLocalPlayerPosition(x, y) {
        this.lpX = x;
        this.lpY = y;
    }

    /**
     * Update current map
     * @param {Object} mapData - Map object
     */
    setMap(mapData) {
        this.map = mapData;
    }


    /**
     * Start the game loop
     */
    start() {
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
        window.logger?.info(CATEGORIES.MAP, 'RadarRendererGameLoopStarted', { viewType: this.viewType });
    }

    /**
     * Stop the game loop
     */
    stop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            window.logger?.info(CATEGORIES.MAP, 'RadarRendererGameLoopStopped', { viewType: this.viewType });
        }
    }

    /**
     * Main game loop - runs every frame (throttled to TARGET_FPS)
     */
    gameLoop() {
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());

        const currentTime = performance.now();

        // 🎯 Throttle to TARGET_FPS
        const elapsed = currentTime - this.lastFrameTime;
        if (elapsed < this.FRAME_TIME) {
            return; // Skip this frame
        }

        this.lastFrameTime = currentTime - (elapsed % this.FRAME_TIME);

        this.update();
        this.render();
    }

    /**
     * Update phase - interpolate entity positions
     */
    update() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.previousTime;
        const t = Math.min(1, deltaTime / 100);

        // 🐛 DEBUG: Log local player position every 5 seconds
        if (!window.__lastLpXLogTime || (currentTime - window.__lastLpXLogTime) > 5000) {
            window.logger?.info(CATEGORIES.PLAYER, 'LocalPlayerPosition', {
                lpX: this.lpX,
                lpY: this.lpY,
                localPlayerId: window.__localPlayerId,
                isInitialized: window.__lpXInitialized || false,
                note: 'Current lpX/lpY values'
            });
            window.__lastLpXLogTime = currentTime;
        }

        // Interpolate map position
        if (settingsSync.getBool('settingShowMap') && this.drawings.mapsDrawing) {
            this.drawings.mapsDrawing.interpolate(this.map, this.lpX, this.lpY, t);
        }

        // Interpolate harvestables
        if (this.handlers.harvestablesHandler && this.drawings.harvestablesDrawing) {
            this.handlers.harvestablesHandler.removeNotInRange(this.lpX, this.lpY);
            this.drawings.harvestablesDrawing.interpolate(
                this.handlers.harvestablesHandler.harvestableList,
                this.lpX,
                this.lpY,
                t
            );
        }

        // Interpolate mobs
        if (this.handlers.mobsHandler && this.drawings.mobsDrawing) {
            this.drawings.mobsDrawing.interpolate(
                this.handlers.mobsHandler.mobsList,
                this.handlers.mobsHandler.mistList,
                this.lpX,
                this.lpY,
                t
            );
        }

        // Interpolate players (filtered by type settings)
        if (this.handlers.playersHandler && this.drawings.playersDrawing) {
            this.drawings.playersDrawing.interpolate(
                this.handlers.playersHandler.getFilteredPlayers(),
                this.lpX,
                this.lpY,
                t
            );
        }

        // Interpolate chests
        if (this.handlers.chestsHandler && this.drawings.chestsDrawing) {
            this.drawings.chestsDrawing.interpolate(
                this.handlers.chestsHandler.chestsList,
                this.lpX,
                this.lpY,
                t
            );
        }

        // Interpolate wisp cages
        if (this.handlers.wispCageHandler && this.drawings.wispCageDrawing) {
            this.drawings.wispCageDrawing.interpolate(
                this.handlers.wispCageHandler.cages,
                this.lpX,
                this.lpY,
                t
            );
        }

        // Interpolate fishing
        if (this.handlers.fishingHandler && this.drawings.fishingDrawing) {
            this.drawings.fishingDrawing.interpolate(
                this.handlers.fishingHandler.fishes,
                this.lpX,
                this.lpY,
                t
            );
        }

        // Interpolate dungeons
        if (this.handlers.dungeonsHandler && this.drawings.dungeonsDrawing) {
            this.drawings.dungeonsDrawing.interpolate(
                this.handlers.dungeonsHandler.dungeonList,
                this.lpX,
                this.lpY,
                t
            );
        }

        this.previousTime = currentTime;
    }

    /**
     * Render phase - draw all entities
     */
    render() {
        // Clear dynamic canvases
        this.canvasManager.clearDynamicLayers();

        const contextMap = this.contexts.mapCanvas;
        const context = this.contexts.drawCanvas;

        // Draw map background
        if (this.drawings.mapsDrawing && contextMap) {
            this.drawings.mapsDrawing.draw(contextMap, this.map);
        }

        // Unified cluster detection + drawing (merge static harvestables + living resources)
        // 🎯 OPTIMIZATION: Cache clusters and recalculate only every 2 seconds
        let clustersForInfo = null;
        if (settingsSync.getBool('settingResourceClusters') && context) {
            const currentTime = performance.now();
            const timeSinceLastUpdate = currentTime - this.lastClusterUpdate;

            // Recalculate clusters only if cache is empty or expired
            if (!this.cachedClusters || timeSinceLastUpdate > this.CLUSTER_UPDATE_INTERVAL) {
                try {
                    // Prepare merged list: static harvestables + living resources from mobs
                    const staticList = this.handlers.harvestablesHandler?.harvestableList || [];
                    const livingList = (this.handlers.mobsHandler && this.handlers.mobsHandler.mobsList)
                        ? this.handlers.mobsHandler.mobsList.filter(mob =>
                            mob.type === window.EnemyType?.LivingHarvestable ||
                            mob.type === window.EnemyType?.LivingSkinnable
                        )
                        : [];

                    // Merge arrays (no deep copy needed)
                    const merged = staticList.concat(livingList);

                    this.cachedClusters = this.drawingUtils.detectClusters(
                        merged,
                        settingsSync.getNumber('settingClusterRadius'),
                        settingsSync.getNumber('settingClusterMinSize')
                    );
                    this.lastClusterUpdate = currentTime;
                } catch (e) {
                    // ❌ ERROR (always logged) - Critical cluster computation error
                    window.logger?.error(CATEGORIES.CLUSTER, EVENTS.ComputeFailed, e);
                }
            }

            // Use cached clusters
            clustersForInfo = this.cachedClusters;

            if (clustersForInfo) {
                // Draw only rings now (behind resources)
                for (const cluster of clustersForInfo) {
                    if (this.drawingUtils && typeof this.drawingUtils.drawClusterRingsFromCluster === 'function') {
                        this.drawingUtils.drawClusterRingsFromCluster(context, cluster);
                    } else if (this.drawingUtils && typeof this.drawingUtils.drawClusterIndicatorFromCluster === 'function') {
                        // fallback to legacy method
                        this.drawingUtils.drawClusterIndicatorFromCluster(context, cluster);
                    }
                }
            }
        }

        // Draw entities in order
        if (context) {
            if (this.drawings.harvestablesDrawing && this.handlers.harvestablesHandler) {
                this.drawings.harvestablesDrawing.invalidate(
                    context,
                    this.handlers.harvestablesHandler.harvestableList
                );
            }

            if (this.drawings.mobsDrawing && this.handlers.mobsHandler) {
                this.drawings.mobsDrawing.invalidate(
                    context,
                    this.handlers.mobsHandler.mobsList,
                    this.handlers.mobsHandler.mistList
                );
            }

            if (this.drawings.chestsDrawing && this.handlers.chestsHandler) {
                this.drawings.chestsDrawing.invalidate(
                    context,
                    this.handlers.chestsHandler.chestsList
                );
            }

            if (this.drawings.playersDrawing && this.handlers.playersHandler) {
                this.drawings.playersDrawing.invalidate(
                    context,
                    this.handlers.playersHandler.getFilteredPlayers()
                );
            }

            if (this.drawings.wispCageDrawing && this.handlers.wispCageHandler) {
                this.drawings.wispCageDrawing.draw(
                    context,
                    this.handlers.wispCageHandler.cages
                );
            }

            if (this.drawings.fishingDrawing && this.handlers.fishingHandler) {
                this.drawings.fishingDrawing.draw(
                    context,
                    this.handlers.fishingHandler.fishes
                );
            }

            if (this.drawings.dungeonsDrawing && this.handlers.dungeonsHandler) {
                this.drawings.dungeonsDrawing.draw(
                    context,
                    this.handlers.dungeonsHandler.dungeonList
                );
            }
        }

        // Draw cluster info boxes on top of all elements if any
        if (clustersForInfo && clustersForInfo.length && context) {
            for (const cluster of clustersForInfo) {
                try {
                    if (this.drawingUtils && typeof this.drawingUtils.drawClusterInfoBox === 'function') {
                        this.drawingUtils.drawClusterInfoBox(context, cluster);
                    } else if (this.drawingUtils && typeof this.drawingUtils.drawClusterIndicatorFromCluster === 'function') {
                        // fallback: draw both (legacy)
                        this.drawingUtils.drawClusterIndicatorFromCluster(context, cluster);
                    }
                } catch (e) {
                    // ❌ ERROR (always logged) - Critical cluster rendering error
                    window.logger?.error(CATEGORIES.CLUSTER, EVENTS.DrawInfoBoxFailed, e);
                }
            }
        }

        // Draw UI elements (player counter, stats, etc.)
        this.renderUI();
    }

    /**
     * Render UI overlay elements (zone, counters, etc.)
     */
    renderUI() {
        const ctx = this.contexts.uiCanvas;
        if (!ctx) return;

        // Clear UI canvas first (dynamic size)
        const canvasSize = settingsSync.getNumber('settingCanvasSize') || 500;
        ctx.clearRect(0, 0, canvasSize, canvasSize);

        // 1. Distance rings (background, subtle)
        this.renderDistanceRings(ctx);

        // 2. Zone info (top left)
        this.renderZoneInfo(ctx);

        // 3. Stats box (top right, conditional)
        this.renderStatsBox(ctx);

        // 4. Threat border (on top, if hostile detected)
        this.renderThreatBorder(ctx);
    }

    /**
     * Render distance rings centered on player
     */
    renderDistanceRings(ctx) {
        // Dynamic canvas size and center
        const canvasSize = settingsSync.getNumber('settingCanvasSize') || 500;
        const center = canvasSize / 2;
        const centerX = center, centerY = center;
        const distances = [10, 20]; // meters
        // Base: 60m visible radius at zoom 1.0
        // pixelsPerMeter scales with zoom level and canvas size
        const zoomLevel = settingsSync.getFloat('settingRadarZoom') || 1.0;
        const pixelsPerMeter = (canvasSize / 60) * zoomLevel;

        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1;

        distances.forEach(dist => {
            const radius = dist * pixelsPerMeter;

            // Only draw if radius fits in canvas
            if (radius > center - 5) return;

            // Draw circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Draw label
            ctx.setLineDash([]);
            ctx.font = '9px monospace';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${dist}m`, centerX + radius + 4, centerY);
            ctx.setLineDash([4, 6]);
        });

        ctx.restore();
    }

    /**
     * Render zone info (top left)
     */
    renderZoneInfo(ctx) {
        if (!this.map?.id) return;

        const zoneText = `📍 ${this.map.id}${this.map.isBZ ? ' (BZ)' : ''}`;
        ctx.font = 'bold 11px monospace';
        const textWidth = ctx.measureText(zoneText).width;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, textWidth + 16, 22);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, textWidth + 16, 22);

        ctx.fillStyle = '#00d4ff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(zoneText, 18, 16);
    }

    /**
     * Render stats box (top right, conditional based on settings)
     */
    renderStatsBox(ctx) {
        // Get counts
        const playerCount = this.handlers.playersHandler?.getFilteredPlayers?.()?.length ||
                           this.handlers.playersHandler?.playersList?.length || 0;
        const resourceCount = this.handlers.harvestablesHandler?.harvestableList?.length || 0;
        const mobCount = this.handlers.mobsHandler?.mobsList?.length || 0;

        // Build stats array (players conditional, resources/mobs always shown)
        const stats = [];
        if (settingsSync.getBool('settingShowPlayers')) {
            stats.push({ emoji: '👥', count: playerCount, label: 'players', color: '#ffffff' });
        }
        // Resources and mobs always shown (no global toggle exists)
        stats.push({ emoji: '📦', count: resourceCount, label: 'resources', color: '#00d4ff' });
        stats.push({ emoji: '👾', count: mobCount, label: 'mobs', color: '#ff6b6b' });

        // Calculate box dimensions (dynamic canvas size)
        const canvasSize = settingsSync.getNumber('settingCanvasSize') || 500;
        const boxWidth = 135;
        const lineHeight = 14;
        const boxHeight = 8 + stats.length * lineHeight + 8;
        const boxX = canvasSize - boxWidth - 10;
        const boxY = 10;

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Draw stats text
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        stats.forEach((stat, index) => {
            ctx.fillStyle = stat.color;
            ctx.fillText(`${stat.emoji} ${stat.count} ${stat.label}`, boxX + 8, boxY + 8 + index * lineHeight);
        });
    }

    /**
     * Render threat border when hostile players detected
     */
    renderThreatBorder(ctx) {
        // Check if setting is enabled
        if (!settingsSync.getBool('settingFlashDangerousPlayer')) return;

        const hostilePlayers = this.handlers.playersHandler?.getFilteredPlayers?.()?.filter(
            p => p.isHostile?.()
        ) || [];

        if (hostilePlayers.length === 0) return;

        // Pulse animation (~3Hz)
        const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.5; // 0.2 → 0.8

        // Dynamic canvas size for border
        const canvasSize = settingsSync.getNumber('settingCanvasSize') || 500;

        ctx.save();
        ctx.shadowColor = `rgba(255, 50, 50, ${pulse})`;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `rgba(255, 50, 50, ${pulse * 0.8})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, canvasSize - 4, canvasSize - 4);
        ctx.restore();
    }
}

/**
 * Factory function to create RadarRenderer instance
 * @param {string} viewType - 'main' or 'overlay'
 * @param {Object} dependencies - Handlers, drawings, settings, etc.
 * @returns {RadarRenderer}
 */
export function createRadarRenderer(viewType, dependencies) {
    return new RadarRenderer(viewType, dependencies);
}