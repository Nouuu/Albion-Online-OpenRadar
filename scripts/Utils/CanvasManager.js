/**
 * CanvasManager.js
 *
 * Unified canvas initialization and management for both main and overlay radar.
 * Handles setup of all 6 canvas layers used by the radar display.
 *
 * Canvas Layers (z-index order):
 * 1. mapCanvas - Background map image
 * 2. gridCanvas - Static grid overlay
 * 3. drawCanvas - Main entity rendering (resources, mobs, players, chests)
 * 4. flashCanvas - Red border flash effect (player detection)
 * 5. ourPlayerCanvas - Local player blue dot (static)
 * 6. thirdCanvas - Hidden/legacy items display
 */
import {CATEGORIES} from "../constants/LoggerConstants.js";

export class CanvasManager {
    constructor(viewType = 'main') {
        this.viewType = viewType; // 'main' or 'overlay'
        this.canvases = {};
        this.contexts = {};
    }

    /**
     * Initialize all canvas elements and their 2D contexts
     * @returns {Object} Object containing all canvases and contexts
     */
    initialize() {
        const canvasIds = [
            'mapCanvas',
            'gridCanvas',
            'drawCanvas',
            'flashCanvas',
            'ourPlayerCanvas',
            'thirdCanvas'
        ];

        canvasIds.forEach(id => {
            const canvas = document.getElementById(id);
            if (!canvas) {
                window.logger?.error(CATEGORIES.MAP, 'CanvasManagerInitialize', `Canvas element not found: ${id}`);
                return;
            }

            this.canvases[id] = canvas;
            this.contexts[id] = canvas.getContext('2d');

            // Apply default canvas properties
            canvas.width = 500;
            canvas.height = 500;
        });

        // Setup grid canvas (static, only needs to be drawn once)
        this.setupGridCanvas();

        // Setup local player canvas (static blue dot)
        this.setupOurPlayerCanvas();

        return {
            canvases: this.canvases,
            contexts: this.contexts
        };
    }

    /**
     * Setup the grid canvas with static grid overlay
     */
    setupGridCanvas() {
        const gridCanvas = this.canvases.gridCanvas;
        const contextGrid = this.contexts.gridCanvas;

        if (!gridCanvas || !contextGrid) return;

        contextGrid.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        contextGrid.strokeStyle = '#1e1e1e';
        contextGrid.lineWidth = 1;

        // Draw grid lines
        for (let i = 0; i <= 500; i += 50) {
            // Vertical lines
            contextGrid.beginPath();
            contextGrid.moveTo(i, 0);
            contextGrid.lineTo(i, 500);
            contextGrid.stroke();

            // Horizontal lines
            contextGrid.beginPath();
            contextGrid.moveTo(0, i);
            contextGrid.lineTo(500, i);
            contextGrid.stroke();
        }

        // Draw center crosshair
        contextGrid.strokeStyle = '#3e3e3e';
        contextGrid.lineWidth = 2;

        // Vertical center line
        contextGrid.beginPath();
        contextGrid.moveTo(250, 0);
        contextGrid.lineTo(250, 500);
        contextGrid.stroke();

        // Horizontal center line
        contextGrid.beginPath();
        contextGrid.moveTo(0, 250);
        contextGrid.lineTo(500, 250);
        contextGrid.stroke();
    }

    /**
     * Setup the local player canvas with static blue dot at center
     */
    setupOurPlayerCanvas() {
        const ourPlayerCanvas = this.canvases.ourPlayerCanvas;
        const contextOurPlayer = this.contexts.ourPlayerCanvas;

        if (!ourPlayerCanvas || !contextOurPlayer) return;

        contextOurPlayer.clearRect(0, 0, ourPlayerCanvas.width, ourPlayerCanvas.height);

        // Draw blue dot for local player at center (250, 250)
        contextOurPlayer.fillStyle = 'blue';
        contextOurPlayer.beginPath();
        contextOurPlayer.arc(250, 250, 5, 0, 2 * Math.PI);
        contextOurPlayer.fill();
    }

    /**
     * Clear specific canvas layers
     * @param {Array<string>} layerIds - Array of canvas IDs to clear
     */
    clearLayers(layerIds) {
        layerIds.forEach(id => {
            const canvas = this.canvases[id];
            const context = this.contexts[id];
            if (canvas && context) {
                context.clearRect(0, 0, canvas.width, canvas.height);
            }
        });
    }

    /**
     * Clear all dynamic layers (called every frame)
     */
    clearDynamicLayers() {
        this.clearLayers(['mapCanvas', 'drawCanvas', 'flashCanvas']);
    }

    /**
     * Get a specific canvas element
     * @param {string} canvasId - Canvas ID to retrieve
     * @returns {HTMLCanvasElement|null}
     */
    getCanvas(canvasId) {
        return this.canvases[canvasId] || null;
    }

    /**
     * Get a specific canvas context
     * @param {string} canvasId - Canvas ID to retrieve context for
     * @returns {CanvasRenderingContext2D|null}
     */
    getContext(canvasId) {
        return this.contexts[canvasId] || null;
    }

    /**
     * Get all canvases
     * @returns {Object}
     */
    getAllCanvases() {
        return this.canvases;
    }

    /**
     * Get all contexts
     * @returns {Object}
     */
    getAllContexts() {
        return this.contexts;
    }
}

// Export singleton instance factory
export function createCanvasManager(viewType = 'main') {
    return new CanvasManager(viewType);
}