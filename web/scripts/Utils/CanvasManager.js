import {CATEGORIES} from "../constants/LoggerConstants.js";
import settingsSync from "./SettingsSync.js";

export class CanvasManager {
    constructor() {
        this.canvases = {};
        this.contexts = {};
        this._onCanvasSizeChanged = null;
    }

    /**
     * Initialize all canvas elements and their 2D contexts
     * @returns {Object} Object containing all canvases and contexts
     */
    initialize() {
        const canvasIds = [
            'mapCanvas',
            'drawCanvas',
            'ourPlayerCanvas',
            'uiCanvas'
        ];

        canvasIds.forEach(id => {
            const canvas = document.getElementById(id);
            if (!canvas) {
                window.logger?.error(CATEGORIES.MAP, 'CanvasManagerInitialize', `Canvas element not found: ${id}`);
                return;
            }

            this.canvases[id] = canvas;
            this.contexts[id] = canvas.getContext('2d');

            // Apply canvas properties (dynamic size from settings)
            const size = settingsSync.getNumber('settingCanvasSize') || 500;
            canvas.width = size;
            canvas.height = size;
        });

        this.setupOurPlayerCanvas();

        // Remove previous listener if exists (prevent accumulation)
        if (this._onCanvasSizeChanged) {
            window.removeEventListener('canvasSizeChanged', this._onCanvasSizeChanged);
        }

        this._onCanvasSizeChanged = (e) => {
            const newSize = e.detail?.size || settingsSync.getNumber('settingCanvasSize') || 500;
            Object.values(this.canvases).forEach(canvas => {
                if (canvas) {
                    canvas.width = newSize;
                    canvas.height = newSize;
                }
            });
            this.setupOurPlayerCanvas();
        };
        window.addEventListener('canvasSizeChanged', this._onCanvasSizeChanged);

        return {
            canvases: this.canvases,
            contexts: this.contexts
        };
    }

    /**
     * Setup the local player canvas with static blue dot at center
     */
    setupOurPlayerCanvas() {
        const ourPlayerCanvas = this.canvases.ourPlayerCanvas;
        const contextOurPlayer = this.contexts.ourPlayerCanvas;

        if (!ourPlayerCanvas || !contextOurPlayer) return;

        contextOurPlayer.clearRect(0, 0, ourPlayerCanvas.width, ourPlayerCanvas.height);

        // Draw blue dot for local player at dynamic center
        const size = settingsSync.getNumber('settingCanvasSize') || 500;
        const center = size / 2;
        contextOurPlayer.fillStyle = 'blue';
        contextOurPlayer.beginPath();
        contextOurPlayer.arc(center, center, 5, 0, 2 * Math.PI);
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
        this.clearLayers(['mapCanvas', 'drawCanvas', 'uiCanvas']);
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

    /**
     * Cleanup resources and remove event listeners
     * Called when radar is destroyed to prevent memory leaks
     */
    destroy() {
        if (this._onCanvasSizeChanged) {
            window.removeEventListener('canvasSizeChanged', this._onCanvasSizeChanged);
            this._onCanvasSizeChanged = null;
        }
        this.canvases = {};
        this.contexts = {};
    }
}

// Export singleton instance factory
export function createCanvasManager() {
    return new CanvasManager();
}