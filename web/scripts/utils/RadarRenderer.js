import {CanvasManager} from './CanvasManager.js';
import {CATEGORIES} from "../constants/LoggerConstants.js";
import settingsSync from "./SettingsSync.js";
import zonesDatabase from "../data/ZonesDatabase.js";

export class RadarRenderer {
    constructor(dependencies) {
        this.handlers = dependencies.handlers;
        this.drawings = dependencies.drawings;
        this.drawingUtils = dependencies.drawingUtils;

        this.canvasManager = new CanvasManager();
        this.contexts = {};

        this.lpX = 0;
        this.lpY = 0;
        this.map = null;

        this.previousTime = performance.now();
        this.animationFrameId = null;

        this.TARGET_FPS = 30;
        this.FRAME_TIME = 1000 / this.TARGET_FPS;
        this.CLUSTER_UPDATE_INTERVAL = 2000;
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

        window.logger?.info(CATEGORIES.MAP, 'RadarRendererInitialized', {});
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
        window.logger?.info(CATEGORIES.MAP, 'RadarRendererGameLoopStarted', {});
    }

    /**
     * Stop the game loop and cleanup resources
     */
    stop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            window.logger?.info(CATEGORIES.MAP, 'RadarRendererGameLoopStopped', {});
        }

        this.canvasManager?.destroy();
    }

    /**
     * Main game loop - runs every frame (throttled to TARGET_FPS)
     */
    gameLoop() {
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());

        const currentTime = performance.now();

        const elapsed = currentTime - this.lastFrameTime;
        if (elapsed < this.FRAME_TIME) return;

        this.lastFrameTime = currentTime - (elapsed % this.FRAME_TIME);

        this.update();
        this.render();
        window.pipManager?.onRadarRendered();
    }

    /**
     * Update phase - interpolate entity positions
     */
    update() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.previousTime;
        const t = Math.min(1, deltaTime / 100);

        if (settingsSync.getBool('settingShowMap', true) && this.drawings.mapsDrawing) {
            this.drawings.mapsDrawing.interpolate(this.map, this.lpX, this.lpY, t);
        }

        if (this.handlers.harvestablesHandler && this.drawings.harvestablesDrawing) {
            this.handlers.harvestablesHandler.removeNotInRange(this.lpX, this.lpY);
            this.drawings.harvestablesDrawing.interpolate(
                this.handlers.harvestablesHandler.harvestableList,
                this.lpX,
                this.lpY,
                t
            );
        }

        if (this.handlers.mobsHandler && this.drawings.mobsDrawing) {
            this.drawings.mobsDrawing.interpolate(
                this.handlers.mobsHandler.mobsList,
                this.handlers.mobsHandler.mistList,
                this.lpX, this.lpY, t
            );
        }

        if (this.handlers.playersHandler && this.drawings.playersDrawing) {
            this.drawings.playersDrawing.interpolate(
                this.handlers.playersHandler.getFilteredPlayers(),
                this.lpX, this.lpY, t
            );
        }

        if (this.handlers.chestsHandler && this.drawings.chestsDrawing) {
            this.drawings.chestsDrawing.interpolate(
                this.handlers.chestsHandler.chestsList,
                this.lpX, this.lpY, t
            );
        }

        if (this.handlers.wispCageHandler && this.drawings.wispCageDrawing) {
            this.drawings.wispCageDrawing.interpolate(
                this.handlers.wispCageHandler.cages,
                this.lpX, this.lpY, t
            );
        }

        if (this.handlers.fishingHandler && this.drawings.fishingDrawing) {
            this.drawings.fishingDrawing.interpolate(
                this.handlers.fishingHandler.fishes,
                this.lpX, this.lpY, t
            );
        }

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
        this.canvasManager.clearDynamicLayers();

        const contextMap = this.contexts.mapCanvas;
        const context = this.contexts.drawCanvas;

        if (this.drawings.mapsDrawing && contextMap) {
            this.drawings.mapsDrawing.draw(contextMap, this.map);
        }

        // Cluster detection with caching (recalculated every CLUSTER_UPDATE_INTERVAL)
        let clustersForInfo = null;
        if (settingsSync.getBool('settingResourceClusters') && context) {
            const currentTime = performance.now();
            const timeSinceLastUpdate = currentTime - this.lastClusterUpdate;

            if (!this.cachedClusters || timeSinceLastUpdate > this.CLUSTER_UPDATE_INTERVAL) {
                try {
                    const staticList = this.handlers.harvestablesHandler?.harvestableList || [];
                    const livingList = (this.handlers.mobsHandler?.mobsList || []).filter(mob =>
                        mob.type === window.EnemyType?.LivingHarvestable ||
                        mob.type === window.EnemyType?.LivingSkinnable
                    );
                    const merged = staticList.concat(livingList);

                    this.cachedClusters = this.drawingUtils.detectClusters(
                        merged,
                        settingsSync.getNumber('settingClusterRadius'),
                        settingsSync.getNumber('settingClusterMinSize')
                    );
                    this.lastClusterUpdate = currentTime;
                } catch (e) {
                    window.logger?.error(CATEGORIES.RENDERING, 'cluster_compute_failed', e);
                }
            }

            clustersForInfo = this.cachedClusters;

            if (clustersForInfo) {
                for (const cluster of clustersForInfo) {
                    if (typeof this.drawingUtils?.drawClusterRingsFromCluster === 'function') {
                        this.drawingUtils.drawClusterRingsFromCluster(context, cluster);
                    } else if (typeof this.drawingUtils?.drawClusterIndicatorFromCluster === 'function') {
                        this.drawingUtils.drawClusterIndicatorFromCluster(context, cluster);
                    }
                }
            }
        }

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

        if (clustersForInfo?.length && context) {
            for (const cluster of clustersForInfo) {
                try {
                    if (typeof this.drawingUtils?.drawClusterInfoBox === 'function') {
                        this.drawingUtils.drawClusterInfoBox(context, cluster);
                    } else if (typeof this.drawingUtils?.drawClusterIndicatorFromCluster === 'function') {
                        this.drawingUtils.drawClusterIndicatorFromCluster(context, cluster);
                    }
                } catch (e) {
                    window.logger?.error(CATEGORIES.RENDERING, 'cluster_draw_failed', e);
                }
            }
        }

        this.renderUI();
    }

    /**
     * Render UI overlay elements (zone, counters, etc.)
     */
    renderUI() {
        const ctx = this.contexts.uiCanvas;
        if (!ctx) return;

        const canvasSize = settingsSync.getNumber('settingCanvasSize') || 500;
        ctx.clearRect(0, 0, canvasSize, canvasSize);

        this.renderDistanceRings(ctx);
        this.renderZoneInfo(ctx);
        this.renderStatsBox(ctx);
        this.renderThreatBorder(ctx);
    }

    /**
     * Render distance rings centered on player
     */
    renderDistanceRings(ctx) {
        const canvasSize = settingsSync.getNumber('settingCanvasSize') || 500;
        const center = canvasSize / 2;
        const distances = [10, 20];
        const zoomLevel = settingsSync.getFloat('settingRadarZoom') || 1.0;
        const pixelsPerMeter = (canvasSize / 60) * zoomLevel;

        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1;

        distances.forEach(dist => {
            const radius = dist * pixelsPerMeter;
            if (radius > center - 5) return;

            ctx.beginPath();
            ctx.arc(center, center, radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.font = '9px monospace';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${dist}m`, center + radius + 4, center);
            ctx.setLineDash([4, 6]);
        });

        ctx.restore();
    }

    renderZoneInfo(ctx) {
        if (!this.map?.id) return;

        const zone = zonesDatabase.getZone(this.map.id);
        const zoneName = zone?.name || this.map.id;
        const tier = zone?.tier ? `T${zone.tier}` : '';
        const pvpType = zone?.pvpType || 'safe';

        const pvpStyles = {
            'black': {icon: '\u{1F480}', color: '#ff4444'},
            'red': {icon: '\u{2694}\uFE0F', color: '#ff8800'},
            'yellow': {icon: '\u{1F536}', color: '#ffff00'},
            'safe': {icon: '\u{1F6E1}\uFE0F', color: '#44ff44'}
        };
        const style = pvpStyles[pvpType] || pvpStyles.safe;

        const zoneText = `${zoneName}${tier ? ` (${tier})` : ''} ${style.icon}`;
        ctx.font = 'bold 11px monospace';
        const textWidth = ctx.measureText(zoneText).width;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, textWidth + 16, 22);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, textWidth + 16, 22);

        ctx.fillStyle = style.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(zoneText, 18, 16);
    }

    /**
     * Render stats box (top right, conditional based on settings)
     */
    renderStatsBox(ctx) {
        const playerCount = this.handlers.playersHandler?.getFilteredPlayers?.()?.length ?? 0;
        const resourceCount = this.handlers.harvestablesHandler?.harvestableList?.length || 0;
        const mobCount = this.handlers.mobsHandler?.mobsList?.length || 0;

        const stats = [];
        if (settingsSync.getBool('settingShowPlayers')) {
            stats.push({ emoji: '👥', count: playerCount, label: 'players', color: '#ffffff' });
        }
        stats.push({ emoji: '📦', count: resourceCount, label: 'resources', color: '#00d4ff' });
        stats.push({ emoji: '👾', count: mobCount, label: 'mobs', color: '#ff6b6b' });

        const canvasSize = settingsSync.getNumber('settingCanvasSize') || 500;
        const boxWidth = 135;
        const lineHeight = 14;
        const boxHeight = 8 + stats.length * lineHeight + 8;
        const boxX = canvasSize - boxWidth - 10;
        const boxY = 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

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
        if (!settingsSync.getBool('settingFlashDangerousPlayer')) return;

        const hostilePlayers = this.handlers.playersHandler?.getFilteredPlayers?.()?.filter(
            p => p.isHostile?.()
        ) || [];

        if (hostilePlayers.length === 0) return;

        const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.5;
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
 * @param {Object} dependencies - Handlers, drawings, settings, etc.
 * @returns {RadarRenderer}
 */
export function createRadarRenderer(dependencies) {
    return new RadarRenderer(dependencies);
}